#!/usr/bin/env node
import { UniversalAgent } from '../src/god-agent/universal/index.js';

const agent = new UniversalAgent({ verbose: false });
await agent.initialize();

// Get stats
const stats = agent.getStats();
console.log('=== Pattern & Learning Stats ===');
console.log('Top patterns:', stats.topPatterns.length);
console.log('Top patterns data:', JSON.stringify(stats.topPatterns, null, 2));

if (stats.sonaMetrics) {
  console.log('\n=== SonaEngine Metrics ===');
  console.log('Total trajectories:', stats.sonaMetrics.totalTrajectories);
  console.log('Total routes:', stats.sonaMetrics.totalRoutes);
  console.log('Current drift:', stats.sonaMetrics.currentDrift);
  console.log('Quality by route:', JSON.stringify(stats.sonaMetrics.averageQualityByRoute, null, 2));
  console.log('Improvement %:', JSON.stringify(stats.sonaMetrics.improvementPercentage, null, 2));
}

// Check if auto-learn is enabled
console.log('\n=== Config Check ===');
console.log('autoLearn enabled:', agent.config?.autoLearn ?? 'unknown');

// Try to access internal trajectory bridge
try {
  const godAgent = agent.agent;
  if (godAgent) {
    const sonaEngine = godAgent.getSonaEngine?.();
    if (sonaEngine) {
      const sonaStats = sonaEngine.getStats();
      console.log('\n=== Direct SonaEngine Stats ===');
      console.log('Total patterns:', sonaStats.totalPatterns);
      console.log('Route count:', sonaStats.routeCount);
      console.log('Trajectory count:', sonaStats.trajectoryCount);
    }
  }
} catch (e) {
  console.log('Could not access internal stats:', e.message);
}

await agent.shutdown();
console.log('\n✅ Check complete');
