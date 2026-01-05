#!/usr/bin/env node
/**
 * God Agent Status Script
 * Displays comprehensive status of the Universal Self-Learning God Agent
 */

import { UniversalAgent } from '../src/god-agent/universal/index.js';

const agent = new UniversalAgent({ verbose: false });
await agent.initialize();

const status = agent.getStatus();
const stats = agent.getStats();

console.log('=== Universal Agent Status ===');
console.log('Initialized:', status.initialized);
console.log('Runtime:', status.runtime);
console.log('Health:', JSON.stringify(status.health, null, 2));

console.log('\n=== Learning Stats ===');
console.log('Total interactions:', stats.totalInteractions);
console.log('Knowledge entries:', stats.knowledgeEntries);
console.log('Domain expertise:', JSON.stringify(stats.domainExpertise, null, 2));
console.log('Top patterns:', stats.topPatterns.length);

// Style profile status
const styleStats = agent.getStyleStats();
console.log('\n=== Style Profile Status ===');
console.log('Total profiles:', styleStats.totalProfiles);
console.log('Active profile:', styleStats.activeProfile ?? 'None');
console.log('Total source documents:', styleStats.totalSourceDocuments);

const activeProfile = agent.getActiveStyleProfile();
if (activeProfile) {
  const chars = activeProfile.characteristics;
  console.log('\n=== Active Style Characteristics ===');
  console.log('Formality:', (chars.tone.formalityScore * 100).toFixed(0) + '%');
  console.log('Objectivity:', (chars.tone.objectivityScore * 100).toFixed(0) + '%');
  console.log('Academic vocabulary:', (chars.vocabulary.academicWordRatio * 100).toFixed(1) + '%');
  console.log('Passive voice:', (chars.structure.passiveVoiceRatio * 100).toFixed(0) + '%');
  console.log('Avg sentence length:', Math.round(chars.sentences.averageLength), 'words');
  console.log('Citation style:', chars.citationStyle);
}

await agent.shutdown();
console.log('\n✅ Status check complete');
