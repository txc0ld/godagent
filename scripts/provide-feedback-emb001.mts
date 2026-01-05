// Provide learning feedback for SPEC-EMB-001 implementation
import { UniversalAgent } from '../src/god-agent/universal/index.js';

async function provideFeedback() {
  console.log('=== Storing SPEC-EMB-001 Learnings ===\n');

  const agent = new UniversalAgent({
    enablePersistence: true,
    storageDir: '.agentdb/universal'
  });

  await agent.initialize();

  // Store learnings as knowledge entries
  const learnings = [
    {
      domain: 'implementation-patterns',
      content: 'SPEC-EMB-001 SUCCESS: LocalEmbeddingProvider with all-mpnet-base-v2 API. 768-dim embeddings with LRU caching.',
      category: 'pattern' as const,
      source: 'self'
    },
    {
      domain: 'embedding-systems',
      content: 'Factory pattern for embedding providers enables graceful degradation: try LocalEmbeddingProvider first, fallback to MockEmbeddingProvider.',
      category: 'pattern' as const,
      source: 'self'
    },
    {
      domain: 'performance-optimization',
      content: 'LRU cache for embeddings with max 10000 entries. Cache hit <5ms vs API call ~50ms. Batch endpoints reduce HTTP overhead.',
      category: 'fact' as const,
      source: 'self'
    },
    {
      domain: 'semantic-search',
      content: 'all-mpnet-base-v2 semantic quality: dog<->puppy: 0.78, car<->automobile: 0.87. L2 normalization for consistent cosine similarity.',
      category: 'fact' as const,
      source: 'self'
    },
    {
      domain: 'test-driven-development',
      content: 'SPEC-EMB-001 test coverage: 12 tests covering availability, single/batch embedding, caching, and semantic similarity.',
      category: 'fact' as const,
      source: 'self'
    }
  ];

  for (const learning of learnings) {
    const id = await agent.storeKnowledge(learning);
    console.log(`Stored: ${learning.domain} -> ${id}`);
  }

  console.log('\n=== All learnings stored ===');

  await agent.shutdown();
}

provideFeedback().catch(console.error);
