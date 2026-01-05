/**
 * God Agent Demo - End-to-End Integration Example
 *
 * Demonstrates: store → query → learn cycle
 */

import { GodAgent } from '../src/god-agent/core/god-agent.js';

async function main() {
  console.log('=== God Agent Integration Demo ===\n');

  // 1. Initialize God Agent
  console.log('1. Initializing God Agent...');
  const agent = new GodAgent({
    enableObservability: true,
    verbose: true,
  });

  const initResult = await agent.initialize();
  console.log(`   Runtime: ${initResult.runtime.type}`);
  console.log(`   Components: ${Object.entries(initResult.components).filter(([,v]) => v).length}/10 active`);

  // 2. Store some knowledge
  console.log('\n2. Storing knowledge...');
  const patterns = [
    { content: 'Machine learning model training patterns', tags: ['ml', 'training'] },
    { content: 'Neural network architecture decisions', tags: ['nn', 'architecture'] },
    { content: 'Data preprocessing best practices', tags: ['data', 'preprocessing'] },
  ];

  for (const pattern of patterns) {
    const embedding = createRandomEmbedding();
    const result = await agent.store(
      { content: pattern.content, embedding, metadata: pattern },
      { trackProvenance: true }
    );
    console.log(`   Stored: ${pattern.content.slice(0, 40)}... (id: ${result.id})`);
  }

  // 3. Query knowledge
  console.log('\n3. Querying knowledge...');
  const queryEmbedding = createRandomEmbedding();
  const queryResult = await agent.query(queryEmbedding, {
    k: 3,
    includeProvenance: true,
    applyAttention: true,
  });

  console.log(`   Found ${queryResult.patterns.length} patterns`);
  console.log(`   Reasoning mode: ${queryResult.reasoningMode}`);
  console.log(`   Latency: ${queryResult.latencyMs.toFixed(2)}ms`);

  // 4. Provide learning feedback
  console.log('\n4. Providing learning feedback...');
  if (queryResult.patterns.length > 0) {
    await agent.learn({
      queryId: queryResult.queryId,
      patternId: queryResult.patterns[0].id,
      verdict: 'positive',
      score: 0.95,
    });
    console.log('   Feedback recorded successfully');
  }

  // 5. Get status
  console.log('\n5. System Status:');
  const status = agent.getStatus();
  console.log(`   Initialized: ${status.initialized}`);
  console.log(`   Runtime: ${status.runtime}`);
  console.log(`   Vectors: ${status.memory.vectorCount}`);
  console.log(`   Graph nodes: ${status.memory.graphNodeCount}`);

  // 6. Shutdown
  console.log('\n6. Shutting down...');
  await agent.shutdown();
  console.log('   God Agent shutdown complete');

  console.log('\n=== Demo Complete ===');
}

function createRandomEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    embedding[i] = (Math.random() - 0.5) * 2;
  }
  // Normalize
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  for (let i = 0; i < 768; i++) {
    embedding[i] /= norm;
  }
  return embedding;
}

main().catch(console.error);
