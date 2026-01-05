/**
 * Simple Test: PhDPipelineBridge Style Profile Integration
 * TASK-STYLE-004
 *
 * Direct test of style prompt injection in buildTaskDescription
 */

import { PhDPipelineBridge } from '../src/god-agent/core/pipeline/phd-pipeline-bridge.js';
import { getStyleProfileManager } from '../src/god-agent/universal/style-profile.js';
import type { IPipelineConfig, IAgentConfig } from '../src/god-agent/core/pipeline/pipeline-types.js';

// Simple test pipeline
const testConfig: IPipelineConfig = {
  id: 'test-pipeline',
  name: 'Test Pipeline',
  description: 'Test',
  phases: [
    { id: 6, name: 'Writing', description: 'Writing phase' },
  ],
  agents: [
    {
      id: 1,
      key: 'writer',
      type: 'writer',
      phase: 6,
      description: 'Write chapter',
      inputs: [],
      outputs: ['chapter'],
      dependencies: [],
      timeout: 300,
      critical: false,
    },
  ],
};

async function main() {
  console.log('\n=== TASK-STYLE-004: PhDPipelineBridge Style Integration Test ===\n');

  // Test 1: Without style profile (default)
  console.log('Test 1: Default behavior (no style profile)');
  const bridge1 = new PhDPipelineBridge(testConfig, null, {
    category: 'phd',
  });

  // Access protected method via reflection for testing
  const buildTaskDescription = (bridge1 as any).buildTaskDescription.bind(bridge1);
  const desc1 = buildTaskDescription(testConfig.agents[0], null);

  console.log('Task description includes:');
  console.log('  - "Writing Style Requirements":', desc1.includes('Writing Style Requirements') ? '✅ YES' : '❌ NO');
  console.log('  - "APA/Academic style":', desc1.includes('APA/Academic style') ? '✅ YES' : '❌ NO');

  // Test 2: With style profile
  console.log('\nTest 2: With UK Academic style profile');

  const styleManager = getStyleProfileManager();
  const ukSample = `
    The research demonstrates a significant correlation between the variables examined.
    Whilst previous studies have explored similar phenomena, this investigation extends
    the current understanding. The organisation of the experimental protocol followed
    established conventions. Colour preferences amongst participants exhibit regional variations.
  `;

  let profileId: string;
  const existingProfiles = styleManager.listProfiles();
  const existing = existingProfiles.find(p => p.name === 'test-uk-academic');

  if (existing) {
    profileId = existing.id;
    console.log('  Using existing profile:', profileId);
  } else {
    const profile = await styleManager.createProfile(
      'test-uk-academic',
      [ukSample],
      { description: 'UK academic', sourceType: 'text' }
    );
    profileId = profile.metadata.id;
    console.log('  Created profile:', profileId);
  }

  const bridge2 = new PhDPipelineBridge(testConfig, null, {
    category: 'phd',
    styleProfileId: profileId,
  });

  const buildTaskDescription2 = (bridge2 as any).buildTaskDescription.bind(bridge2);
  const desc2 = buildTaskDescription2(testConfig.agents[0], null);

  console.log('Task description includes:');
  console.log('  - "Writing Style Requirements":', desc2.includes('Writing Style Requirements') ? '✅ YES' : '❌ NO');
  console.log('  - "Sentence Structure":', desc2.includes('Sentence Structure') ? '✅ YES' : '❌ NO');
  console.log('  - "Vocabulary":', desc2.includes('Vocabulary') ? '✅ YES' : '❌ NO');
  console.log('  - "Tone":', desc2.includes('Tone') ? '✅ YES' : '❌ NO');

  // Test 3: Missing profile (fallback)
  console.log('\nTest 3: Missing profile (should fallback to default)');
  const bridge3 = new PhDPipelineBridge(testConfig, null, {
    category: 'phd',
    styleProfileId: 'non-existent-id-12345',
  });

  const buildTaskDescription3 = (bridge3 as any).buildTaskDescription.bind(bridge3);
  const desc3 = buildTaskDescription3(testConfig.agents[0], null);

  console.log('Task description includes:');
  console.log('  - "Writing Style Requirements":', desc3.includes('Writing Style Requirements') ? '✅ YES' : '❌ NO');
  console.log('  - "APA/Academic style" (default):', desc3.includes('APA/Academic style') ? '✅ YES' : '❌ NO');

  // Test 4: Non-writing phase (should not inject style)
  console.log('\nTest 4: Non-writing phase (Phase 1) should NOT have style prompt');
  const configPhase1: IPipelineConfig = {
    ...testConfig,
    phases: [{ id: 1, name: 'Foundation', description: 'Foundation' }],
    agents: [{
      ...testConfig.agents[0],
      phase: 1,
    }],
  };

  const bridge4 = new PhDPipelineBridge(configPhase1, null, {
    category: 'phd',
    styleProfileId: profileId,
  });

  const buildTaskDescription4 = (bridge4 as any).buildTaskDescription.bind(bridge4);
  const desc4 = buildTaskDescription4(configPhase1.agents[0], null);

  console.log('Task description includes:');
  console.log('  - "Writing Style Requirements":', desc4.includes('Writing Style Requirements') ? '❌ FAIL' : '✅ CORRECT (not included)');

  console.log('\n=== All Tests Complete ===\n');
}

main().catch(console.error);
