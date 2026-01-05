/**
 * Universal Self-Learning God Agent Demo
 *
 * Demonstrates all capabilities:
 * - Multi-mode operation (code, research, write, general)
 * - Self-learning from interactions
 * - Knowledge accumulation
 * - Feedback loops
 *
 * Run: npx tsx examples/universal-agent-demo.ts
 */

import { UniversalAgent } from '../src/god-agent/universal/index.js';

async function demo() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Universal Self-Learning God Agent Demo                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Create and initialize
  const agent = new UniversalAgent({
    autoLearn: true,
    verbose: true,
    autoStoreThreshold: 0.6,
  });

  await agent.initialize();
  console.log('\n✓ Agent initialized\n');

  // ==================== 1. Store Knowledge ====================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Step 1: Storing initial knowledge');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const knowledge = [
    {
      content: 'Always use TypeScript for better type safety and developer experience',
      type: 'pattern' as const,
      domain: 'coding',
      tags: ['typescript', 'best-practice'],
    },
    {
      content: 'REST APIs should use proper HTTP status codes: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 500 Internal Server Error',
      type: 'fact' as const,
      domain: 'api-design',
      tags: ['rest', 'http', 'status-codes'],
    },
    {
      content: 'Machine learning models require careful feature engineering, proper train/test splits, and validation',
      type: 'insight' as const,
      domain: 'machine-learning',
      tags: ['ml', 'best-practice'],
    },
    {
      content: 'Academic papers follow: Abstract, Introduction, Related Work, Methodology, Results, Discussion, Conclusion',
      type: 'procedure' as const,
      domain: 'writing',
      tags: ['academic', 'structure'],
    },
  ];

  for (const k of knowledge) {
    const id = await agent.storeKnowledge(k);
    console.log(`  Stored: "${k.content.slice(0, 50)}..." → ${id}`);
  }

  // ==================== 2. Code Generation ====================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Step 2: Code Generation with Pattern Learning');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const codeResult = await agent.code('Implement a REST API endpoint for user registration', {
    language: 'typescript',
    context: 'Express.js backend',
  });

  console.log('Generated Code:');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(codeResult.code);
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`Language: ${codeResult.language}`);
  console.log(`Patterns used: ${codeResult.patterns_used.length}`);
  console.log(`New pattern learned: ${codeResult.learned}`);

  // ==================== 3. Research ====================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Step 3: Deep Research with Knowledge Accumulation');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const researchResult = await agent.research('What are best practices for API design?', {
    depth: 'deep',
  });

  console.log('Research Synthesis:');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(researchResult.synthesis);
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`Findings: ${researchResult.findings.length}`);
  console.log(`Knowledge stored: ${researchResult.knowledgeStored}`);

  // ==================== 4. Writing ====================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Step 4: Academic Writing with Style Learning');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const writeResult = await agent.write('The Impact of Machine Learning on Software Development', {
    style: 'academic',
    format: 'paper',
    length: 'medium',
  });

  console.log('Generated Content:');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(writeResult.content);
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`Style: ${writeResult.style}`);
  console.log(`Word count: ${writeResult.wordCount}`);
  console.log(`Sources used: ${writeResult.sources.length}`);

  // ==================== 5. Auto-Mode Detection ====================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Step 5: Auto-Mode Detection');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const queries = [
    'How do I implement a binary search tree?',  // → code
    'Research the latest advances in transformers',  // → research
    'Write an essay about climate change',  // → write
    'What is the capital of France?',  // → general
  ];

  for (const query of queries) {
    const result = await agent.ask(query);
    console.log(`Q: "${query}"`);
    console.log(`A: ${result.slice(0, 100)}...\n`);
  }

  // ==================== 6. Learning Stats ====================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Step 6: Learning Statistics');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const stats = agent.getStats();
  const status = agent.getStatus();

  console.log('Agent Status:');
  console.log(`  Initialized: ${status.initialized}`);
  console.log(`  Runtime: ${status.runtime}`);
  console.log(`  VectorDB Health: ${status.health.vectorDB}`);
  console.log(`  GraphDB Health: ${status.health.graphDB}`);

  console.log('\nLearning Stats:');
  console.log(`  Total interactions: ${stats.totalInteractions}`);
  console.log(`  Knowledge entries: ${stats.knowledgeEntries}`);
  console.log(`  Domain expertise:`);
  for (const [domain, count] of Object.entries(stats.domainExpertise)) {
    console.log(`    - ${domain}: ${count} entries`);
  }

  if (stats.topPatterns.length > 0) {
    console.log(`  Top patterns:`);
    for (const pattern of stats.topPatterns.slice(0, 5)) {
      console.log(`    - ${pattern.id}: ${pattern.uses} uses`);
    }
  }

  // ==================== 7. Feedback Loop Demo ====================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Step 7: Feedback Loop (Reinforcement Learning)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('The feedback system allows explicit reinforcement:');
  console.log('  - Positive feedback (rating > 0.7) reinforces patterns');
  console.log('  - Negative feedback (rating < 0.3) weakens patterns');
  console.log('  - Neutral feedback is recorded for analysis');
  console.log('\nExample:');
  console.log('  await agent.feedback(interactionId, 0.95); // Reinforce');
  console.log('  await agent.feedback(interactionId, 0.2);  // Weaken');

  // ==================== Cleanup ====================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Demo Complete');
  console.log('═══════════════════════════════════════════════════════════════\n');

  await agent.shutdown();
  console.log('✓ Agent shutdown complete\n');

  console.log('Next Steps:');
  console.log('  1. Try the CLI: npx tsx src/god-agent/universal/cli.ts ask "Your question"');
  console.log('  2. Use slash commands in Claude Code: /god-ask, /god-code, /god-research');
  console.log('  3. Build your own integration with the API');
  console.log('  4. Read docs: docs/GOD-AGENT-USAGE.md');
}

demo().catch(console.error);
