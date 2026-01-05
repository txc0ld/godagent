#!/usr/bin/env node
/**
 * Universal Self-Learning God Agent CLI
 *
 * Usage:
 *   npx tsx src/god-agent/universal/cli.ts ask "How do I..."
 *   npx tsx src/god-agent/universal/cli.ts code "Implement a..."
 *   npx tsx src/god-agent/universal/cli.ts research "What is..."
 *   npx tsx src/god-agent/universal/cli.ts write "Essay about..."
 *   npx tsx src/god-agent/universal/cli.ts learn "Knowledge" --domain "patterns" --category "fact"
 *   npx tsx src/god-agent/universal/cli.ts learn --file ./learnings.md --domain "docs"
 *   npx tsx src/god-agent/universal/cli.ts feedback <id> <rating> --notes "Success"
 *   npx tsx src/god-agent/universal/cli.ts query --domain "project/api" --tags "schema"
 *   npx tsx src/god-agent/universal/cli.ts status
 */

import { UniversalAgent, type ICodeTaskPreparation, type IWriteTaskPreparation } from './universal-agent.js';
import { promises as fs } from 'fs';
import * as path from 'path';

// Import hook registry for standalone mode initialization (TASK-HOOK-008)
import {
  getHookRegistry,
  registerRequiredHooks,
  setDescServiceGetter,
  setSonaEngineGetter
} from '../core/hooks/index.js';

// ==================== JSON Output Types (DAI-002) ====================

/**
 * JSON output format for CLI commands.
 * Used when --json flag is provided.
 *
 * @example
 * ```typescript
 * npx tsx src/god-agent/universal/cli.ts ask "How do I..." --json
 * // Outputs:
 * // {
 * //   "command": "ask",
 * //   "selectedAgent": "assistant",
 * //   "prompt": "How do I...",
 * //   "isPipeline": false,
 * //   "result": { ... },
 * //   "success": true
 * // }
 * ```
 */
export interface ICLIJsonOutput {
  /** Command that was executed */
  command: string;
  /** Agent that was selected for execution (DAI-001 integration) */
  selectedAgent: string;
  /** Prompt/input that was provided */
  prompt: string;
  /** Whether this is a multi-agent pipeline task */
  isPipeline: boolean;
  /** Command-specific result data */
  result: unknown;
  /** Whether command succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Trajectory ID for feedback (if applicable) */
  trajectoryId?: string;
  /** Quality score from the response (0-1 range) */
  qualityScore?: number;
}

// ==================== Argument Parsing ====================

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Parse CLI arguments into structured format
 * Supports: --flag value, --flag=value, -f value, --boolean-flag
 */
function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const command = args[0] || '';
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 1;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      if (val !== undefined) {
        flags[key] = val;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
    i++;
  }

  return { command, positional, flags };
}

/**
 * Get flag value with short/long aliases
 */
function getFlag(flags: Record<string, string | boolean>, ...names: string[]): string | boolean | undefined {
  for (const name of names) {
    if (flags[name] !== undefined) return flags[name];
  }
  return undefined;
}

/**
 * Output result as JSON (DAI-002: FR-016)
 */
function outputJson(output: ICLIJsonOutput): void {
  console.log(JSON.stringify(output, null, 2));
}

/**
 * Detect if task requires multi-agent pipeline (heuristic)
 */
function isPipelineTask(input: string): boolean {
  // Heuristics for multi-step tasks that benefit from pipeline execution
  const pipelineIndicators = [
    /implement.*and.*test/i,
    /create.*with.*validation/i,
    /build.*complete/i,
    /full.*implementation/i,
    /end.to.end/i,
    /multi.step/i,
    /comprehensive/i,
    /including.*tests/i,
  ];
  return pipelineIndicators.some(pattern => pattern.test(input));
}

/**
 * Get selected agent based on command type (DAI-001 integration)
 */
