#!/usr/bin/env node
/**
 * DAI-001 Quick Test Script
 * Tests the dynamic agent selection feature
 *
 * Usage:
 *   node scripts/test-dai-001.mjs "your question here"
 *   node scripts/test-dai-001.mjs "implement user authentication"
 *   node scripts/test-dai-001.mjs "research machine learning"
 */

import { UniversalAgent } from '../src/god-agent/universal/universal-agent.js';

async function main() {
  const query = process.argv[2] || 'what is dependency injection?';

  console.log('Initializing God Agent...\n');
  const agent = new UniversalAgent({ verbose: false });
  await agent.initialize();

  console.log('=== DAI-001 Agent Selection Test ===\n');
  console.log('Query:', query);
  console.log('');

  // Test via ask() which now uses DAI-001 internally
  const result = await agent.ask(query, { returnResult: true });

  console.log('Task Type Detected:', result.taskType);
  console.log('Selected Agent:', result.selectedAgent);
  console.log('Category:', result.selectedAgentCategory);
  console.log('Quality Score:', result.qualityScore?.toFixed(2));
  console.log('Trajectory ID:', result.trajectoryId || 'none');

  console.log('\n--- Agent Prompt Preview (first 1000 chars) ---');
  console.log(result.agentPrompt?.slice(0, 1000) || result.output.slice(0, 1000));
  console.log('...\n');

  console.log(`Total prompt length: ${result.output.length} chars (~${Math.ceil(result.output.length / 4)} tokens)`);

  await agent.shutdown();
}

main().catch(console.error);
