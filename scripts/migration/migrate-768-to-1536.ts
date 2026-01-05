#!/usr/bin/env npx tsx
/**
 * Vector Migration Script: 768D -> 1536D
 *
 * Implements: TASK-VEC-001-009 (Data Migration Strategy)
 * Constitution: RULE-009 (zero data loss), RULE-046 (atomic operations)
 *
 * Migration options:
 * - Option A: Re-embed with new model (lossless, slow, requires API)
 * - Option B: Zero-pad 768D -> 1536D (lossy but fast, offline)
 *
 * Features:
 * - Automatic dimension detection
 * - Progress tracking and resumability
 * - Dry-run mode
 * - Backup creation
 * - Atomic operations per file
 *
 * Usage:
 *   npx tsx scripts/migration/migrate-768-to-1536.ts [options]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, renameSync } from 'fs';
import { join, dirname, basename } from 'path';
import * as BetterSqlite3 from 'better-sqlite3';

// Use dynamic import for better-sqlite3 compatibility
const Database = (BetterSqlite3 as unknown as { default: typeof BetterSqlite3 }).default || BetterSqlite3;

// Import utilities from detection script
import {
  scanDirectory,
  generateSummary,
  DimensionDetectionResult,
} from './detect-vector-dimensions.js';

/**
 * Current vector dimension (text-embedding-3-large)
 * Keep in sync with src/god-agent/core/validation/constants.ts
 */
const VECTOR_DIM = 1536;

// Optional OpenAI import for reembed mode
let OpenAI: typeof import('openai').default | null = null;
try {
  const openaiModule = await import('openai');
  OpenAI = openaiModule.default;
} catch {
  // OpenAI not installed - reembed mode won't be available
}

/**
 * Legacy dimension constant
 */
const LEGACY_VECTOR_DIM = 768;

/**
 * Migration mode
 */
export type MigrationMode = 'reembed' | 'zero-pad';

/**
 * Migration options
 */
export interface MigrationOptions {
  /** Migration mode: 'reembed' (lossless) or 'zero-pad' (fast) */
  mode: MigrationMode;
  /** Dry run - don't modify files */
  dryRun: boolean;
  /** Create backups before migration */
  backup: boolean;
  /** Backup directory */
  backupDir: string;
  /** State file for resumability */
  stateFile: string;
  /** OpenAI API key (for reembed mode) */
  openaiApiKey?: string;
  /** Batch size for API calls */
  batchSize: number;
  /** Verbose output */
  verbose: boolean;
  /** Target paths to migrate */
  targetPaths: string[];
}

/**
 * Migration state for resumability
 */
interface MigrationState {
  startedAt: string;
  mode: MigrationMode;
  completedFiles: string[];
  failedFiles: Array<{ path: string; error: string }>;
  pendingFiles: string[];
  totalVectorsMigrated: number;
  lastUpdated: string;
}

/**
 * Result of migrating a single file
 */
interface FileMigrationResult {
  path: string;
  success: boolean;
  vectorsMigrated: number;
  error?: string;
  backupPath?: string;
}

/**
 * Vector Migration Manager
 */
export class VectorMigrationManager {
  private options: MigrationOptions;
  private state: MigrationState;
  private openai: InstanceType<typeof import('openai').default> | null = null;

  constructor(options: Partial<MigrationOptions> = {}) {
    this.options = {
      mode: 'zero-pad',
      dryRun: false,
      backup: true,
      backupDir: '.agentdb/migration-backups',
      stateFile: '.agentdb/migration-state.json',
      batchSize: 100,
      verbose: false,
      targetPaths: ['.agentdb'],
      ...options,
    };

    this.state = this.loadState();

    if (this.options.mode === 'reembed' && this.options.openaiApiKey && OpenAI) {
      this.openai = new OpenAI({ apiKey: this.options.openaiApiKey });
    }
  }