function getSelectedAgent(command: string): string {
  const agentMap: Record<string, string> = {
    ask: 'god-ask',
    a: 'god-ask',
    code: 'god-code',
    c: 'god-code',
    research: 'god-research',
    r: 'god-research',
    write: 'god-write',
    w: 'god-write',
    status: 'status-agent',
    s: 'status-agent',
    learn: 'learn-agent',
    l: 'learn-agent',
    feedback: 'feedback-agent',
    f: 'feedback-agent',
    query: 'query-agent',
    q: 'query-agent',
  };
  return agentMap[command.toLowerCase()] || 'unknown';
}

/**
 * Initialize hooks for CLI standalone mode
 *
 * TASK-HOOK-008: Idempotent hook registration for CLI standalone execution.
 * When the daemon is not available, the CLI must register hooks itself.
 * This function is idempotent - safe to call multiple times.
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-032: All hooks MUST be registered at daemon startup
 * - GAP-ADV-HOOK-003: CLI standalone execution must also register hooks
 *
 * @param verbose - Whether to log hook registration messages
 */
function initializeCliHooks(verbose: boolean): void {
  const hookRegistry = getHookRegistry();

  // Idempotent check - don't double-register if daemon already did it
  if (hookRegistry.isInitialized()) {
    if (verbose) {
      console.log('[CLI] Hooks already initialized (daemon mode)');
    }
    return;
  }

  // Register all required hooks for standalone mode
  registerRequiredHooks();

  // Wire service getters to null - no daemon = no DESC service available
  // The hooks will gracefully handle null services
  setDescServiceGetter(() => null);
  setSonaEngineGetter(() => null);

  // Initialize the registry
  hookRegistry.initialize();

  if (verbose) {
    const counts = hookRegistry.getHookCount();
    console.log(`[CLI] Hooks registered (standalone mode): ${counts.total} hooks`);
  }
}

