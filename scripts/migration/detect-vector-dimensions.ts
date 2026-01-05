#!/usr/bin/env npx tsx
/**
 * Vector Dimension Detection Utility
 *
 * Implements: TASK-VEC-001-009 (Data Migration Strategy)
 * Constitution: RULE-009 (zero data loss), RULE-079 (no magic numbers)
 *
 * Detects vector dimensions in existing data stores:
 * - JSON files with embeddings
 * - Binary vector files (.bin)
 * - HNSW index files
 * - SQLite databases with vector columns
 *
 * Usage:
 *   npx tsx scripts/migration/detect-vector-dimensions.ts [path] [--json] [--verbose]
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import * as BetterSqlite3 from 'better-sqlite3';

// Use dynamic import for better-sqlite3 compatibility
const Database = (BetterSqlite3 as unknown as { default: typeof BetterSqlite3 }).default || BetterSqlite3;

/**
 * Current vector dimension (text-embedding-3-large)
 * Keep in sync with src/god-agent/core/validation/constants.ts
 */
const VECTOR_DIM = 1536;

/**
 * Legacy dimension (768D) - text-embedding-ada-002
 * Current dimension (1536D) - text-embedding-3-large
 */
const LEGACY_VECTOR_DIM = 768;

/**
 * Detection result for a single file/store
 */
export interface DimensionDetectionResult {
  path: string;
  type: 'json' | 'binary' | 'sqlite' | 'hnsw' | 'unknown';
  detectedDimension: number | null;
  vectorCount: number;
  needsMigration: boolean;
  details: {
    format?: string;
    fieldPath?: string;
    tableName?: string;
    columnName?: string;
    sampleVector?: number[];
  };
  error?: string;
}

/**
 * Summary of detection across all stores
 */
export interface DimensionDetectionSummary {
  totalFiles: number;
  filesWithVectors: number;
  filesNeedingMigration: number;
  vectorsByDimension: Record<number, number>;
  results: DimensionDetectionResult[];
  timestamp: string;
}

/**
 * Detect vector dimensions in a JSON file
 */
function detectJsonDimensions(filePath: string): DimensionDetectionResult {
  const result: DimensionDetectionResult = {
    path: filePath,
    type: 'json',
    detectedDimension: null,
    vectorCount: 0,
    needsMigration: false,
    details: {},
  };

  try {
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));
    const vectors = findVectorsInObject(content, '');

    if (vectors.length === 0) {
      return result;
    }

    // Analyze dimensions
    const dimensions = new Set<number>();
    for (const vec of vectors) {
      if (Array.isArray(vec.vector) && vec.vector.length > 0) {
        dimensions.add(vec.vector.length);
        result.vectorCount++;
      }
    }

    if (dimensions.size === 1) {
      result.detectedDimension = Array.from(dimensions)[0];
      result.needsMigration = result.detectedDimension === LEGACY_VECTOR_DIM;
      result.details.fieldPath = vectors[0].path;
      result.details.sampleVector = vectors[0].vector.slice(0, 5);
    } else if (dimensions.size > 1) {
      // Mixed dimensions - needs attention
      result.detectedDimension = Math.min(...Array.from(dimensions));
      result.needsMigration = dimensions.has(LEGACY_VECTOR_DIM);
      result.details.format = `Mixed dimensions: ${Array.from(dimensions).join(', ')}`;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Recursively find vectors in a JSON object
 */
function findVectorsInObject(
  obj: unknown,
  path: string
): Array<{ path: string; vector: number[] }> {
  const results: Array<{ path: string; vector: number[] }> = [];

  if (!obj || typeof obj !== 'object') {
    return results;
  }

  // Check if this is a vector array (array of numbers with embedding-like length)
  if (Array.isArray(obj)) {
    const isVectorArray = obj.length > 100 &&
      obj.length <= 4096 && // Reasonable embedding dimensions
      typeof obj[0] === 'number';

    if (isVectorArray) {
      results.push({ path, vector: obj as number[] });
      return results;
    }

    // Search array elements
    obj.forEach((item, index) => {
      results.push(...findVectorsInObject(item, `${path}[${index}]`));
    });
    return results;
  }

  // Search object properties
  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    const newPath = path ? `${path}.${key}` : key;

    // Check for common embedding field names
    if (
      key.toLowerCase().includes('embedding') ||
      key.toLowerCase().includes('vector') ||
      key === 'data'
    ) {
      if (Array.isArray(value) && value.length > 100 && typeof value[0] === 'number') {
        results.push({ path: newPath, vector: value as number[] });
        continue;
      }
    }

    results.push(...findVectorsInObject(value, newPath));
  }

  return results;
}

/**
 * Detect vector dimensions in a binary file
 *
 * Binary format (from vectors.bin analysis):
 * - Header: version (4 bytes), flags (4 bytes), count (4 bytes)
 * - Per vector: id_length (4 bytes), id (variable), vector_data (dim * 4 bytes)
 */
