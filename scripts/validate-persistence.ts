#!/usr/bin/env tsx
/**
 * SonaEngine Persistence Validation Script
 * TASK-PERSIST-010 - Validates that SonaEngine persistence is working correctly
 *
 * Purpose: Verify that the learning.db database contains valid data
 * in all required tables (trajectory_metadata, patterns, learning_feedback).
 *
 * Exit Codes:
 *   0 = Valid (all tables have data)
 *   1 = Invalid (one or more tables empty)
 *   2 = Error (database not found or connection failed)
 *
 * Usage:
 *   npx tsx scripts/validate-persistence.ts
 *   npx tsx scripts/validate-persistence.ts --db-path /custom/path.db
 */

import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';

// ============================================================
// TYPES
// ============================================================

interface TrajectoryStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  abandoned: number;
}

interface PatternStats {
  total: number;
  active: number;
  deprecated: number;
  avgWeight: number;
}

interface FeedbackStats {
  total: number;
  processed: number;
  unprocessed: number;
  avgQuality: number;
}

interface ValidationResult {
  valid: boolean;
  trajectoryMetadata: TrajectoryStats;
  patterns: PatternStats;
  feedback: FeedbackStats;
  emptyTables: string[];
}

// ============================================================
// CLI ARGUMENT PARSING
// ============================================================

function parseArgs(): { dbPath: string } {
  const args = process.argv.slice(2);
  let dbPath = join(process.cwd(), '.god-agent', 'learning.db');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db-path' && args[i + 1]) {
      dbPath = args[i + 1];
      i++; // Skip next arg
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: npx tsx scripts/validate-persistence.ts [options]

Options:
  --db-path <path>  Path to the learning.db database file
                    (default: .god-agent/learning.db)
  --help, -h        Show this help message

Exit Codes:
  0  Valid - all tables have data
  1  Invalid - one or more tables are empty
  2  Error - database not found or connection failed
`);
      process.exit(0);
    }
  }

  return { dbPath };
}

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

function getTrajectoryStats(db: Database.Database): TrajectoryStats {
  try {
    const result = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) as abandoned
      FROM trajectory_metadata
    `).get() as {
      total: number;
      active: number;
      completed: number;
      failed: number;
      abandoned: number;
    };

    return {
      total: result.total || 0,
      active: result.active || 0,
      completed: result.completed || 0,
      failed: result.failed || 0,
      abandoned: result.abandoned || 0,
    };
  } catch (error) {
    // Table might not exist
    return { total: 0, active: 0, completed: 0, failed: 0, abandoned: 0 };
  }
}

function getPatternStats(db: Database.Database): PatternStats {
  try {
    const result = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN deprecated = 0 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN deprecated = 1 THEN 1 ELSE 0 END) as deprecated,
        COALESCE(AVG(weight), 0) as avg_weight
      FROM patterns
    `).get() as {
      total: number;
      active: number;
      deprecated: number;
      avg_weight: number;
    };

    return {
      total: result.total || 0,
      active: result.active || 0,
      deprecated: result.deprecated || 0,
      avgWeight: result.avg_weight || 0,
    };
  } catch (error) {
    // Table might not exist
    return { total: 0, active: 0, deprecated: 0, avgWeight: 0 };
  }
}

function getFeedbackStats(db: Database.Database): FeedbackStats {
  try {
    const result = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN processed = 0 THEN 1 ELSE 0 END) as unprocessed,
        COALESCE(AVG(quality), 0) as avg_quality
      FROM learning_feedback
    `).get() as {
      total: number;
      processed: number;
      unprocessed: number;
      avg_quality: number;
    };

    return {
      total: result.total || 0,
      processed: result.processed || 0,
      unprocessed: result.unprocessed || 0,
      avgQuality: result.avg_quality || 0,
    };
  } catch (error) {
    // Table might not exist
    return { total: 0, processed: 0, unprocessed: 0, avgQuality: 0 };
  }
}

function validatePersistence(dbPath: string): ValidationResult {
  // Open database in read-only mode for validation
  const db = new Database(dbPath, { readonly: true });

  try {
    const trajectoryMetadata = getTrajectoryStats(db);
    const patterns = getPatternStats(db);
    const feedback = getFeedbackStats(db);

    // Determine which tables are empty
    const emptyTables: string[] = [];
    if (trajectoryMetadata.total === 0) emptyTables.push('trajectory_metadata');
    if (patterns.total === 0) emptyTables.push('patterns');
    if (feedback.total === 0) emptyTables.push('learning_feedback');

    // Valid if ALL tables have data
    const valid = emptyTables.length === 0;

    return {
      valid,
      trajectoryMetadata,
      patterns,
      feedback,
      emptyTables,
    };
  } finally {
    db.close();
  }
}

// ============================================================
// OUTPUT FORMATTING
// ============================================================

function printResults(dbPath: string, result: ValidationResult): void {
  console.log('=== SonaEngine Persistence Validation ===\n');
  console.log(`Database: ${dbPath}\n`);

  // Trajectory Metadata
  console.log('Trajectory Metadata:');
  console.log(`  Total: ${result.trajectoryMetadata.total}`);
  console.log(`  Active: ${result.trajectoryMetadata.active}`);
  console.log(`  Completed: ${result.trajectoryMetadata.completed}`);
  console.log(`  Failed: ${result.trajectoryMetadata.failed}`);
  if (result.trajectoryMetadata.abandoned > 0) {
    console.log(`  Abandoned: ${result.trajectoryMetadata.abandoned}`);
  }
  console.log('');

  // Patterns
  console.log('Patterns:');
  console.log(`  Total: ${result.patterns.total}`);
  console.log(`  Active: ${result.patterns.active}`);
  console.log(`  Deprecated: ${result.patterns.deprecated}`);
  console.log(`  Average Weight: ${result.patterns.avgWeight.toFixed(2)}`);
  console.log('');

  // Learning Feedback
  console.log('Learning Feedback:');
  console.log(`  Total: ${result.feedback.total}`);
  console.log(`  Processed: ${result.feedback.processed}`);
  console.log(`  Unprocessed: ${result.feedback.unprocessed}`);
  console.log(`  Average Quality: ${result.feedback.avgQuality.toFixed(2)}`);
  console.log('');

  // Final Status
  if (result.valid) {
    console.log('\x1b[32m%s\x1b[0m', 'VALID - All tables have data');
  } else {
    console.log('\x1b[31m%s\x1b[0m', `INVALID - Empty tables detected: ${result.emptyTables.join(', ')}`);
  }
}

// ============================================================
// MAIN
// ============================================================

function main(): void {
  const { dbPath } = parseArgs();

  // Check if database file exists
  if (!existsSync(dbPath)) {
    console.error(`\x1b[31mError: Database file not found: ${dbPath}\x1b[0m`);
    console.error('\nEnsure the database has been initialized by running SonaEngine at least once.');
    console.error('You can specify a custom path with: --db-path /path/to/learning.db');
    process.exit(2);
  }

  try {
    const result = validatePersistence(dbPath);
    printResults(dbPath, result);

    // Exit with appropriate code
    if (result.valid) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error(`\x1b[31mError: Failed to validate database\x1b[0m`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}

main();
