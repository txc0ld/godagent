/**
 * Store Architecture Review content in God Agent memory
 */

import { UniversalAgent } from '../src/god-agent/universal/index.js';

const knowledgeEntries = [
  {
    type: 'concept',
    domain: 'architecture',
    tags: ['god-agent', 'architecture', 'overview', 'v2.0'],
    content: `God Agent Architecture Review v2.0 - Executive Summary:
The God Agent is a self-learning AI system with 6 architectural layers:
1. Native Core (TypeScript runtime, AgentDB backend)
2. Reasoning (ReasoningBank with 12 reasoning modes)
3. Memory (VectorDB, GraphDB, LRU caching)
4. Learning (SonaEngine with EWC++)
5. Orchestration (PhDPipelineRunner, 43-agent pipelines)
6. Agent Execution (AgentExecutionService for single/chain execution)

Key capabilities: 196+ agents, 18+ categories, trajectory-based learning, persistent memory.`
  },
  {
    type: 'concept',
    domain: 'architecture',
    tags: ['god-agent', 'layer-1', 'native-core', 'typescript'],
    content: `Layer 1 - Native Core:
- Pure TypeScript implementation (no Python dependencies)
- AgentDB provides 150x faster vector operations than ChromaDB
- Built-in quantization (4-32x memory reduction)
- HNSW indexing for sub-millisecond similarity search
- File: src/god-agent/core/god-agent.ts`
  },
  {
    type: 'concept',
    domain: 'architecture',
    tags: ['god-agent', 'layer-2', 'reasoning', 'reasoning-bank'],
    content: `Layer 2 - Reasoning (ReasoningBank):
- 12 specialized reasoning modes for different problem types
- Causal reasoning for cause-effect analysis
- Deductive reasoning for logical conclusions
- Inductive reasoning for pattern generalization
- Analogical reasoning for cross-domain transfer
- File: src/god-agent/core/reasoning/reasoning-bank.ts`
  },
  {
    type: 'concept',
    domain: 'architecture',
    tags: ['god-agent', 'layer-3', 'memory', 'vector-db', 'graph-db'],
    content: `Layer 3 - Memory System:
- VectorDB: Semantic similarity search with quantization
- GraphDB: Knowledge graph with hyperedge support
- LRU Cache: Fast access to recent knowledge
- Tiered storage: hot/warm/cold with automatic migration
- File: src/god-agent/core/vector-db/, src/god-agent/core/graph-db/`
  },
  {
    type: 'concept',
    domain: 'architecture',
    tags: ['god-agent', 'layer-4', 'learning', 'sona-engine', 'ewc'],
    content: `Layer 4 - Learning (SonaEngine):
- Trajectory-based learning from agent interactions
- EWC++ for catastrophic forgetting prevention
- Quality scoring with multi-factor assessment
- Automatic feedback from execution outcomes
- File: src/god-agent/core/learning/sona-engine.ts`
  },
  {
    type: 'concept',
    domain: 'architecture',
    tags: ['god-agent', 'layer-5', 'orchestration', 'pipeline'],
    content: `Layer 5 - Orchestration:
- PhDPipelineRunner for 43-agent academic pipelines
- RelayRaceOrchestrator for sequential execution
- Swarm coordination patterns (mesh, hierarchical, adaptive)
- Memory-coordinated multi-agent workflows
- File: src/god-agent/core/pipeline/phd-pipeline-runner.ts`
  },
  {
    type: 'concept',
    domain: 'architecture',
    tags: ['god-agent', 'layer-6', 'agent-execution', 'SPEC-DEV-001'],
    content: `Layer 6 - Agent Execution (SPEC-DEV-001):
- runAgent(key, task, options): Execute single agent
- listAgents(filter): Get available agents with filtering
- getAgentInfo(key): Retrieve agent metadata
- runAgentChain(steps): Execute sequential agent workflow
- Memory namespace for cross-agent communication
- Trajectory tracking for learning from executions
- File: src/god-agent/core/services/agent-execution-service.ts`
  },
  {
    type: 'reference',
    domain: 'architecture',
    tags: ['god-agent', 'agent-registry', 'agents'],
    content: `Agent Registry System:
- 196+ agents from .claude/agents/ directory
- 18+ categories: core, research, development, testing, etc.
- Frontmatter-based configuration (YAML)
- Dynamic loading and capability filtering
- File: src/god-agent/core/agents/agent-registry.ts`
  },
  {
    type: 'reference',
    domain: 'architecture',
    tags: ['god-agent', 'universal-agent', 'api'],
    content: `UniversalAgent API:
- ask(question): Query with learning and memory
- storeKnowledge(entry): Store knowledge entry
- code(request): Code generation with patterns
- research(topic): Deep research with citations
- write(request, style?): Document generation
- Persistent storage in .agentdb/universal/
- File: src/god-agent/universal/universal-agent.ts`
  },
  {
    type: 'reference',
    domain: 'architecture',
    tags: ['god-agent', 'types', 'SPEC-DEV-001', 'interfaces'],
    content: `Key Type Interfaces (SPEC-DEV-001):
- IAgentExecutionOptions: namespace, timeout, trackTrajectory, context
- IAgentExecutionResult: agentKey, success, output, duration, memoryKey
- IAgentChainStep: agent, task, options
- IAgentChainResult: success, duration, steps[], failedAtStep
- IAgentFilter: category, capability, priority, namePattern
- File: src/god-agent/core/types/agent-execution-types.ts`
  },
  // NEW v2.1 - Trajectory Streaming (SPEC-TRJ-001)
  {
    type: 'concept',
    domain: 'architecture',
    tags: ['god-agent', 'layer-4', 'trajectory-streaming', 'SPEC-TRJ-001', 'v2.1'],
    content: `Layer 4.3 - Trajectory Streaming to Disk (SPEC-TRJ-001 v1.2):
Problem: Previously limited to ~10K trajectories in memory.
Solution: TrajectoryStreamManager enables 100K+ trajectories with <500MB memory.

Components:
- MemoryWindow: LRU cache (1000 trajectories), quality-weighted eviction
- DiskWriter: Batch async writer with mutex, atomic writes
- DiskReader: Indexed reader with LRU cache
- IndexManager: Metadata persistence (JSON)
- MemoryMonitor: Heap pressure tracking
- QueryQueue: Concurrent query limiter (max 10)
- PID File: Multi-process detection
- VersionMigrator: v1 ↔ v2 migration

File: src/god-agent/core/learning/trajectory-stream-manager.ts`
  },
  {
    type: 'concept',
    domain: 'architecture',
    tags: ['god-agent', 'trajectory-streaming', 'binary-format', 'SPEC-TRJ-001'],
    content: `Trajectory Streaming Binary Format (v2):
Header (20 bytes):
- "TRAJ" magic (4 bytes)
- version = 2 (4 bytes, uint32)
- trajectoryCount (4 bytes, uint32)
- checksum CRC32 (4 bytes, uint32)
- rollbackStateOffset (4 bytes, uint32)

Records: Length-prefixed JSON or LZ4 compressed

Rollback State Section (v2 only):
{lastRollbackCheckpointId, lastRollbackAt, rollbackCount}

LZ4 compression provides 60-70% disk reduction.
File: src/god-agent/core/types/trajectory-streaming-types.ts`
  },
  {
    type: 'concept',
    domain: 'architecture',
    tags: ['god-agent', 'trajectory-streaming', 'design-decisions', 'SPEC-TRJ-001'],
    content: `Trajectory Streaming Key Design Decisions:
1. Memory Window Pattern: Keep last N in memory, stream older to disk
   - Quality-weighted LRU: priority = quality / (age_days + 1)
   - High-quality old trajectories stay longer

2. Multi-Process Safety (CRITICAL-003):
   - PID file detection prevents concurrent writers
   - Read-only mode allows concurrent readers
   - flushMutex prevents concurrent writes within process

3. Rollback Loop Detection (CRITICAL-004):
   - recordRollback() tracks last checkpoint
   - Throws ERR_ROLLBACK_LOOP if no progress made
   - Progress = new trajectories, new checkpoint, or weight changes >1%

4. Version Migration (CRITICAL-005):
   - migrateToVersion() with backup and dry-run support
   - Full encodeV1/decodeV1/encodeV2/decodeV2 implementations`
  },
  {
    type: 'reference',
    domain: 'architecture',
    tags: ['god-agent', 'trajectory-streaming', 'configuration', 'SPEC-TRJ-001'],
    content: `Trajectory Streaming Configuration (ITrajectoryStreamConfig):
- memoryWindowSize: 1000 (trajectories in memory)
- batchWriteSize: 10 (trajectories per flush)
- batchWriteIntervalMs: 5000 (max time between flushes)
- storageDir: '.agentdb/sona/trajectories'
- compressionEnabled: true (LZ4)
- formatVersion: 2 (current version)
- readOnly: false (set true for concurrent readers)
- maxConcurrentQueries: 10
- heapPressureThreshold: 0.8 (80%)

Performance Targets (NVMe SSD):
- addTrajectory(): <1ms
- getTrajectory() from memory: <1ms
- getTrajectory() from disk: <80ms p99
- flush(): <100ms (10 trajectories)
- Throughput: 1000 trajectories/sec`
  },
  {
    type: 'reference',
    domain: 'architecture',
    tags: ['god-agent', 'trajectory-streaming', 'errors', 'SPEC-TRJ-001'],
    content: `Trajectory Streaming Error Types:
- ERR_MULTI_PROCESS: Another writer detected on same storageDir
- ERR_ROLLBACK_LOOP: Rolling back to same checkpoint without progress
- ERR_DELETE_BASELINE: Attempting to delete baseline checkpoint
- ERR_READ_ONLY: Write operation in read-only mode
- ERR_MIGRATION_FAILED: Version migration encountered errors

Production Status: APPROVED (95/100)
- All CRITICAL issues resolved (003, 004, 005)
- 57/57 tests passing
- Full type coverage
- Comprehensive error handling

Known Limitations:
- No file-level locking (PID detection is best-effort)
- Index degrades at >500K trajectories
- No runtime schema validation`
  }
];

async function storeKnowledge() {
  console.log('[store-architecture] Initializing Universal Agent...');

  const agent = new UniversalAgent({ verbose: true });
  await agent.initialize();

  console.log(`[store-architecture] Storing ${knowledgeEntries.length} knowledge entries...`);

  for (let i = 0; i < knowledgeEntries.length; i++) {
    const entry = knowledgeEntries[i];
    try {
      const id = await agent.storeKnowledge(entry);
      console.log(`[store-architecture] Stored entry ${i + 1}/${knowledgeEntries.length}: ${id} (${entry.domain}/${entry.type})`);
    } catch (error) {
      console.error(`[store-architecture] Failed to store entry ${i + 1}:`, error.message);
    }
  }

  // Show updated stats
  const stats = await agent.getStats();
  console.log('\n[store-architecture] Updated stats:');
  console.log(`  Knowledge entries: ${stats.knowledgeCount}`);
  console.log(`  Total interactions: ${stats.totalInteractions}`);
  console.log(`  Domain expertise:`, stats.domainExpertise);

  await agent.shutdown();
  console.log('[store-architecture] Complete!');
}

storeKnowledge().catch(console.error);
