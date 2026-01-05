#!/usr/bin/env node
/**
 * Test script to verify pattern creation flow after the trajectory sync fix.
 *
 * This script:
 * 1. Creates a UniversalAgent
 * 2. Executes a few interactions
 * 3. Provides high-quality feedback
 * 4. Checks if patterns are created in SonaEngine
 */

import { UniversalAgent } from '../src/god-agent/universal/index.js';

console.log('=== Pattern Creation Test ===\n');

const agent = new UniversalAgent({
  verbose: true,
  autoLearn: true,
  autoStoreThreshold: 0.7,
});

await agent.initialize();

console.log('\n--- Before interactions ---');
let stats = agent.getStats();
console.log('Top patterns:', stats.topPatterns.length);
console.log('SonaEngine metrics:', JSON.stringify(stats.sonaMetrics, null, 2));

// Execute a few interactions with explicit feedback
console.log('\n--- Executing test interactions ---');

const testCases = [
  { input: 'Write a function to calculate fibonacci numbers', mode: 'code' },
  { input: 'Explain quantum computing basics', mode: 'research' },
  { input: 'Write a haiku about programming', mode: 'write' },
];

for (const test of testCases) {
  console.log(`\nExecuting: "${test.input.substring(0, 40)}..." (${test.mode})`);

  // Use the 'ask' method with returnResult: true to get full result object
  const result = await agent.ask(test.input, { mode: test.mode, returnResult: true });
  console.log(`  Result length: ${result.output.length} chars`);
  console.log(`  Interaction ID: ${result.interactionId || 'none'}`);
  console.log(`  Trajectory ID: ${result.trajectoryId || 'none'}`);
  console.log(`  Patterns used: ${result.patternsUsed?.length || 0}`);
  console.log(`  Quality score: ${result.qualityScore?.toFixed(2) || 'none'}`);
  console.log(`  Auto-feedback submitted: ${result.autoFeedbackSubmitted || false}`);

  // Provide explicit high-quality feedback to trigger pattern creation
  if (result.interactionId) {
    console.log(`  Providing explicit feedback (rating=0.95)...`);
    try {
      // Use the correct method name: 'feedback' not 'provideFeedback'
      const feedbackResult = await agent.feedback(result.interactionId, 0.95, {
        notes: 'Test feedback - high quality',
      });
      console.log(`  Feedback result: patternCreated=${feedbackResult.patternCreated}`);
    } catch (err) {
      console.log(`  Feedback error: ${err.message}`);
    }
  }
}

console.log('\n--- After interactions ---');
stats = agent.getStats();
console.log('Top patterns:', stats.topPatterns.length);
console.log('SonaEngine metrics:', JSON.stringify(stats.sonaMetrics, null, 2));

// Check direct SonaEngine stats
try {
  const godAgent = agent.agent;
  if (godAgent) {
    const sonaEngine = godAgent.getSonaEngine?.();
    if (sonaEngine) {
      const sonaStats = sonaEngine.getStats();
      console.log('\n--- Direct SonaEngine Stats ---');
      console.log('Total patterns:', sonaStats.totalPatterns);
      console.log('Route count:', sonaStats.routeCount);
      console.log('Trajectory count:', sonaStats.trajectoryCount);
      console.log('Trajectories by route:', JSON.stringify(sonaStats.trajectoriesByRoute, null, 2));
    }
  }
} catch (e) {
  console.log('Could not access internal stats:', e.message);
}

await agent.shutdown();
console.log('\n✅ Test complete');
