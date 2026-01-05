/**
 * Verification Script: PhDPipelineBridge Style Profile Integration
 * TASK-STYLE-004
 *
 * Demonstrates and validates style profile integration in PhDPipelineBridge
 */

import { PhDPipelineBridge } from '../src/god-agent/core/pipeline/phd-pipeline-bridge.js';
import { getStyleProfileManager } from '../src/god-agent/universal/style-profile.js';
import type { IPipelineConfig } from '../src/god-agent/core/pipeline/pipeline-types.js';

// ==================== Test Pipeline Configuration ====================

const testPipelineConfig: IPipelineConfig = {
  id: 'test-phd-pipeline',
  name: 'Test PhD Pipeline',
  description: 'Test pipeline for style integration verification',
  phases: [
    { id: 1, name: 'Foundation', description: 'Foundation phase' },
    { id: 2, name: 'Discovery', description: 'Discovery phase' },
    { id: 3, name: 'Architecture', description: 'Architecture phase' },
    { id: 4, name: 'Synthesis', description: 'Synthesis phase' },
    { id: 5, name: 'Implementation', description: 'Implementation phase' },
    { id: 6, name: 'Writing', description: 'Writing phase' },
    { id: 7, name: 'QA', description: 'QA phase' },
  ],
  agents: [
    // Phase 1
    {
      id: 1,
      key: 'test-agent-phase1',
      type: 'researcher',
      phase: 1,
      description: 'Test agent for phase 1',
      inputs: [],
      outputs: ['foundation-doc'],
      dependencies: [],
      timeout: 300,
      critical: false,
    },
    // Phase 6 (Writing) - Should receive style prompt
    {
      id: 6,
      key: 'test-writer-phase6',
      type: 'writer',
      phase: 6,
      description: 'Test writing agent for phase 6',
      inputs: ['research-data'],
      outputs: ['chapter-draft'],
      dependencies: [1],
      timeout: 600,
      critical: false,
    },
    // Phase 7
    {
      id: 7,
      key: 'test-qa-phase7',
      type: 'reviewer',
      phase: 7,
      description: 'Test QA agent for phase 7',
      inputs: ['chapter-draft'],
      outputs: ['qa-report'],
      dependencies: [6],
      timeout: 300,
      critical: false,
    },
  ],
};

// ==================== Test Functions ====================

async function testWithoutStyleProfile() {
  console.log('\n=== Test 1: Without Style Profile (Default Behavior) ===\n');

  const bridge = new PhDPipelineBridge(testPipelineConfig, null, {
    category: 'phd',
    includeAgentPrompts: false,
  });

  const pipelineDef = bridge.toPipeline();
  const phase6Agent = pipelineDef.agents.find(a => a.agentId === 6);

  console.log('Phase 6 Agent Task Description:');
  console.log('---');
  console.log(phase6Agent?.taskDescription || 'NOT FOUND');
  console.log('---\n');

  const hasDefaultPrompt = phase6Agent?.taskDescription.includes('APA/Academic style');
  console.log(`✓ Contains default APA/Academic prompt: ${hasDefaultPrompt ? 'YES' : 'NO'}`);

  return hasDefaultPrompt;
}