async function main() {
  const { command, positional, flags } = parseArgs(process.argv);
  const input = positional.join(' ');
  const jsonMode = getFlag(flags, 'json', 'j') === true;

  // TASK-HOOK-008: Initialize hooks for CLI standalone mode (idempotent)
  // This ensures hooks work even when CLI runs standalone without daemon
  initializeCliHooks(!jsonMode);

  if (!command) {
    if (jsonMode) {
      outputJson({
        command: 'help',
        selectedAgent: 'help-agent',
        prompt: '',
        isPipeline: false,
        result: { message: 'No command provided. Use --help for usage.' },
        success: false,
        error: 'No command provided',
      });
    } else {
      printHelp();
    }
    process.exit(0);
  }

  // Suppress verbose output in JSON mode
  const agent = new UniversalAgent({ verbose: !jsonMode });

  try {
    await agent.initialize();

    switch (command.toLowerCase()) {
      case 'ask':
      case 'a':
        if (!input) {
          if (jsonMode) {
            outputJson({
              command: 'ask',
              selectedAgent: getSelectedAgent(command),
              prompt: '',
              isPipeline: false,
              result: null,
              success: false,
              error: 'No input provided',
            });
          } else {
            console.error('Error: Please provide input text');
          }
          process.exit(1);
        }
        // TASK-GODASK-001: Use returnResult to get trajectoryId for feedback tracking
        const askResult = await agent.ask(input, { returnResult: true });
        if (jsonMode) {
          outputJson({
            command: 'ask',
            selectedAgent: askResult.selectedAgent ?? getSelectedAgent(command),
            prompt: input,
            isPipeline: isPipelineTask(input),
            result: { response: askResult.output },
            success: true,
            trajectoryId: askResult.trajectoryId,
            qualityScore: askResult.qualityScore,
          });
        } else {
          console.log('\n--- Response ---\n');
          console.log(askResult.output);
          if (askResult.trajectoryId) {
            console.log(`\nTrajectory: ${askResult.trajectoryId}`);
            console.log(`Provide feedback: npx tsx src/god-agent/universal/cli.ts feedback ${askResult.trajectoryId} <rating> --trajectory`);
          }
        }
        break;

      case 'code':
      case 'c': {
        // TASK-GODCODE-001: Two-phase execution model
        // Implements [REQ-GODCODE-001]: CLI does NOT attempt task execution
        // Implements [REQ-GODCODE-002]: CLI returns builtPrompt in JSON
        // Implements [REQ-GODCODE-006]: CLI exits immediately after JSON output
        if (!input) {
          if (jsonMode) {
            outputJson({
              command: 'code',
              selectedAgent: getSelectedAgent(command),
              prompt: '',
              isPipeline: false,
              result: null,
              success: false,
              error: 'No coding task provided',
            });
          } else {
            console.error('Error: Please provide coding task');
          }
          process.exit(1);
        }

        // Check for --execute flag for backward compatibility
        const executeFlag = getFlag(flags, 'execute', 'e') === true;

        if (executeFlag) {
          // Legacy behavior: Full execution via agent.code()
          const codeResult = await agent.code(input);
          if (jsonMode) {
            outputJson({
              command: 'code',
              selectedAgent: getSelectedAgent(command),
              prompt: input,
              isPipeline: isPipelineTask(input),
              result: {
                code: codeResult.code,
                language: codeResult.language,
                patternsUsed: codeResult.patterns_used.length,
                learned: codeResult.learned,
              },
              success: true,
              trajectoryId: codeResult.trajectoryId,
            });
          } else {
            console.log('\n--- Generated Code ---\n');
            console.log(codeResult.code);
            console.log('\n--- Details ---');
            console.log(`Language: ${codeResult.language}`);
            console.log(`Patterns used: ${codeResult.patterns_used.length}`);
            console.log(`Learned: ${codeResult.learned}`);
            if (codeResult.trajectoryId) {
              console.log(`Trajectory: ${codeResult.trajectoryId}`);
              console.log(`\nProvide feedback: npx tsx src/god-agent/universal/cli.ts feedback ${codeResult.trajectoryId} <rating>`);
            }
          }
        } else {
          // Implements [REQ-GODCODE-001]: New two-phase behavior (default)
          // Phase 1: Prepare task (agent selection, DESC injection, prompt building)
          // Phase 2: Skill executes Task() with builtPrompt
          const languageFlag = getFlag(flags, 'language', 'l') as string | undefined;
          const preparation = await agent.prepareCodeTask(input, { language: languageFlag });

          // Implements [REQ-GODCODE-002]: Output structured JSON with builtPrompt
          if (jsonMode) {
            // Machine-readable output for skill consumption
            outputJson({
              command: 'code',
              selectedAgent: preparation.selectedAgent,
              prompt: input,
              isPipeline: preparation.isPipeline,
              result: {
                // Implements [REQ-GODCODE-002]: builtPrompt field
                builtPrompt: preparation.builtPrompt,
                // Implements [REQ-GODCODE-003]: agentType for Task()
                agentType: preparation.agentType,
                agentCategory: preparation.agentCategory,
                descContext: preparation.descContext,
                memoryContext: preparation.memoryContext,
                language: preparation.language,
                pipeline: preparation.pipeline,
              },
              success: true,
              trajectoryId: preparation.trajectoryId ?? undefined,
            });
          } else {
            // Human-readable output
            console.log('\n--- Code Task Preparation ---\n');
            console.log(`Task: ${input}`);
            console.log(`Selected Agent: ${preparation.selectedAgent}`);
            console.log(`Agent Type: ${preparation.agentType}`);
            console.log(`Agent Category: ${preparation.agentCategory}`);
            console.log(`Pipeline: ${preparation.isPipeline}`);
            if (preparation.descContext) {
              console.log(`DESC Context: ${preparation.descContext.substring(0, 100)}...`);
            }
            if (preparation.trajectoryId) {
              console.log(`Trajectory: ${preparation.trajectoryId}`);
            }
            console.log('\n--- Built Prompt ---\n');
            console.log(preparation.builtPrompt);
            console.log('\n--- Execution Instructions ---');
            console.log('Execute via Task() in /god-code skill with:');
            console.log(`  agentType: "${preparation.agentType}"`);
            console.log(`  prompt: [builtPrompt above]`);
          }
        }

        // Implements [REQ-GODCODE-006]: Shutdown and exit immediately
        await agent.shutdown();
        process.exit(0);
      }

      case 'research':
      case 'r':
        if (!input) {
          if (jsonMode) {
            outputJson({
              command: 'research',
              selectedAgent: getSelectedAgent(command),
              prompt: '',
              isPipeline: false,
              result: null,
              success: false,
              error: 'No research query provided',
            });
          } else {
            console.error('Error: Please provide research query');
          }
          process.exit(1);
        }
        const researchResult = await agent.research(input, { depth: 'deep' });
        if (jsonMode) {
          outputJson({
            command: 'research',
            selectedAgent: getSelectedAgent(command),
            prompt: input,
            isPipeline: isPipelineTask(input),
            result: {
              synthesis: researchResult.synthesis,
              findingsCount: researchResult.findings.length,
              knowledgeStored: researchResult.knowledgeStored,
            },
            success: true,
          });
        } else {
          console.log('\n--- Research Results ---\n');
          console.log(researchResult.synthesis);
          console.log(`\nFindings: ${researchResult.findings.length}`);
          console.log(`Knowledge stored: ${researchResult.knowledgeStored}`);
        }
        break;

      case 'write':
      case 'w': {
        // TASK-GODWRITE-001: Two-phase execution model
        // Implements [REQ-GODWRITE-001]: CLI does NOT attempt task execution
        // Implements [REQ-GODWRITE-002]: CLI returns builtPrompt in JSON
        // Implements [REQ-GODWRITE-006]: CLI exits immediately after JSON output
        if (!input) {
          if (jsonMode) {
            outputJson({
              command: 'write',
              selectedAgent: getSelectedAgent(command),
              prompt: '',
              isPipeline: false,
              result: null,
              success: false,
              error: 'No topic provided',
            });
          } else {
            console.error('Error: Please provide topic');
          }
          process.exit(1);
        }

        // Parse writing options from flags
        const style = getFlag(flags, 'style', 's') as 'academic' | 'professional' | 'casual' | 'technical' | undefined;
        const length = getFlag(flags, 'length', 'l') as 'short' | 'medium' | 'long' | 'comprehensive' | undefined;
        const format = getFlag(flags, 'format', 'f') as 'essay' | 'report' | 'article' | 'paper' | undefined;
        const styleProfileId = getFlag(flags, 'style-profile', 'p') as string | undefined;

        // Check for --execute flag for backward compatibility
        // Implements [REQ-GODWRITE-011]: Backward compatibility with --execute flag
        const executeFlag = getFlag(flags, 'execute', 'e') === true;

        if (executeFlag) {
          // Legacy behavior: Full execution via agent.write()
          const writeResult = await agent.write(input, { style, length, format, styleProfileId });
          if (jsonMode) {
            outputJson({
              command: 'write',
              selectedAgent: getSelectedAgent(command),
              prompt: input,
              isPipeline: isPipelineTask(input),
              result: {
                content: writeResult.content,
                style: writeResult.style,
                wordCount: writeResult.wordCount,
                sourcesCount: writeResult.sources.length,
              },
              success: true,
              trajectoryId: writeResult.trajectoryId,
            });
          } else {
            console.log('\n--- Generated Content ---\n');
            console.log(writeResult.content);
            console.log(`\n--- Details ---`);
            console.log(`Style: ${writeResult.style}`);
            console.log(`Word count: ${writeResult.wordCount}`);
            console.log(`Sources: ${writeResult.sources.length}`);
            if (writeResult.trajectoryId) {
              console.log(`Trajectory: ${writeResult.trajectoryId}`);
              console.log(`\nProvide feedback: npx tsx src/god-agent/universal/cli.ts feedback ${writeResult.trajectoryId} <rating> --trajectory`);
            }
          }
        } else {
          // Implements [REQ-GODWRITE-001]: New two-phase behavior (default)
          // Phase 1: Prepare task (agent selection, DESC injection, prompt building)
          // Phase 2: Skill executes Task() with builtPrompt
          const preparation = await agent.prepareWriteTask(input, {
            style,
            length,
            format,
            styleProfileId,
          });

          // Implements [REQ-GODWRITE-002]: Output structured JSON with builtPrompt
          if (jsonMode) {
            // Machine-readable output for skill consumption
            outputJson({
              command: 'write',
              selectedAgent: preparation.selectedAgent,
              prompt: input,
              isPipeline: preparation.isPipeline,
              result: {
                // Implements [REQ-GODWRITE-002]: builtPrompt field
                builtPrompt: preparation.builtPrompt,
                // Implements [REQ-GODWRITE-003]: agentType for Task()
                agentType: preparation.agentType,
                agentCategory: preparation.agentCategory,
                style: preparation.style,
                format: preparation.format,
                length: preparation.length,
                styleProfileId: preparation.styleProfileId,
                styleProfileApplied: preparation.styleProfileApplied,
                descContext: preparation.descContext,
                memoryContext: preparation.memoryContext,
                pipeline: preparation.pipeline,
              },
              success: true,
              trajectoryId: preparation.trajectoryId ?? undefined,
            });
          } else {
            // Human-readable output
            console.log('\n--- Write Task Preparation ---\n');
            console.log(`Topic: ${input}`);
            console.log(`Selected Agent: ${preparation.selectedAgent}`);
            console.log(`Agent Type: ${preparation.agentType}`);
            console.log(`Agent Category: ${preparation.agentCategory}`);
            console.log(`Style: ${preparation.style}`);
            console.log(`Format: ${preparation.format}`);
            console.log(`Length: ${preparation.length}`);
            console.log(`Pipeline: ${preparation.isPipeline}`);
            if (preparation.styleProfileApplied) {
              console.log(`Style Profile Applied: ${preparation.styleProfileId ?? 'active'}`);
            }
            if (preparation.descContext) {
              console.log(`DESC Context: ${preparation.descContext.substring(0, 100)}...`);
            }
            if (preparation.trajectoryId) {
              console.log(`Trajectory: ${preparation.trajectoryId}`);
            }
            console.log('\n--- Built Prompt ---\n');
            console.log(preparation.builtPrompt);
            console.log('\n--- Execution Instructions ---');
            console.log('Execute via Task() in /god-write skill with:');
            console.log(`  agentType: "${preparation.agentType}"`);
            console.log(`  prompt: [builtPrompt above]`);
          }
        }

        // Implements [REQ-GODWRITE-006]: Shutdown and exit immediately
        await agent.shutdown();
        process.exit(0);
      }

      case 'status':
      case 's': {
        const status = agent.getStatus();
        const stats = agent.getStats();
        if (jsonMode) {
          outputJson({
            command: 'status',
            selectedAgent: getSelectedAgent(command),
            prompt: '',
            isPipeline: false,
            result: {
              initialized: status.initialized,
              runtime: status.runtime,
              health: status.health,
              stats: {
                totalInteractions: stats.totalInteractions,
                knowledgeEntries: stats.knowledgeEntries,
                domainExpertise: stats.domainExpertise,
              },
            },
            success: true,
          });
        } else {
          console.log('\n--- Universal Agent Status ---\n');
          console.log(`Initialized: ${status.initialized}`);
          console.log(`Runtime: ${status.runtime}`);
          console.log(`Health: ${JSON.stringify(status.health)}`);
          console.log('\n--- Learning Stats ---\n');
          console.log(`Total interactions: ${stats.totalInteractions}`);
          console.log(`Knowledge entries: ${stats.knowledgeEntries}`);
          console.log(`Domain expertise: ${JSON.stringify(stats.domainExpertise)}`);
        }
        break;
      }

      case 'feedback':
      case 'f': {
        const id = positional[0];
        const rating = positional[1];
        const notes = getFlag(flags, 'notes', 'n') as string | undefined;
        const isTrajectory = getFlag(flags, 'trajectory', 't') !== undefined;

        if (!id || !rating) {
          if (jsonMode) {
            outputJson({
              command: 'feedback',
              selectedAgent: getSelectedAgent(command),
              prompt: '',
              isPipeline: false,
              result: null,
              success: false,
              error: 'ID and rating required',
            });
          } else {
            console.error('Error: Please provide ID and rating (0-1)');
            console.error('Usage: feedback <id> <rating> [--notes "..."] [--trajectory]');
          }
          process.exit(1);
        }

        const feedbackResult = await agent.feedback(id, parseFloat(rating), {
          notes,
          isTrajectoryId: isTrajectory,
        });
        if (jsonMode) {
          outputJson({
            command: 'feedback',
            selectedAgent: getSelectedAgent(command),
            prompt: `${id} ${rating}`,
            isPipeline: false,
            result: {
              id,
              rating: parseFloat(rating),
              notes,
              weightUpdates: feedbackResult.weightUpdates,
              patternCreated: feedbackResult.patternCreated,
            },
            success: true,
          });
        } else {
          console.log(`\n--- Feedback Recorded ---`);
          console.log(`ID: ${id}`);
          console.log(`Rating: ${rating}`);
          if (notes) console.log(`Notes: ${notes}`);
          console.log(`Weight updates: ${feedbackResult.weightUpdates}`);
          console.log(`Pattern created: ${feedbackResult.patternCreated}`);
        }
        break;
      }

      case 'learn':
      case 'l': {
        // Get content from positional args OR file
        const fileArg = getFlag(flags, 'file') as string | undefined;
        let content: string;

        if (fileArg) {
          // Read from file
          const filePath = path.resolve(fileArg);
          try {
            content = await fs.readFile(filePath, 'utf-8');
            if (!jsonMode) console.log(`Reading from: ${filePath}`);
          } catch (err) {
            if (jsonMode) {
              outputJson({
                command: 'learn',
                selectedAgent: getSelectedAgent(command),
                prompt: '',
                isPipeline: false,
                result: null,
                success: false,
                error: `Error reading file: ${filePath}`,
              });
            } else {
              console.error(`Error reading file: ${filePath}`);
            }
            process.exit(1);
          }
        } else if (input) {
          content = input;
        } else {
          if (jsonMode) {
            outputJson({
              command: 'learn',
              selectedAgent: getSelectedAgent(command),
              prompt: '',
              isPipeline: false,
              result: null,
              success: false,
              error: 'No content provided',
            });
          } else {
            console.error('Error: Please provide knowledge content or --file path');
            console.error('Usage: learn "content" [--domain name] [--category type] [--tags a,b,c]');
            console.error('       learn --file ./file.md [--domain name] [--category type]');
          }
          process.exit(1);
        }

        // Get metadata options
        const domain = (getFlag(flags, 'domain', 'd') as string) || 'general';
        const category = (getFlag(flags, 'category', 'c') as string) || 'fact';
        const tagsStr = getFlag(flags, 'tags', 't') as string | undefined;
        const tags = tagsStr
          ? tagsStr.split(',').map(t => t.trim())
          : content.split(' ').filter(w => w.length > 4 && !w.includes('/') && !w.includes('.')).slice(0, 5);

        const id = await agent.storeKnowledge({
          content,
          type: category as 'fact' | 'pattern' | 'procedure' | 'example' | 'insight',
          domain,
          tags,
        });

        if (jsonMode) {
          outputJson({
            command: 'learn',
            selectedAgent: getSelectedAgent(command),
            prompt: content.slice(0, 100),
            isPipeline: false,
            result: {
              id,
              domain,
              category,
              tags,
              contentLength: content.length,
            },
            success: true,
          });
        } else {
          console.log(`\n--- Knowledge Stored ---`);
          console.log(`ID: ${id}`);
          console.log(`Domain: ${domain}`);
          console.log(`Category: ${category}`);
          console.log(`Tags: ${tags.join(', ')}`);
          console.log(`Content length: ${content.length} chars`);
        }
        break;
      }

      case 'query':
      case 'q': {
        const queryDomain = getFlag(flags, 'domain', 'd') as string | undefined;
        const tagsStr = getFlag(flags, 'tags', 't') as string | undefined;
        const limit = parseInt((getFlag(flags, 'limit', 'n') as string) || '10', 10);

        if (!queryDomain) {
          if (jsonMode) {
            outputJson({
              command: 'query',
              selectedAgent: getSelectedAgent(command),
              prompt: '',
              isPipeline: false,
              result: null,
              success: false,
              error: '--domain required',
            });
          } else {
            console.error('Error: Please provide --domain');
            console.error('Usage: query --domain "project/api" [--tags "schema,api"] [--limit 10]');
          }
          process.exit(1);
        }

        // Access InteractionStore directly for queries
        const interactionStore = (agent as any).interactionStore;
        if (!interactionStore) {
          if (jsonMode) {
            outputJson({
              command: 'query',
              selectedAgent: getSelectedAgent(command),
              prompt: queryDomain,
              isPipeline: false,
              result: null,
              success: false,
              error: 'InteractionStore not available',
            });
          } else {
            console.error('Error: InteractionStore not available');
          }
          process.exit(1);
        }

        let results = interactionStore.getKnowledgeByDomain(queryDomain);

        // Filter by tags if provided
        if (tagsStr) {
          const filterTags = tagsStr.split(',').map(t => t.trim());
          results = results.filter((k: any) =>
            k.tags?.some((t: string) => filterTags.includes(t))
          );
        }

        // Limit results
        results = results.slice(0, limit);

        if (jsonMode) {
          outputJson({
            command: 'query',
            selectedAgent: getSelectedAgent(command),
            prompt: queryDomain,
            isPipeline: false,
            result: {
              domain: queryDomain,
              tagsFilter: tagsStr || null,
              count: results.length,
              entries: results.map((e: any) => ({
                id: e.id,
                category: e.category,
                tags: e.tags,
                contentPreview: e.content.slice(0, 200),
              })),
            },
            success: true,
          });
        } else {
          console.log(`\n--- Query Results ---`);
          console.log(`Domain: ${queryDomain}`);
          if (tagsStr) console.log(`Tags filter: ${tagsStr}`);
          console.log(`Found: ${results.length} entries\n`);

          for (const entry of results) {
            console.log(`[${entry.id}] (${entry.category})`);
            console.log(`  Tags: ${entry.tags?.join(', ') || 'none'}`);
            console.log(`  Content: ${entry.content.slice(0, 100)}${entry.content.length > 100 ? '...' : ''}`);
            console.log();
          }
        }
        break;
      }

      case 'help':
      case 'h':
      case '--help':
      case '-h':
        if (jsonMode) {
          outputJson({
            command: 'help',
            selectedAgent: 'help-agent',
            prompt: '',
            isPipeline: false,
            result: {
              commands: ['ask', 'code', 'research', 'write', 'status', 'learn', 'feedback', 'query', 'help'],
              usage: 'npx tsx src/god-agent/universal/cli.ts <command> [input] [options]',
            },
            success: true,
          });
        } else {
          printHelp();
        }
        break;

      default:
        if (jsonMode) {
          outputJson({
            command,
            selectedAgent: 'unknown',
            prompt: input,
            isPipeline: false,
            result: null,
            success: false,
            error: `Unknown command: ${command}`,
          });
        } else {
          console.error(`Unknown command: ${command}`);
          printHelp();
        }
        process.exit(1);
    }

    await agent.shutdown();

    // Explicitly exit to ensure all timers/handles are cleaned up
    process.exit(0);
  } catch (error) {
    if (jsonMode) {
      outputJson({
        command,
        selectedAgent: getSelectedAgent(command),
        prompt: input,
        isPipeline: false,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      console.error('Error:', error);
    }
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          Universal Self-Learning God Agent CLI                   ║
╚══════════════════════════════════════════════════════════════════╝

USAGE:
  npx tsx src/god-agent/universal/cli.ts <command> [input] [options]

COMMANDS:
  ask, a      <text>                    Ask anything - auto-detects mode
  code, c     <task>                    Generate code with pattern learning
  research, r <query>                   Research a topic deeply
  write, w    <topic> [options]         Write documents/articles/papers
  status, s                             Show agent status and learning stats
  learn, l    <content> [options]       Store knowledge (text or file)
  feedback, f <id> <rating> [options]   Provide feedback (0-1) for learning
  query, q    --domain <name> [options] Query stored knowledge
  help, h                               Show this help

LEARN OPTIONS:
  --file, -f <path>      Read content from file (markdown, text, etc.)
  --domain, -d <name>    Domain namespace (default: "general")
  --category, -c <type>  Category: fact, pattern, experience, concept
  --tags, -t <a,b,c>     Comma-separated tags for filtering

FEEDBACK OPTIONS:
  --notes, -n <text>     Additional notes about the feedback
  --trajectory, -t       ID is a trajectory ID (not interaction ID)

QUERY OPTIONS:
  --domain, -d <name>    Domain to query (required)
  --tags, -t <a,b,c>     Filter by tags (comma-separated)
  --limit, -n <num>      Max results (default: 10)

WRITE OPTIONS:
  --style, -s <type>     academic, professional, casual, technical
  --length, -l <size>    short, medium, long, comprehensive
  --format, -f <type>    essay, report, article, paper
  --style-profile, -p <id>  Style profile ID for learned writing styles
  --execute, -e          Execute full write (legacy mode, bypasses two-phase)

GLOBAL OPTIONS:
  --json, -j             Output results as JSON (DAI-002: machine-readable)
                         JSON includes: command, selectedAgent, prompt, isPipeline, result, success

EXAMPLES:
  # Store knowledge directly
  npx tsx src/god-agent/universal/cli.ts learn "REST APIs should use proper HTTP status codes"

  # Store knowledge with metadata
  npx tsx src/god-agent/universal/cli.ts learn "Factory pattern enables..." -d "patterns" -c "pattern" -t "design,factory"

  # Store knowledge from file
  npx tsx src/god-agent/universal/cli.ts learn -f ./docs/learnings.md -d "project/docs" -c "fact"

  # Provide feedback with notes
  npx tsx src/god-agent/universal/cli.ts feedback abc123 0.95 --notes "Implementation successful"

  # Query stored knowledge
  npx tsx src/god-agent/universal/cli.ts query -d "project/api" -t "schema" -n 5

  # Generate code (outputs trajectory ID for feedback)
  npx tsx src/god-agent/universal/cli.ts code "Implement a cache with LRU eviction"

  # Write with options
  npx tsx src/god-agent/universal/cli.ts write "Machine Learning" --style academic --format paper

  # Check status
  npx tsx src/god-agent/universal/cli.ts status

  # Get JSON output for machine processing (DAI-002)
  npx tsx src/god-agent/universal/cli.ts status --json
  npx tsx src/god-agent/universal/cli.ts code "Implement a linked list" --json

SELF-LEARNING:
  The agent automatically learns from every interaction:
  - Successful patterns are reinforced via feedback
  - Knowledge accumulates in InteractionStore
  - Domain expertise grows with usage
  - ReasoningBank improves pattern matching

DOMAIN CONVENTIONS:
  project/events      Event schemas and structures
  project/api         API contracts and endpoints
  project/frontend    Frontend components and patterns
  project/database    Database schemas
  project/tests       Test documentation
  project/docs        General documentation
  patterns            Reusable implementation patterns
  general             Uncategorized knowledge

`);
}

main().catch(console.error);
