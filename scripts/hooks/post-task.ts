#!/usr/bin/env npx tsx
/**
 * Claude Code Hooks - Post-Task Hook
 *
 * Implements: TECH-HKS-001 Post-Task Hook Component
 * Constitution: REQ-HKS-005, REQ-HKS-006, REQ-HKS-007, REQ-HKS-008, REQ-HKS-009, REQ-HKS-019, REQ-HKS-020, REQ-HKS-022
 *
 * Entry point for post-task hook called by .claude/hooks/post-task.sh
 *
 * Exit codes:
 *   0: Success (findings stored, feedback submitted or queued)
 *   1: Error (storage failed, write verification failed)
 *   3: Timeout (execution exceeded limit)
 *
 * @module scripts/hooks/post-task
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { InteractionStore } from '../../src/god-agent/universal/interaction-store.js';
import { ReasoningBank } from '../../src/god-agent/core/reasoning/reasoning-bank.js';
import { OutputExtractor } from './output-extractor.js';
import { FeedbackSubmitter } from './feedback-submitter.js';
import { handlePostTask as completePipelineStep } from './pipeline-event-emitter.js';
import {
  type IHookConfig,
  type KnowledgeEntry,
  DEFAULT_HOOK_CONFIG,
  EXIT_CODES,
  ValidationError,
  TimeoutError,
  StorageError
} from './hook-types.js';
import { createHookLogger, createHookError, logErrorAndExit } from './hook-logger.js';

// ==================== Constants ====================

const CONFIG_FILE_PATH = '.claude/hooks/config.json';
const PROJECT_ROOT = process.cwd();

// ==================== Configuration Loading ====================

/**
 * Load hook configuration from file and environment
 */
async function loadConfiguration(): Promise<IHookConfig> {
  const config: IHookConfig = { ...DEFAULT_HOOK_CONFIG };

  // Try reading config file
  try {
    const configPath = path.join(PROJECT_ROOT, CONFIG_FILE_PATH);
    const data = await fs.readFile(configPath, 'utf-8');
    const fileConfig = JSON.parse(data);

    // Merge file config with defaults
    if (fileConfig.performance?.preTaskBudgetMs) {
      config.preTaskTimeoutMs = fileConfig.performance.preTaskBudgetMs;
    }
    if (fileConfig.performance?.postTaskBudgetMs) {
      config.postTaskTimeoutMs = fileConfig.performance.postTaskBudgetMs;
    }
    if (fileConfig.memory?.domains) {
      config.memoryDomains = fileConfig.memory.domains;
    }
    if (fileConfig.memory?.maxContextSize) {
      config.maxContextSize = fileConfig.memory.maxContextSize;
    }
    if (fileConfig.logging?.level === 'DEBUG') {
      config.verbose = true;
    }
  } catch (error) {
    // Config file missing or corrupt - use defaults
  }

  // Apply environment variable overrides
  if (process.env.HOOKS_TIMEOUT_MS) {
    config.preTaskTimeoutMs = parseInt(process.env.HOOKS_TIMEOUT_MS, 10);
    config.postTaskTimeoutMs = parseInt(process.env.HOOKS_TIMEOUT_MS, 10);
  }
  if (process.env.HOOKS_VERBOSE === 'true') {
    config.verbose = true;
  }
  if (process.env.HOOKS_MEMORY_DB_PATH) {
    config.memoryDbPath = process.env.HOOKS_MEMORY_DB_PATH;
  }
  if (process.env.HOOKS_RETRY_ATTEMPTS) {
    config.retryAttempts = parseInt(process.env.HOOKS_RETRY_ATTEMPTS, 10);
  }
  if (process.env.HOOKS_RETRY_DELAY_MS) {
    config.retryDelayMs = parseInt(process.env.HOOKS_RETRY_DELAY_MS, 10);
  }

  return config;
}

// ==================== Input Reading ====================

/**
 * Read Task() output from arguments or stdin
 */
async function readTaskOutput(): Promise<string> {
  // Check command line argument first
  if (process.argv[2]) {
    return process.argv[2];
  }

  // Otherwise read from stdin
  return new Promise((resolve, reject) => {
    let data = '';

    if (process.stdin.isTTY) {
      // No stdin - return empty (handled gracefully per FM-HKS-003)
      resolve('');
      return;
    }

    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', err => {
      reject(new ValidationError(`Stdin read error: ${err.message}`, []));
    });

    // Set timeout for stdin read
    setTimeout(() => {
      resolve(data); // Return whatever we have
    }, 5000);
  });
}

// ==================== Timeout Wrapper ====================

