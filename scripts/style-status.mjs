#!/usr/bin/env node
/**
 * Style Profile Status Script
 * Displays current style profile status and available profiles
 */

import { UniversalAgent } from '../src/god-agent/universal/index.js';

const agent = new UniversalAgent({ verbose: false });
await agent.initialize();

console.log('=== God Agent Style Profile Status ===\n');

// Get style stats
const stats = agent.getStyleStats();
console.log('Total profiles:', stats.totalProfiles);
console.log('Active profile:', stats.activeProfile ?? 'None');
console.log('Total source documents:', stats.totalSourceDocuments);

// List all profiles
const profiles = agent.listStyleProfiles();

if (profiles.length === 0) {
  console.log('\nNo style profiles created yet.');
  console.log('\nCreate one with:');
  console.log('  /god-learn-style <name> <pdf-directory>');
  console.log('\nExample:');
  console.log('  /god-learn-style academic docs2/social_science_papers');
} else {
  console.log('\n=== Available Profiles ===\n');

  for (const profile of profiles) {
    const isActive = profile.id === stats.activeProfile;
    const marker = isActive ? '→ ' : '  ';
    const activeLabel = isActive ? ' (ACTIVE)' : '';

    console.log(marker + profile.name + activeLabel);
    console.log('    ID:', profile.id);
    console.log('    Sources:', profile.sourceCount, 'documents');
    console.log('    Type:', profile.sourceType);
    console.log('    Tags:', profile.tags.join(', ') || 'none');
    console.log('    Created:', new Date(profile.createdAt).toLocaleString());
    console.log('');
  }
}

// Show active profile characteristics
const activeProfile = agent.getActiveStyleProfile();
if (activeProfile) {
  const chars = activeProfile.characteristics;

  console.log('=== Active Profile Characteristics ===\n');

  console.log('Writing Style Summary:');
  const formality = chars.tone.formalityScore > 0.7 ? 'Highly Formal' :
                   chars.tone.formalityScore > 0.4 ? 'Moderately Formal' : 'Casual';
  const objectivity = chars.tone.objectivityScore > 0.7 ? 'Highly Objective' :
                     chars.tone.objectivityScore > 0.4 ? 'Balanced' : 'Personal';

  console.log('  Tone:', formality + ',', objectivity);
  console.log('  Sentence complexity:', (chars.sentences.complexSentenceRatio * 100).toFixed(0) + '% complex');
  console.log('  Academic vocabulary:', (chars.vocabulary.academicWordRatio * 100).toFixed(1) + '%');
  console.log('  Passive voice usage:', (chars.structure.passiveVoiceRatio * 100).toFixed(0) + '%');
  console.log('  Citation style:', chars.citationStyle);

  if (chars.commonTransitions.length > 0) {
    console.log('\n  Common transitions:', chars.commonTransitions.slice(0, 6).join(', '));
  }

  if (chars.samplePhrases && chars.samplePhrases.length > 0) {
    console.log('\n  Sample phrases learned:');
    chars.samplePhrases.slice(0, 3).forEach(p => {
      console.log('    - "' + p + '"');
    });
  }
}

console.log('\n=== Commands ===');
console.log('Learn new style:     /god-learn-style <name> <directories...>');
console.log('Write with style:    /god-write <topic>');
console.log('Check status:        /god-style-status');

await agent.shutdown();