async function testWithStyleProfile() {
  console.log('\n=== Test 2: With Style Profile (UK Academic) ===\n');

  // Create a test style profile
  const styleManager = getStyleProfileManager();

  const ukAcademicSample = `
    The research demonstrates a significant correlation between the variables examined.
    Furthermore, the methodology employed in this study adheres to rigorous academic standards.
    Whilst previous studies have explored similar phenomena, this investigation extends
    the current understanding through novel analytical techniques. The findings suggest
    that colour preferences amongst participants exhibit regional variations. Moreover,
    the data indicate a strong relationship between behaviour patterns and contextual factors.
    The organisation of the experimental protocol followed established conventions.
  `;

  let profile;
  try {
    // Try to get existing profile or create new one
    const existingProfiles = styleManager.listProfiles();
    const existingUKProfile = existingProfiles.find(p => p.name === 'test-uk-academic');

    if (existingUKProfile) {
      console.log('Using existing UK Academic profile...');
      profile = styleManager.getProfile(existingUKProfile.id);
    } else {
      console.log('Creating new UK Academic style profile...');
      profile = await styleManager.createProfile(
        'test-uk-academic',
        [ukAcademicSample],
        {
          description: 'Test UK academic writing style',
          sourceType: 'text',
          tags: ['uk', 'academic', 'formal'],
        }
      );
    }

    console.log(`Style Profile: ${profile?.metadata.name} (${profile?.metadata.id})\n`);
  } catch (error) {
    console.error('Error creating/loading style profile:', error);
    return false;
  }

  // Create bridge with style profile
  const bridge = new PhDPipelineBridge(testPipelineConfig, null, {
    category: 'phd',
    includeAgentPrompts: false,
    styleProfileId: profile?.metadata.id,
  });

  const pipelineDef = bridge.toPipeline();
  const phase6Agent = pipelineDef.agents.find(a => a.agentId === 6);

  console.log('Phase 6 Agent Task Description:');
  console.log('---');
  console.log(phase6Agent?.taskDescription || 'NOT FOUND');
  console.log('---\n');

  const hasStyleRequirements = phase6Agent?.taskDescription.includes('Writing Style Requirements');
  const hasVocabulary = phase6Agent?.taskDescription.includes('Vocabulary:');
  const hasTone = phase6Agent?.taskDescription.includes('Tone:');

  console.log(`✓ Contains "Writing Style Requirements" section: ${hasStyleRequirements ? 'YES' : 'NO'}`);
  console.log(`✓ Contains Vocabulary guidance: ${hasVocabulary ? 'YES' : 'NO'}`);
  console.log(`✓ Contains Tone guidance: ${hasTone ? 'YES' : 'NO'}`);

  return hasStyleRequirements && hasVocabulary && hasTone;
}

async function testNonWritingPhaseUnaffected() {
  console.log('\n=== Test 3: Non-Writing Phases Unaffected ===\n');

  const styleManager = getStyleProfileManager();
  const profiles = styleManager.listProfiles();
  const testProfile = profiles[0]; // Use any existing profile

  const bridge = new PhDPipelineBridge(testPipelineConfig, null, {
    category: 'phd',
    includeAgentPrompts: false,
    styleProfileId: testProfile?.id,
  });

  const pipelineDef = bridge.toPipeline();
  const phase1Agent = pipelineDef.agents.find(a => a.agentId === 1);
  const phase7Agent = pipelineDef.agents.find(a => a.agentId === 7);

  console.log('Phase 1 Agent Task Description:');
  console.log('---');
  console.log(phase1Agent?.taskDescription || 'NOT FOUND');
  console.log('---\n');

  console.log('Phase 7 Agent Task Description:');
  console.log('---');
  console.log(phase7Agent?.taskDescription || 'NOT FOUND');
  console.log('---\n');

  const phase1NoStyle = !phase1Agent?.taskDescription.includes('Writing Style Requirements');
  const phase7NoStyle = !phase7Agent?.taskDescription.includes('Writing Style Requirements');

  console.log(`✓ Phase 1 does NOT contain style requirements: ${phase1NoStyle ? 'YES' : 'NO'}`);
  console.log(`✓ Phase 7 does NOT contain style requirements: ${phase7NoStyle ? 'YES' : 'NO'}`);

  return phase1NoStyle && phase7NoStyle;
}

async function testMissingProfile() {
  console.log('\n=== Test 4: Missing Profile (Graceful Fallback) ===\n');

  const bridge = new PhDPipelineBridge(testPipelineConfig, null, {
    category: 'phd',
    includeAgentPrompts: false,
    styleProfileId: 'non-existent-profile-id-12345',
  });

  const pipelineDef = bridge.toPipeline();
  const phase6Agent = pipelineDef.agents.find(a => a.agentId === 6);

  console.log('Phase 6 Agent Task Description:');
  console.log('---');
  console.log(phase6Agent?.taskDescription || 'NOT FOUND');
  console.log('---\n');

  const hasDefaultFallback = phase6Agent?.taskDescription.includes('APA/Academic style');
  console.log(`✓ Falls back to default APA/Academic prompt: ${hasDefaultFallback ? 'YES' : 'NO'}`);

  return hasDefaultFallback;
}

// ==================== Main Execution ====================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  PhDPipelineBridge Style Profile Integration Verification  ║');
  console.log('║  TASK-STYLE-004                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false,
  };

  try {
    results.test1 = await testWithoutStyleProfile();
    results.test2 = await testWithStyleProfile();
    results.test3 = await testNonWritingPhaseUnaffected();
    results.test4 = await testMissingProfile();
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                     VERIFICATION SUMMARY                    ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Test 1 (Default Behavior):        ${results.test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (With Style Profile):      ${results.test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 3 (Non-Writing Phases):      ${results.test3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 4 (Missing Profile Fallback): ${results.test4 ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(result => result);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
