/**
 * Executor CLI Demonstration
 * Shows how to use ClaudeTaskExecutor with real CLI execution
 *
 * Run: npx tsx examples/executor-cli-demo.ts
 */

import { ClaudeTaskExecutor } from '../src/god-agent/core/executor/claude-task-executor.js';
import { AgentRegistry } from '../src/god-agent/core/agents/agent-registry.js';
import type { IAgentDefinition } from '../src/god-agent/core/orchestration/orchestration-types.js';

async function demoRealCLIExecution() {
  console.log('=== Executor CLI Demo ===\n');

  // Initialize registry
  const registry = new AgentRegistry({
    agentsDirectory: '.claude/agents',
    verbose: true,
  });

  // Load agent definitions
  console.log('Loading agent definitions...');
  await registry.loadAllAgents();
  const stats = registry.getStats();
  console.log(`Loaded ${stats.totalAgents} agents\n`);

  // Create executor with REAL CLI execution
  const executor = new ClaudeTaskExecutor(registry, {
    executionMode: 'cli',       // Use real Claude CLI
    claudeCliPath: 'claude',    // Path to claude CLI
    outputFormat: 'json',       // JSON output
    timeout: 60000,             // 1 minute timeout
    verbose: true,              // Enable logging
    enableHooks: false,         // Disable hooks for demo
  });

  console.log('Executor Configuration:');
  console.log('- Mode: CLI (real execution)');
  console.log('- Timeout: 60 seconds');
  console.log('- Output: JSON\n');

  // Define a simple agent task
  const agentDef: IAgentDefinition = {
    agentName: 'demo-researcher',
    agentType: 'researcher',
    position: '1',
    phase: 'analysis',
    task: 'Analyze a simple concept',
    qualityGate: 'Must provide clear explanation',
    previousKey: '',
    outputKey: 'demo/output',
  };

  try {
    console.log('Executing agent with real CLI...\n');

    const prompt = `
## Task
Explain in 2-3 sentences what TypeScript is and why developers use it.

## Requirements
- Be concise
- Focus on key benefits
- Use simple language
    `.trim();

    const output = await executor.execute(prompt, agentDef);

    console.log('\n=== Agent Output ===');
    console.log(output);
    console.log('\n✅ Execution completed successfully!');

  } catch (error) {
    console.error('\n❌ Execution failed:');
    console.error(error instanceof Error ? error.message : String(error));

    console.log('\nNote: If Claude CLI is not installed, the executor will fall back to mock mode.');
    console.log('Install Claude CLI: https://github.com/anthropics/claude-code');
  }
}

async function demoMockExecution() {
  console.log('\n\n=== Mock Mode Demo ===\n');

  const registry = new AgentRegistry({
    agentsDirectory: '.claude/agents',
    verbose: false,
  });

  await registry.loadAllAgents();

  // Create executor with MOCK execution
  const executor = new ClaudeTaskExecutor(registry, {
    executionMode: 'mock',      // Use mock for testing
    timeout: 60000,
    verbose: true,
  });

  console.log('Executor Configuration:');
  console.log('- Mode: MOCK (no real CLI)');
  console.log('- Good for: Testing, CI/CD, development without CLI\n');

  const agentDef: IAgentDefinition = {
    agentName: 'mock-agent',
    agentType: 'coder',
    position: '1',
    phase: 'implementation',
    task: 'Write code',
    qualityGate: 'Must compile',
    previousKey: '',
    outputKey: 'mock/output',
  };

  try {
    const output = await executor.execute('Write a hello world function', agentDef);

    console.log('\n=== Mock Output ===');
    console.log(output);
    console.log('\n✅ Mock execution completed!');

  } catch (error) {
    console.error('❌ Mock execution failed:', error);
  }
}

async function demoAutoFallback() {
  console.log('\n\n=== Auto Fallback Demo ===\n');
  console.log('When CLI fails, executor automatically falls back to mock mode.\n');

  const registry = new AgentRegistry({
    agentsDirectory: '.claude/agents',
    verbose: false,
  });

  await registry.loadAllAgents();

  // Configure with invalid CLI path to trigger fallback
  const executor = new ClaudeTaskExecutor(registry, {
    executionMode: 'cli',
    claudeCliPath: '/nonexistent/claude',  // Invalid path
    timeout: 60000,
    verbose: true,
  });

  const agentDef: IAgentDefinition = {
    agentName: 'fallback-test',
    agentType: 'tester',
    position: '1',
    phase: 'testing',
    task: 'Test fallback',
    qualityGate: 'Must complete',
    previousKey: '',
    outputKey: 'fallback/output',
  };

  try {
    console.log('Attempting CLI execution with invalid path...\n');
    const output = await executor.execute('Test fallback mechanism', agentDef);

    console.log('\n=== Output (from fallback) ===');
    console.log(output.slice(0, 200) + '...');
    console.log('\n✅ Fallback worked! Execution completed via mock mode.');

  } catch (error) {
    console.error('❌ Fallback failed:', error);
  }
}

// Run all demos
async function main() {
  try {
    await demoRealCLIExecution();
    await demoMockExecution();
    await demoAutoFallback();

    console.log('\n\n=== Summary ===');
    console.log('✅ Real CLI execution: Uses `claude --print --system-prompt` command');
    console.log('✅ Mock execution: Returns simulated output for testing');
    console.log('✅ Auto fallback: Gracefully handles CLI unavailability');
    console.log('\nImplementation: SPEC-EXE-001 v1.2 completed');

  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
