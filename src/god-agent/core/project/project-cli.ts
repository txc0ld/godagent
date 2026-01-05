#!/usr/bin/env node
/**
 * Project Initialization CLI
 * 
 * Intelligent project scaffolding based on user intent.
 * 
 * Usage:
 *   npx tsx src/god-agent/core/project/project-cli.ts init "Build an e-commerce API"
 *   npx tsx src/god-agent/core/project/project-cli.ts analyze "Create a user auth system"
 *   npx tsx src/god-agent/core/project/project-cli.ts init "Research ML best practices" --root ./my-project
 */

import { ProjectDetector } from './project-detector.js';
import { ProjectScaffolder } from './project-scaffolder.js';
import * as path from 'path';
import * as readline from 'readline';

// ==================== Types ====================

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

interface IProjectInitOutput {
  command: string;
  success: boolean;
  projectId?: string;
  projectType?: string;
  analysis?: unknown;
  scaffoldResult?: unknown;
  error?: string;
}

// ==================== Argument Parsing ====================

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

function getFlag(flags: Record<string, string | boolean>, ...names: string[]): string | boolean | undefined {
  for (const name of names) {
    if (flags[name] !== undefined) return flags[name];
  }
  return undefined;
}

// ==================== Interactive Prompts ====================

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirmAction(message: string): Promise<boolean> {
  const answer = await promptUser(`${message} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

// ==================== Commands ====================

async function analyzeCommand(
  input: string,
  jsonMode: boolean
): Promise<void> {
  const detector = new ProjectDetector();
  const analysis = detector.analyze(input);

  if (jsonMode) {
    const output: IProjectInitOutput = {
      command: 'analyze',
      success: true,
      projectType: analysis.type,
      analysis,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              PROJECT ANALYSIS RESULTS                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log(`📋 Input: "${input.substring(0, 60)}${input.length > 60 ? '...' : ''}"`);
    console.log('');
    console.log('── Detection Results ──────────────────────────────────────────');
    console.log(`  Type:        ${analysis.type.toUpperCase()}`);
    console.log(`  Confidence:  ${(analysis.confidence * 100).toFixed(1)}%`);
    console.log(`  Domain:      ${analysis.domain}`);
    console.log(`  Complexity:  ${analysis.complexity}`);
    console.log(`  Name:        ${analysis.suggestedName}`);
    console.log('');
    console.log('── Detected Features ──────────────────────────────────────────');
    if (analysis.detectedFeatures.length > 0) {
      analysis.detectedFeatures.forEach((f) => console.log(`  • ${f}`));
    } else {
      console.log('  (none detected)');
    }
    console.log('');
    console.log('── Infrastructure Requirements ────────────────────────────────');
    const infra = analysis.infrastructure;
    console.log(`  PRD:              ${infra.needsPRD ? '✓' : '✗'}`);
    console.log(`  Functional Spec:  ${infra.needsSpec ? '✓' : '✗'}`);
    console.log(`  Technical Spec:   ${infra.needsTech ? '✓' : '✗'}`);
    console.log(`  Task Plan:        ${infra.needsTasks ? '✓' : '✗'}`);
    console.log(`  Constitution:     ${infra.needsConstitution ? '✓' : '✗'}`);
    console.log(`  AI Tracking:      ${infra.needsAITracking ? '✓' : '✗'}`);
    console.log(`  Claude Flow:      ${infra.needsClaudeFlow ? '✓' : '✗'}`);
    console.log(`  Research Pipeline:${infra.needsResearchPipeline ? '✓' : '✗'}`);
    console.log('');
    console.log('── Orchestration ──────────────────────────────────────────────');
    console.log(`  Estimated Agents: ${infra.estimatedAgents}`);
    console.log(`  Topology:         ${infra.topology}`);
    console.log('');

    if (analysis.needsScaffolding) {
      console.log('💡 This task requires project scaffolding.');
      console.log('   Run: npx tsx src/god-agent/core/project/project-cli.ts init "your task"');
    } else {
      console.log('ℹ️  This task does not require full project scaffolding.');
      console.log('   You can proceed directly with the task.');
    }
  }
}

async function initCommand(
  input: string,
  projectRoot: string,
  jsonMode: boolean,
  autoConfirm: boolean
): Promise<void> {
  const detector = new ProjectDetector();
  const scaffolder = new ProjectScaffolder();

  // Analyze input
  const analysis = detector.analyze(input);

  if (!jsonMode) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              PROJECT INITIALIZATION                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log(`📋 Task: "${input.substring(0, 60)}${input.length > 60 ? '...' : ''}"`);
    console.log('');
    console.log('── Analysis ───────────────────────────────────────────────────');
    console.log(`  Type:        ${analysis.type.toUpperCase()}`);
    console.log(`  Complexity:  ${analysis.complexity}`);
    console.log(`  Name:        ${analysis.suggestedName}`);
    console.log(`  Location:    ${projectRoot}`);
    console.log('');
  }

  if (!analysis.needsScaffolding) {
    if (jsonMode) {
      const output: IProjectInitOutput = {
        command: 'init',
        success: false,
        projectType: analysis.type,
        error: 'Task does not require scaffolding. Use ask/code/research command directly.',
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log('ℹ️  This task does not require project scaffolding.');
      console.log('   You can proceed directly with:');
      console.log(`   npx tsx src/god-agent/universal/cli.ts ${analysis.domain === 'research' ? 'research' : analysis.domain === 'writing' ? 'write' : 'ask'} "${input}"`);
    }
    return;
  }

  // Show what will be created
  if (!jsonMode) {
    console.log('── Files to Create ────────────────────────────────────────────');
    const infra = analysis.infrastructure;
    if (infra.needsPRD) console.log('  📄 PRD (Product Requirements Document)');
    if (infra.needsSpec) console.log('  📄 SPEC (Functional Specification)');
    if (infra.needsTech) console.log('  📄 TECH (Technical Specification)');
    if (infra.needsTasks) console.log('  📄 TASKS (Task Implementation Plan)');
    if (infra.needsConstitution) console.log('  📄 CONSTITUTION (Project Rules)');
    if (infra.needsAITracking) {
      console.log('  📁 _ai/ (AI Tracking Directory)');
      console.log('     ├── activeContext.md');
      console.log('     ├── implementation-state.json');
      console.log('     └── progress.md');
    }
    console.log('');
  }

  // Confirm
  if (!autoConfirm && !jsonMode) {
    const confirmed = await confirmAction('Proceed with scaffolding?');
    if (!confirmed) {
      console.log('Cancelled.');
      return;
    }
  }

  // Scaffold
  const result = await scaffolder.scaffold({
    projectRoot,
    analysis,
    userInput: input,
  });

  if (jsonMode) {
    const output: IProjectInitOutput = {
      command: 'init',
      success: result.success,
      projectId: result.projectId,
      projectType: analysis.type,
      analysis,
      scaffoldResult: result,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    if (result.success) {
      console.log('');
      console.log('✅ Project scaffolded successfully!');
      console.log('');
      console.log('── Created Structure ──────────────────────────────────────────');
      console.log(`  Project ID: ${result.projectId}`);
      console.log('');
      console.log('  Directories:');
      result.directories.forEach((d) => console.log(`    📁 ${path.relative(projectRoot, d)}`));
      console.log('');
      console.log('  Files:');
      result.files.forEach((f) => console.log(`    📄 ${path.relative(projectRoot, f)}`));
      console.log('');
      console.log('── Key Paths ──────────────────────────────────────────────────');
      if (result.paths.prd) console.log(`  PRD:          ${path.relative(projectRoot, result.paths.prd)}`);
      if (result.paths.tasks) console.log(`  TASKS:        ${path.relative(projectRoot, result.paths.tasks)}`);
      if (result.paths.constitution) console.log(`  CONSTITUTION: ${path.relative(projectRoot, result.paths.constitution)}`);
      if (result.paths.aiTrackingRoot) console.log(`  AI Tracking:  ${path.relative(projectRoot, result.paths.aiTrackingRoot)}`);
      console.log('');
      console.log('── Next Steps ─────────────────────────────────────────────────');
      console.log('  1. Review the generated specifications');
      console.log('  2. Customize requirements as needed');
      console.log('  3. Begin implementation with:');
      console.log(`     npx tsx src/god-agent/universal/cli.ts code "Implement TASK-001" --json`);
      console.log('');
    } else {
      console.log('');
      console.log('❌ Scaffolding failed!');
      console.log('');
      console.log('Errors:');
      result.errors.forEach((e) => console.log(`  • ${e}`));
    }
  }
}

// ==================== Help ====================

function printHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          Intelligent Project Initialization CLI                   ║
╚══════════════════════════════════════════════════════════════════╝

USAGE:
  npx tsx src/god-agent/core/project/project-cli.ts <command> <input> [options]

COMMANDS:
  analyze <task>    Analyze task without creating files
  init <task>       Initialize project with full scaffolding

OPTIONS:
  --root, -r <path>     Project root directory (default: current directory)
  --json, -j            Output as JSON
  --yes, -y             Auto-confirm prompts
  --help, -h            Show this help

EXAMPLES:
  # Analyze what infrastructure a task needs
  npx tsx src/god-agent/core/project/project-cli.ts analyze "Build an e-commerce API with auth"

  # Initialize a coding project
  npx tsx src/god-agent/core/project/project-cli.ts init "Create a REST API for user management"

  # Initialize in specific directory
  npx tsx src/god-agent/core/project/project-cli.ts init "Build a blog platform" --root ./my-project

  # Get JSON output for integration
  npx tsx src/god-agent/core/project/project-cli.ts init "Implement caching system" --json --yes

PROJECT TYPES:
  coding    - Full specs (PRD, SPEC, TECH, TASKS, CONSTITUTION)
  research  - Research pipeline with literature review structure
  writing   - Document outline and draft structure
  general   - No scaffolding needed (simple Q&A)

The system automatically detects the project type based on your input and
creates the appropriate infrastructure for multi-agent coordination.
`);
}