function detectBinaryDimensions(filePath: string): DimensionDetectionResult {
  const result: DimensionDetectionResult = {
    path: filePath,
    type: 'binary',
    detectedDimension: null,
    vectorCount: 0,
    needsMigration: false,
    details: {},
  };

  try {
    const buffer = readFileSync(filePath);
    if (buffer.length < 12) {
      result.error = 'File too small to contain vectors';
      return result;
    }

    // Parse header
    const version = buffer.readUInt32LE(0);
    const flags = buffer.readUInt32LE(4);
    const count = buffer.readUInt32LE(8);

    result.details.format = `Binary v${version}, flags=${flags}, count=${count}`;

    if (count === 0) {
      return result;
    }

    // Try to detect dimension from first vector
    let offset = 12;
    if (offset < buffer.length) {
      const idLength = buffer.readUInt32LE(offset);
      offset += 4 + idLength;

      // The remaining bytes should be the vector data
      // Calculate possible dimensions
      const remainingInFirstChunk = buffer.length - offset;
      const possibleDim768 = remainingInFirstChunk >= LEGACY_VECTOR_DIM * 4;
      const possibleDim1536 = remainingInFirstChunk >= VECTOR_DIM * 4;

      // Infer dimension based on file size and count
      const dataBytes = buffer.length - 12;
      const avgBytesPerVector = dataBytes / count;

      // Estimate ID overhead (avg ~40 bytes)
      const estimatedVectorBytes = avgBytesPerVector - 40;
      const estimatedDimension = Math.round(estimatedVectorBytes / 4);

      // Round to nearest common dimension
      if (Math.abs(estimatedDimension - LEGACY_VECTOR_DIM) < 50) {
        result.detectedDimension = LEGACY_VECTOR_DIM;
      } else if (Math.abs(estimatedDimension - VECTOR_DIM) < 50) {
        result.detectedDimension = VECTOR_DIM;
      } else {
        result.detectedDimension = estimatedDimension;
      }

      result.vectorCount = count;
      result.needsMigration = result.detectedDimension === LEGACY_VECTOR_DIM;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Detect vector dimensions in an HNSW index file
 */
function detectHnswDimensions(filePath: string): DimensionDetectionResult {
  const result: DimensionDetectionResult = {
    path: filePath,
    type: 'hnsw',
    detectedDimension: null,
    vectorCount: 0,
    needsMigration: false,
    details: {},
  };

  try {
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));

    // HNSW serialized format has explicit dimension
    if (content.dimension) {
      result.detectedDimension = content.dimension;
      result.needsMigration = content.dimension === LEGACY_VECTOR_DIM;
      result.details.format = `HNSW v${content.version || 1}`;
    }

    if (content.vectors && Array.isArray(content.vectors)) {
      result.vectorCount = content.vectors.length;

      // Double-check with actual vector data
      if (content.vectors.length > 0 && content.vectors[0].data) {
        const actualDim = content.vectors[0].data.length;
        if (actualDim !== result.detectedDimension) {
          result.error = `Dimension mismatch: header=${result.detectedDimension}, actual=${actualDim}`;
        }
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Detect vector dimensions in a SQLite database
 */
function detectSqliteDimensions(filePath: string): DimensionDetectionResult {
  const result: DimensionDetectionResult = {
    path: filePath,
    type: 'sqlite',
    detectedDimension: null,
    vectorCount: 0,
    needsMigration: false,
    details: {},
  };

  let db: Database.Database | null = null;

  try {
    db = new Database(filePath, { readonly: true });

    // Find tables with embedding columns
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    for (const table of tables) {
      const columns = db
        .prepare(`PRAGMA table_info(${table.name})`)
        .all() as Array<{ name: string; type: string }>;

      // Look for blob or text columns that might contain vectors
      const vectorColumns = columns.filter(
        (c) =>
          c.name.toLowerCase().includes('embedding') ||
          c.name.toLowerCase().includes('vector')
      );

      for (const col of vectorColumns) {
        const sample = db
          .prepare(`SELECT ${col.name} FROM ${table.name} LIMIT 1`)
          .get() as Record<string, unknown> | undefined;

        if (sample && sample[col.name]) {
          const vectorData = sample[col.name];

          // Handle BLOB or JSON-encoded vectors
          let vector: number[] | null = null;

          if (Buffer.isBuffer(vectorData)) {
            // Float32 array in blob
            const floatCount = vectorData.length / 4;
            if (floatCount === LEGACY_VECTOR_DIM || floatCount === VECTOR_DIM) {
              result.detectedDimension = floatCount;
            }
          } else if (typeof vectorData === 'string') {
            try {
              vector = JSON.parse(vectorData);
              if (Array.isArray(vector)) {
                result.detectedDimension = vector.length;
              }
            } catch {
              // Not JSON
            }
          }

          if (result.detectedDimension) {
            const count = db
              .prepare(`SELECT COUNT(*) as cnt FROM ${table.name} WHERE ${col.name} IS NOT NULL`)
              .get() as { cnt: number };

            result.vectorCount = count.cnt;
            result.needsMigration = result.detectedDimension === LEGACY_VECTOR_DIM;
            result.details.tableName = table.name;
            result.details.columnName = col.name;
            break;
          }
        }
      }

      if (result.detectedDimension) break;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    db?.close();
  }

  return result;
}

/**
 * Detect vector dimensions for a single file
 */
export function detectFileDimensions(filePath: string): DimensionDetectionResult {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath).toLowerCase();

  if (ext === '.json') {
    if (name.includes('hnsw') || name.includes('index')) {
      return detectHnswDimensions(filePath);
    }
    return detectJsonDimensions(filePath);
  }

  if (ext === '.bin') {
    return detectBinaryDimensions(filePath);
  }

  if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3') {
    return detectSqliteDimensions(filePath);
  }

  return {
    path: filePath,
    type: 'unknown',
    detectedDimension: null,
    vectorCount: 0,
    needsMigration: false,
    details: {},
    error: `Unsupported file type: ${ext}`,
  };
}

/**
 * Recursively scan a directory for vector stores
 */
export function scanDirectory(
  dirPath: string,
  options: { recursive?: boolean; extensions?: string[] } = {}
): DimensionDetectionResult[] {
  const results: DimensionDetectionResult[] = [];
  const { recursive = true, extensions = ['.json', '.bin', '.db', '.sqlite'] } = options;

  if (!existsSync(dirPath)) {
    return results;
  }

  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && recursive) {
      results.push(...scanDirectory(fullPath, options));
    } else if (stat.isFile()) {
      const ext = extname(entry).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(detectFileDimensions(fullPath));
      }
    }
  }

  return results;
}

/**
 * Generate a summary of dimension detection results
 */
export function generateSummary(results: DimensionDetectionResult[]): DimensionDetectionSummary {
  const vectorsByDimension: Record<number, number> = {};
  let filesWithVectors = 0;
  let filesNeedingMigration = 0;

  for (const result of results) {
    if (result.vectorCount > 0) {
      filesWithVectors++;

      if (result.detectedDimension) {
        vectorsByDimension[result.detectedDimension] =
          (vectorsByDimension[result.detectedDimension] || 0) + result.vectorCount;
      }

      if (result.needsMigration) {
        filesNeedingMigration++;
      }
    }
  }

  return {
    totalFiles: results.length,
    filesWithVectors,
    filesNeedingMigration,
    vectorsByDimension,
    results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const targetPath = args[0] || '.agentdb';
  const outputJson = args.includes('--json');
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log(`\n=== Vector Dimension Detection ===\n`);
  console.log(`Target: ${targetPath}`);
  console.log(`Expected dimension: ${VECTOR_DIM} (current)`);
  console.log(`Legacy dimension: ${LEGACY_VECTOR_DIM} (needs migration)\n`);

  const results = scanDirectory(targetPath);
  const summary = generateSummary(results);

  if (outputJson) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`Files scanned: ${summary.totalFiles}`);
  console.log(`Files with vectors: ${summary.filesWithVectors}`);
  console.log(`Files needing migration: ${summary.filesNeedingMigration}`);
  console.log(`\nVectors by dimension:`);

  for (const [dim, count] of Object.entries(summary.vectorsByDimension)) {
    const needsMigration = parseInt(dim) === LEGACY_VECTOR_DIM;
    console.log(`  ${dim}D: ${count} vectors ${needsMigration ? '(NEEDS MIGRATION)' : '(OK)'}`);
  }

  if (verbose || summary.filesNeedingMigration > 0) {
    console.log(`\n=== Files Requiring Migration ===\n`);

    for (const result of results.filter(r => r.needsMigration)) {
      console.log(`File: ${result.path}`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Vectors: ${result.vectorCount}`);
      console.log(`  Dimension: ${result.detectedDimension}`);
      if (result.details.tableName) {
        console.log(`  Table: ${result.details.tableName}.${result.details.columnName}`);
      }
      if (result.details.fieldPath) {
        console.log(`  Field: ${result.details.fieldPath}`);
      }
      console.log();
    }
  }

  if (summary.filesNeedingMigration > 0) {
    console.log(`\n[!] Migration required for ${summary.filesNeedingMigration} files.`);
    console.log(`    Run: npx tsx scripts/migration/migrate-768-to-1536.ts --dry-run`);
  } else {
    console.log(`\n[OK] No migration required. All vectors are ${VECTOR_DIM}D.`);
  }
}

// Run if executed directly
const isMainModule = process.argv[1]?.endsWith('detect-vector-dimensions.ts');
if (isMainModule) {
  main().catch(console.error);
}