/**
 * Execute async function with timeout
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  const startTime = Date.now();

  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        reject(new TimeoutError(
          `${operationName} timed out after ${elapsed}ms`,
          elapsed,
          { operation: operationName, startTime }
        ));
      }, timeoutMs);
    })
  ]);
}

// ==================== InteractionStore Operations ====================

/**
 * Initialize InteractionStore with retry
 */
async function initInteractionStore(config: IHookConfig, logger: ReturnType<typeof createHookLogger>): Promise<InteractionStore> {
  const storageDir = path.dirname(path.join(PROJECT_ROOT, config.memoryDbPath));

  const store = new InteractionStore({ storageDir });

  // Try to load existing data with retry
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await store.load();
      logger.debug('InteractionStore loaded', { storageDir, attempt });
      return store;
    } catch (error) {
      lastError = error as Error;
      logger.warn('InteractionStore load failed, retrying', {
        attempt,
        error: lastError.message
      });

      if (attempt < 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw lastError || new Error('InteractionStore initialization failed');
}

/**
 * Store findings and verify with read-back
 *
 * Implements: REQ-HKS-007, REQ-HKS-022
 */
async function storeFindings(
  store: InteractionStore,
  findings: Omit<KnowledgeEntry, 'id' | 'usageCount' | 'lastUsed' | 'createdAt'>,
  logger: ReturnType<typeof createHookLogger>
): Promise<string> {
  const entryId = `hook-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const now = Date.now();

  const entry: KnowledgeEntry = {
    id: entryId,
    ...findings,
    usageCount: 0,
    lastUsed: now,
    createdAt: now
  };

  logger.debug('Storing findings', {
    entryId,
    domain: entry.domain,
    tags: entry.tags
  });

  // Store entry
  store.addKnowledge(entry);

  // Save to disk
  await store.save();

  // Verify with read-back (GUARD-HKS-004)
  await verifyWrite(store, entryId, entry, logger);

  logger.info('Findings stored and verified', { entryId });

  return entryId;
}

/**
 * Verify write with read-back
 *
 * Implements: REQ-HKS-022
 */
async function verifyWrite(
  store: InteractionStore,
  entryId: string,
  original: KnowledgeEntry,
  logger: ReturnType<typeof createHookLogger>
): Promise<void> {
  // Query by domain to find the entry
  const entries = store.getKnowledgeByDomain(original.domain);
  const readBack = entries.find(e => e.id === entryId);

  if (!readBack) {
    throw new StorageError(
      `Write verification failed: entry ${entryId} not found in domain ${original.domain}`,
      { entryId, domain: original.domain }
    );
  }

  // Verify fields match
  if (readBack.domain !== original.domain) {
    throw new StorageError(
      `Write verification failed: domain mismatch (expected: ${original.domain}, got: ${readBack.domain})`,
      { entryId, expected: original.domain, actual: readBack.domain }
    );
  }

  // Verify tags (order-independent)
  const originalTags = new Set(original.tags || []);
  const readBackTags = new Set(readBack.tags || []);
  if (originalTags.size !== readBackTags.size ||
      ![...originalTags].every(t => readBackTags.has(t))) {
    throw new StorageError(
      `Write verification failed: tags mismatch`,
      { entryId, expected: original.tags, actual: readBack.tags }
    );
  }

  // Verify content hash
  const originalHash = crypto.createHash('sha256').update(original.content).digest('hex');
  const readBackHash = crypto.createHash('sha256').update(readBack.content).digest('hex');
  if (originalHash !== readBackHash) {
    throw new StorageError(
      `Write verification failed: content hash mismatch`,
      { entryId, expectedHash: originalHash.substring(0, 16), actualHash: readBackHash.substring(0, 16) }
    );
  }

  logger.debug('Write verification passed', { entryId });
}

// ==================== ReasoningBank Initialization ====================

/**
 * Initialize ReasoningBank
 */
async function initReasoningBank(config: IHookConfig, logger: ReturnType<typeof createHookLogger>): Promise<ReasoningBank> {
  try {
    // Import dynamically to handle potential initialization errors
    const reasoningBank = new ReasoningBank({
      verbose: config.verbose,
      maxPatterns: 1000,
      minConfidence: 0.3
    });

    await reasoningBank.initialize();
    logger.debug('ReasoningBank initialized');

    return reasoningBank;
  } catch (error) {
    logger.warn('ReasoningBank initialization failed (non-fatal)', {
      error: (error as Error).message
    });
    throw error;
  }
}

// ==================== Main Entry Point ====================

/**
 * Post-task hook main function
 */
async function main(): Promise<void> {
  const startTime = Date.now();

  // 1. Load configuration
  const config = await loadConfiguration();
  const logger = createHookLogger('post-task', config.verbose);

  logger.info('Post-task hook started');

  let interactionStore: InteractionStore | null = null;
  let reasoningBank: ReasoningBank | null = null;
  let storedEntryId: string | null = null;

  try {
    // 2. Read Task() output
    const output = await readTaskOutput();
    logger.debug('Task output read', { outputLength: output.length });

    // Handle empty output gracefully
    if (!output || output.trim() === '') {
      logger.warn('Empty task output - nothing to store');
      process.exit(EXIT_CODES.SUCCESS);
    }

    // 3. Initialize services with timeout
    interactionStore = await executeWithTimeout(
      () => initInteractionStore(config, logger),
      config.postTaskTimeoutMs / 2,
      'InteractionStore initialization'
    );

    // 4. Extract TASK COMPLETION SUMMARY
    const extractor = new OutputExtractor(config);
    const summary = extractor.extractSummary(output);

    if (summary) {
      logger.debug('Summary extracted', {
        whatIDid: summary.whatIDid.substring(0, 100),
        filesCreated: summary.filesCreated.length,
        filesModified: summary.filesModified.length,
        storeEntries: summary.interactionStoreEntries.length
      });
    } else {
      logger.warn('Summary extraction failed, continuing with heuristic data');
    }

    // 5. Parse findings
    const findings = extractor.parseFindings(summary || {
      whatIDid: '',
      filesCreated: [],
      filesModified: [],
      interactionStoreEntries: [],
      reasoningBankFeedback: null,
      nextAgentGuidance: ''
    }, output);

    // 6. Store findings in InteractionStore with verification
    storedEntryId = await executeWithTimeout(
      () => storeFindings(interactionStore!, findings, logger),
      config.postTaskTimeoutMs / 3,
      'Storage'
    );

    // 7. Initialize ReasoningBank for feedback (may fail)
    try {
      reasoningBank = await executeWithTimeout(
        () => initReasoningBank(config, logger),
        config.postTaskTimeoutMs / 4,
        'ReasoningBank initialization'
      );
    } catch (error) {
      logger.warn('ReasoningBank not available - feedback will be queued', {
        error: (error as Error).message
      });
    }

    // 8. Estimate quality and submit feedback
    if (reasoningBank) {
      const submitter = new FeedbackSubmitter(reasoningBank, config, '.claude/hooks');

      // Estimate quality
      const quality = submitter.estimateQuality(summary, output);
      const outcome = submitter.determineOutcome(quality);

      // Generate trajectory ID
      const trajectoryId = summary?.reasoningBankFeedback?.trajectoryId ||
        `hook-traj-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Submit with retry queue
      const submitted = await submitter.submitWithRetry(trajectoryId, quality, outcome, {
        entryId: storedEntryId,
        domain: findings.domain,
        tags: findings.tags
      });

      logger.info('Feedback processed', {
        trajectoryId,
        quality,
        outcome,
        submittedImmediately: submitted
      });

      // 9. Process retry queue (non-blocking)
      submitter.processRetryQueue().catch(error => {
        logger.warn('Retry queue processing failed', {
          error: (error as Error).message
        });
      });
    } else {
      logger.warn('Skipping feedback - ReasoningBank not available');
    }

    // 9.5. Complete pipeline step if in pipeline context (non-blocking)
    completePipelineStep().catch(err => {
      logger.debug('Pipeline step completion skipped', { error: (err as Error).message });
    });

    // 10. Log performance metrics
    const duration = Date.now() - startTime;
    logger.info('Post-task hook completed', {
      duration,
      storedEntryId,
      domain: findings.domain,
      hasSummary: summary !== null
    });

    // Exit successfully
    process.exit(EXIT_CODES.SUCCESS);

  } catch (error) {
    const hookError = createHookError(
      'post-task',
      error instanceof TimeoutError ? 'timeout' :
      error instanceof StorageError ? 'storage' :
      error instanceof ValidationError ? 'validation' :
      'execution',
      error as Error,
      {
        duration: Date.now() - startTime,
        storedEntryId
      },
      error instanceof TimeoutError ? EXIT_CODES.TIMEOUT :
      error instanceof StorageError ? EXIT_CODES.ERROR :
      EXIT_CODES.ERROR
    );

    // Log error and exit (never returns)
    logErrorAndExit(hookError);
  }
}

// Run main
main().catch(error => {
  // Final catch - should never reach here
  console.error('[post-task] FATAL: Unhandled error:', error);
  process.exit(EXIT_CODES.ERROR);
});