// ==================== Main ====================

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv);
  const input = positional.join(' ');
  const jsonMode = getFlag(flags, 'json', 'j') === true;
  const autoConfirm = getFlag(flags, 'yes', 'y') === true;
  const rootFlag = getFlag(flags, 'root', 'r') as string | undefined;
  const projectRoot = rootFlag ? path.resolve(rootFlag) : process.cwd();

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  if (!input) {
    if (jsonMode) {
      const output: IProjectInitOutput = {
        command,
        success: false,
        error: 'No input provided',
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.error('Error: Please provide task description');
      printHelp();
    }
    process.exit(1);
  }

  try {
    switch (command.toLowerCase()) {
      case 'analyze':
        await analyzeCommand(input, jsonMode);
        break;

      case 'init':
        await initCommand(input, projectRoot, jsonMode, autoConfirm);
        break;

      default:
        if (jsonMode) {
          const output: IProjectInitOutput = {
            command,
            success: false,
            error: `Unknown command: ${command}`,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.error(`Unknown command: ${command}`);
          printHelp();
        }
        process.exit(1);
    }
  } catch (error) {
    if (jsonMode) {
      const output: IProjectInitOutput = {
        command,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.error('Error:', error);
    }
    process.exit(1);
  }
}

main().catch(console.error);

