# Decision Log - God Agent System

## DEC-001: Embedding Model Selection
**Date:** 2026-01-04
**Status:** Final
**Decision:** Use gte-Qwen2-1.5B-instruct model with 1536 dimensions
**Context:** Need local embedding model for semantic similarity search
**Options Considered:**
- OpenAI text-embedding-3-small: Requires API key, external dependency
- Sentence-transformers/all-MiniLM-L6-v2: Only 384 dimensions
- gte-Qwen2-1.5B-instruct: 1536 dimensions, local, high quality
**Rationale:** Local execution, high dimensionality for nuanced matching, no API costs
**Consequences:**
- Higher memory usage (1.5B parameters)
- First embedding request slower (model loading)
- Excellent semantic matching quality

---

## DEC-002: Deterministic Routing
**Date:** 2026-01-04
**Status:** Final
**Decision:** Routing engine uses pure deterministic logic without external LLM calls
**Context:** Agent selection must be fast (<150ms P95) and predictable
**Options Considered:**
- LLM-based routing: More nuanced but slow and expensive
- Rule-based only: Fast but rigid
- Hybrid embedding + rules: Best of both worlds
**Rationale:** Embedding similarity provides semantic understanding without LLM latency. Rules provide predictable behavior. Combined approach is fast and flexible.
**Consequences:**
- Sub-150ms routing decisions
- Fully explainable routing factors
- Requires good agent capability descriptions

---

## DEC-003: Two-Phase Execution Model
**Date:** 2026-01-04
**Status:** Final
**Decision:** CLI prepares task but does NOT execute LLM calls
**Context:** Separation of concerns between orchestration and execution
**Options Considered:**
- CLI does everything: Monolithic, hard to scale
- CLI prepares, skill executes: Clean separation
- Separate orchestration service: Over-engineered
**Rationale:** CLI handles routing, context injection, prompt building. Skill/frontend handles actual LLM execution. Clean separation enables testing and flexibility.
**Consequences:**
- CLI returns builtPrompt in JSON output
- Frontend/skill must invoke LLM with prepared prompt
- Clear separation of orchestration vs execution

---

## DEC-004: Memory Namespace Convention
**Date:** 2026-01-04
**Status:** Final
**Decision:** Use hierarchical namespace convention for memory keys
**Context:** Need organized storage for cross-agent knowledge sharing
**Pattern:**
```
project/{area}/{key}    - Project-specific knowledge
patterns/{name}         - Reusable patterns
general/{key}           - Uncategorized
```
**Rationale:** Enables precise memory retrieval by future agents. Follows Claude Flow recommendations.
**Consequences:**
- All agents must follow namespace convention
- Memory queries are scoped and efficient
- Cross-agent coordination is explicit

---

## DEC-005: Frontend Architecture
**Date:** 2026-01-04
**Status:** Final
**Decision:** React + Vite frontend with Express API server bridging to CLI
**Context:** Need polished UX that uses full orchestration infrastructure
**Options Considered:**
- Direct LLM calls from frontend: Bypasses orchestration
- WebSocket to daemon: Complex, overkill
- HTTP API to CLI wrapper: Simple, uses full infrastructure
**Rationale:** Express server calls CLI with --json flag, parses output, returns to frontend. Full orchestration benefits with simple architecture.
**Consequences:**
- API server must handle CLI process spawning
- Response times include CLI startup overhead
- Full routing/memory/context features available

---

## DEC-006: Cold Start Behavior
**Date:** 2026-01-04
**Status:** Final
**Decision:** Progressive transition from keyword to semantic matching
**Context:** System has no history on first use
**Phases:**
- 0-10 executions: 80% keyword, 20% semantic
- 10-50 executions: 50% keyword, 50% semantic  
- 50+ executions: 20% keyword, 80% semantic
**Rationale:** Keyword matching is reliable without training data. Semantic matching improves with accumulated context. Progressive blend enables learning.
**Consequences:**
- Early routing may favor keyword matches
- Confidence capped at 0.8 during cold start
- System improves over time

---