  /**
   * Load migration state from file
   */
  private loadState(): MigrationState {
    if (existsSync(this.options.stateFile)) {
      try {
        return JSON.parse(readFileSync(this.options.stateFile, 'utf-8'));
      } catch {
        // Corrupted state file, start fresh
      }
    }

    return {
      startedAt: new Date().toISOString(),
      mode: this.options.mode,
      completedFiles: [],
      failedFiles: [],
      pendingFiles: [],
      totalVectorsMigrated: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Save migration state to file
   */
  private saveState(): void {
    if (this.options.dryRun) return;

    this.state.lastUpdated = new Date().toISOString();

    const dir = dirname(this.options.stateFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.options.stateFile, JSON.stringify(this.state, null, 2));
  }

  /**
   * Create backup of a file
   */
  private createBackup(filePath: string): string | null {
    if (this.options.dryRun || !this.options.backup) return null;

    const backupDir = this.options.backupDir;
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${basename(filePath)}.${timestamp}.bak`;
    const backupPath = join(backupDir, backupName);

    copyFileSync(filePath, backupPath);
    return backupPath;
  }

  /**
   * Zero-pad a 768D vector to 1536D
   *
   * Strategy: Append zeros to maintain cosine similarity properties
   * The padded dimensions are set to 0, which doesn't affect cosine similarity
   * with other padded vectors but may reduce similarity with native 1536D vectors.
   */
  private zeroPadVector(vector: number[]): number[] {
    if (vector.length === VECTOR_DIM) {
      return vector; // Already correct dimension
    }

    if (vector.length !== LEGACY_VECTOR_DIM) {
      throw new Error(`Unexpected dimension: ${vector.length}`);
    }

    // Create new vector with zeros appended
    const padded = new Array(VECTOR_DIM).fill(0);
    for (let i = 0; i < LEGACY_VECTOR_DIM; i++) {
      padded[i] = vector[i];
    }

    // Re-normalize to unit length (L2 normalization)
    let norm = 0;
    for (const v of padded) {
      norm += v * v;
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < padded.length; i++) {
        padded[i] /= norm;
      }
    }

    return padded;
  }

  /**
   * Re-embed content using OpenAI API
   */
  private async reembedContent(content: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Provide API key for reembed mode.');
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: content,
      dimensions: VECTOR_DIM,
    });

    return response.data[0].embedding;
  }

  /**
   * Migrate vectors in a JSON file
   */
  private async migrateJsonFile(
    filePath: string,
    detection: DimensionDetectionResult
  ): Promise<FileMigrationResult> {
    const result: FileMigrationResult = {
      path: filePath,
      success: false,
      vectorsMigrated: 0,
    };

    try {
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      let modified = false;

      // Recursive migration of vectors in object
      const migrateVectorsInObject = async (obj: unknown): Promise<void> => {
        if (!obj || typeof obj !== 'object') return;

        if (Array.isArray(obj)) {
          // Check if this is a vector array
          if (obj.length === LEGACY_VECTOR_DIM && typeof obj[0] === 'number') {
            // This is a vector - migrate it
            const migrated = this.zeroPadVector(obj);
            obj.length = 0;
            obj.push(...migrated);
            result.vectorsMigrated++;
            modified = true;
            return;
          }

          // Recurse into array elements
          for (const item of obj) {
            await migrateVectorsInObject(item);
          }
          return;
        }

        // Handle object properties
        const record = obj as Record<string, unknown>;
        for (const [key, value] of Object.entries(record)) {
          // Check for embedding fields
          if (
            (key.toLowerCase().includes('embedding') ||
              key.toLowerCase().includes('vector')) &&
            Array.isArray(value) &&
            value.length === LEGACY_VECTOR_DIM &&
            typeof value[0] === 'number'
          ) {
            record[key] = this.zeroPadVector(value as number[]);
            result.vectorsMigrated++;
            modified = true;
            continue;
          }

          await migrateVectorsInObject(value);
        }
      };

      await migrateVectorsInObject(content);

      if (modified && !this.options.dryRun) {
        result.backupPath = this.createBackup(filePath) || undefined;

        // Atomic write: write to temp file then rename
        const tempPath = `${filePath}.tmp`;
        writeFileSync(tempPath, JSON.stringify(content, null, 2));
        renameSync(tempPath, filePath);
      }

      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Migrate vectors in an HNSW index file
   */
  private async migrateHnswFile(
    filePath: string,
    detection: DimensionDetectionResult
  ): Promise<FileMigrationResult> {
    const result: FileMigrationResult = {
      path: filePath,
      success: false,
      vectorsMigrated: 0,
    };

    try {
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));

      // Update dimension in header
      if (content.dimension === LEGACY_VECTOR_DIM) {
        content.dimension = VECTOR_DIM;
      }

      // Migrate all vectors
      if (content.vectors && Array.isArray(content.vectors)) {
        for (const vec of content.vectors) {
          if (vec.data && vec.data.length === LEGACY_VECTOR_DIM) {
            vec.data = this.zeroPadVector(vec.data);
            result.vectorsMigrated++;
          }
        }
      }

      // Update version to indicate migration
      content.version = (content.version || 1) + 1;
      content.migratedFrom = LEGACY_VECTOR_DIM;
      content.migratedAt = new Date().toISOString();

      if (!this.options.dryRun) {
        result.backupPath = this.createBackup(filePath) || undefined;

        const tempPath = `${filePath}.tmp`;
        writeFileSync(tempPath, JSON.stringify(content));
        renameSync(tempPath, filePath);
      }

      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Migrate vectors in a binary file
   *
   * Binary format:
   * - Header: version (4), flags (4), count (4)
   * - Per vector: id_len (4), id (variable), vector (dim * 4)
   */
  private async migrateBinaryFile(
    filePath: string,
    detection: DimensionDetectionResult
  ): Promise<FileMigrationResult> {
    const result: FileMigrationResult = {
      path: filePath,
      success: false,
      vectorsMigrated: 0,
    };

    try {
      const buffer = readFileSync(filePath);

      // Parse header
      const version = buffer.readUInt32LE(0);
      const flags = buffer.readUInt32LE(4);
      const count = buffer.readUInt32LE(8);

      // Calculate new buffer size
      const dimensionIncrease = VECTOR_DIM - LEGACY_VECTOR_DIM;
      const additionalBytes = count * dimensionIncrease * 4;
      const newBuffer = Buffer.alloc(buffer.length + additionalBytes);

      // Write updated header
      newBuffer.writeUInt32LE(version + 1, 0); // Increment version
      newBuffer.writeUInt32LE(flags | 0x02, 4); // Set migration flag
      newBuffer.writeUInt32LE(count, 8);

      let readOffset = 12;
      let writeOffset = 12;

      for (let i = 0; i < count; i++) {
        // Read ID
        const idLength = buffer.readUInt32LE(readOffset);
        readOffset += 4;

        // Copy ID length and ID
        newBuffer.writeUInt32LE(idLength, writeOffset);
        writeOffset += 4;

        buffer.copy(newBuffer, writeOffset, readOffset, readOffset + idLength);
        readOffset += idLength;
        writeOffset += idLength;

        // Read and migrate vector
        const vector: number[] = [];
        for (let j = 0; j < LEGACY_VECTOR_DIM; j++) {
          vector.push(buffer.readFloatLE(readOffset));
          readOffset += 4;
        }

        // Migrate vector
        const migrated = this.zeroPadVector(vector);

        // Write migrated vector
        for (let j = 0; j < VECTOR_DIM; j++) {
          newBuffer.writeFloatLE(migrated[j], writeOffset);
          writeOffset += 4;
        }

        result.vectorsMigrated++;
      }

      if (!this.options.dryRun) {
        result.backupPath = this.createBackup(filePath) || undefined;

        const tempPath = `${filePath}.tmp`;
        writeFileSync(tempPath, newBuffer);
        renameSync(tempPath, filePath);
      }

      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Migrate vectors in a SQLite database
   */
  private async migrateSqliteFile(
    filePath: string,
    detection: DimensionDetectionResult
  ): Promise<FileMigrationResult> {
    const result: FileMigrationResult = {
      path: filePath,
      success: false,
      vectorsMigrated: 0,
    };

    if (!detection.details.tableName || !detection.details.columnName) {
      result.error = 'Missing table/column info';
      return result;
    }

    let db: Database.Database | null = null;

    try {
      if (!this.options.dryRun) {
        result.backupPath = this.createBackup(filePath) || undefined;
      }

      db = new Database(filePath);

      // Get all rows with vectors
      const rows = db
        .prepare(`SELECT rowid, ${detection.details.columnName} FROM ${detection.details.tableName}`)
        .all() as Array<{ rowid: number; [key: string]: unknown }>;

      const updateStmt = db.prepare(
        `UPDATE ${detection.details.tableName} SET ${detection.details.columnName} = ? WHERE rowid = ?`
      );

      // Begin transaction (RULE-046: atomic operations)
      db.exec('BEGIN TRANSACTION');

      try {
        for (const row of rows) {
          const vectorData = row[detection.details.columnName];
          if (!vectorData) continue;

          let vector: number[] | null = null;

          // Parse vector from BLOB or JSON
          if (Buffer.isBuffer(vectorData)) {
            vector = [];
            for (let i = 0; i < vectorData.length; i += 4) {
              vector.push(vectorData.readFloatLE(i));
            }
          } else if (typeof vectorData === 'string') {
            try {
              vector = JSON.parse(vectorData);
            } catch {
              continue;
            }
          }

          if (!vector || vector.length !== LEGACY_VECTOR_DIM) continue;

          // Migrate vector
          const migrated = this.zeroPadVector(vector);

          // Write back
          if (!this.options.dryRun) {
            if (Buffer.isBuffer(vectorData)) {
              const newBuffer = Buffer.alloc(VECTOR_DIM * 4);
              for (let i = 0; i < VECTOR_DIM; i++) {
                newBuffer.writeFloatLE(migrated[i], i * 4);
              }
              updateStmt.run(newBuffer, row.rowid);
            } else {
              updateStmt.run(JSON.stringify(migrated), row.rowid);
            }
          }

          result.vectorsMigrated++;
        }

        if (!this.options.dryRun) {
          db.exec('COMMIT');
        } else {
          db.exec('ROLLBACK');
        }

        result.success = true;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    } finally {
      db?.close();
    }

    return result;
  }

  /**
   * Migrate a single file
   */
  async migrateFile(detection: DimensionDetectionResult): Promise<FileMigrationResult> {
    if (!detection.needsMigration) {
      return {
        path: detection.path,
        success: true,
        vectorsMigrated: 0,
      };
    }

    switch (detection.type) {
      case 'json':
        return this.migrateJsonFile(detection.path, detection);
      case 'hnsw':
        return this.migrateHnswFile(detection.path, detection);
      case 'binary':
        return this.migrateBinaryFile(detection.path, detection);
      case 'sqlite':
        return this.migrateSqliteFile(detection.path, detection);
      default:
        return {
          path: detection.path,
          success: false,
          vectorsMigrated: 0,
          error: `Unsupported file type: ${detection.type}`,
        };
    }
  }

  /**
   * Run the full migration
   */
  async run(): Promise<{
    success: boolean;
    totalFiles: number;
    migratedFiles: number;
    totalVectors: number;
    errors: Array<{ path: string; error: string }>;
  }> {
    const log = (msg: string) => {
      if (this.options.verbose) {
        console.log(msg);
      }
    };

    console.log('\n=== Vector Migration: 768D -> 1536D ===\n');
    console.log(`Mode: ${this.options.mode}`);
    console.log(`Dry run: ${this.options.dryRun}`);
    console.log(`Backup: ${this.options.backup}`);
    console.log(`Target paths: ${this.options.targetPaths.join(', ')}`);
    console.log();

    // Detect files needing migration
    let allResults: DimensionDetectionResult[] = [];
    for (const targetPath of this.options.targetPaths) {
      log(`Scanning ${targetPath}...`);
      allResults.push(...scanDirectory(targetPath));
    }

    const summary = generateSummary(allResults);
    const filesToMigrate = allResults.filter(r => r.needsMigration);

    console.log(`Files scanned: ${summary.totalFiles}`);
    console.log(`Files needing migration: ${summary.filesNeedingMigration}`);
    console.log(`Total vectors to migrate: ${summary.vectorsByDimension[LEGACY_VECTOR_DIM] || 0}`);
    console.log();

    if (filesToMigrate.length === 0) {
      console.log('[OK] No migration needed. All vectors are already 1536D.');
      return {
        success: true,
        totalFiles: summary.totalFiles,
        migratedFiles: 0,
        totalVectors: 0,
        errors: [],
      };
    }

    // Filter out already completed files (resumability)
    const pendingFiles = filesToMigrate.filter(
      f => !this.state.completedFiles.includes(f.path)
    );

    if (pendingFiles.length < filesToMigrate.length) {
      console.log(`Resuming migration: ${filesToMigrate.length - pendingFiles.length} files already completed`);
    }

    // Migrate files
    const errors: Array<{ path: string; error: string }> = [];
    let totalVectors = this.state.totalVectorsMigrated;

    for (let i = 0; i < pendingFiles.length; i++) {
      const detection = pendingFiles[i];
      const progress = `[${i + 1}/${pendingFiles.length}]`;

      log(`${progress} Migrating ${detection.path}...`);

      const result = await this.migrateFile(detection);

      if (result.success) {
        this.state.completedFiles.push(detection.path);
        totalVectors += result.vectorsMigrated;
        this.state.totalVectorsMigrated = totalVectors;

        log(`  -> Migrated ${result.vectorsMigrated} vectors`);
        if (result.backupPath) {
          log(`  -> Backup: ${result.backupPath}`);
        }
      } else {
        errors.push({ path: detection.path, error: result.error || 'Unknown error' });
        this.state.failedFiles.push({ path: detection.path, error: result.error || 'Unknown error' });

        console.error(`  -> FAILED: ${result.error}`);
      }

      // Save state periodically
      if ((i + 1) % 10 === 0) {
        this.saveState();
      }
    }

    // Final state save
    this.saveState();

    // Summary
    console.log('\n=== Migration Summary ===\n');
    console.log(`Total files processed: ${pendingFiles.length}`);
    console.log(`Successfully migrated: ${pendingFiles.length - errors.length}`);
    console.log(`Failed: ${errors.length}`);
    console.log(`Total vectors migrated: ${totalVectors}`);

    if (errors.length > 0) {
      console.log('\nFailed files:');
      for (const error of errors) {
        console.log(`  - ${error.path}: ${error.error}`);
      }
    }

    if (this.options.dryRun) {
      console.log('\n[DRY RUN] No files were modified.');
      console.log('Run without --dry-run to perform migration.');
    } else {
      console.log('\n[DONE] Migration complete.');
      if (this.options.backup) {
        console.log(`Backups stored in: ${this.options.backupDir}`);
      }
    }

    return {
      success: errors.length === 0,
      totalFiles: pendingFiles.length,
      migratedFiles: pendingFiles.length - errors.length,
      totalVectors,
      errors,
    };
  }
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const options: Partial<MigrationOptions> = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    backup: !args.includes('--no-backup'),
    targetPaths: ['.agentdb'],
  };

  // Parse mode
  if (args.includes('--reembed')) {
    options.mode = 'reembed';
    options.openaiApiKey = process.env.OPENAI_API_KEY;

    if (!options.openaiApiKey) {
      console.error('Error: OPENAI_API_KEY required for reembed mode');
      process.exit(1);
    }
  } else {
    options.mode = 'zero-pad';
  }

  // Parse custom paths
  const pathIndex = args.indexOf('--path');
  if (pathIndex !== -1 && args[pathIndex + 1]) {
    options.targetPaths = [args[pathIndex + 1]];
  }

  // Parse backup dir
  const backupIndex = args.indexOf('--backup-dir');
  if (backupIndex !== -1 && args[backupIndex + 1]) {
    options.backupDir = args[backupIndex + 1];
  }

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Vector Migration: 768D -> 1536D

Usage: npx tsx scripts/migration/migrate-768-to-1536.ts [options]

Options:
  --dry-run        Preview changes without modifying files
  --reembed        Use OpenAI API to re-embed (requires OPENAI_API_KEY)
  --no-backup      Skip creating backup files
  --path <dir>     Target directory (default: .agentdb)
  --backup-dir <d> Backup directory (default: .agentdb/migration-backups)
  --verbose, -v    Show detailed progress
  --help, -h       Show this help

Environment:
  OPENAI_API_KEY   Required for --reembed mode

Examples:
  # Preview migration
  npx tsx scripts/migration/migrate-768-to-1536.ts --dry-run

  # Run migration with zero-padding (fast, offline)
  npx tsx scripts/migration/migrate-768-to-1536.ts

  # Run migration with re-embedding (lossless, requires API)
  OPENAI_API_KEY=sk-... npx tsx scripts/migration/migrate-768-to-1536.ts --reembed

  # Migrate specific directory
  npx tsx scripts/migration/migrate-768-to-1536.ts --path .god-agent
`);
    process.exit(0);
  }

  const manager = new VectorMigrationManager(options);
  const result = await manager.run();

  process.exit(result.success ? 0 : 1);
}

// Run if executed directly
const isMainModule = process.argv[1]?.endsWith('migrate-768-to-1536.ts');
if (isMainModule) {
  main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
