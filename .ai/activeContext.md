# Active Context - God Agent Orchestration

## Last Updated
2026-01-04 by system

## Current Focus
God Agent orchestration system with intelligent task triaging and multi-agent coordination.

## Active Session
**Status:** Ready
**Mode:** Orchestrated Multi-Agent

## Orchestration Configuration

### Agent Selection Strategy
The routing engine uses a multi-factor scoring system:
1. **Semantic Similarity** (60-80%): Vector embedding match between task and agent capabilities
2. **Keyword Matching** (20-40%): Verb and domain keyword overlap
3. **Domain Match** (20% bonus): Agent specializes in detected task domain
4. **Historical Success** (10%): Agent's past performance on similar tasks

### Cold Start Behavior
- Executions 0-10: Keyword-only matching
- Executions 10-50: Blended keyword + semantic matching
- Executions 50+: Full learned routing with semantic emphasis

### Confirmation Thresholds
- **Auto Execute** (≥0.9): High confidence, proceed automatically
- **Show Decision** (0.7-0.9): Display routing decision, proceed
- **Confirm** (0.5-0.7): Require user confirmation
- **Select** (<0.5): Require user to select from alternatives

## Available Agents

### Core Agents
| Agent | Command | Domain | Capabilities |
|-------|---------|--------|--------------|
| god-ask | `ask` | General | Multi-purpose Q&A, auto-detection |
| god-code | `code` | Code | Implementation, debugging, refactoring |
| god-research | `research` | Research | Deep analysis, synthesis |
| god-write | `write` | Writing | Documents, articles, creative |

### Specialized Agents (via .claude/agents/)
- Analysis agents (code analysis, data analysis)
- Architecture agents (system design, observability)
- Testing agents (unit, integration, e2e)
- Documentation agents (technical writing)
- Research agents (academic, business)

## Memory Namespaces

### Convention
```
project/events      - Event schemas and structures
project/api         - API contracts and endpoints
project/frontend    - Frontend components and patterns
project/database    - Database schemas
project/tests       - Test documentation
project/docs        - General documentation
patterns            - Reusable implementation patterns
general             - Uncategorized knowledge
```

## Recent Decisions
- [2026-01-04] Orchestration uses vector embeddings from gte-Qwen2-1.5B-instruct model
- [2026-01-04] Routing is deterministic (no external LLM calls)
- [2026-01-04] Frontend API server bridges to CLI for orchestration

## Current Blockers
None

## Open Questions
None

## Next Steps
1. User submits task via frontend
2. API server calls CLI with task
3. CLI analyzes task and selects agent
4. Selected agent processes task
5. Results returned through API to frontend
6. Feedback loop improves future routing

## Session Notes
The orchestration system is fully operational with:
- Embedding API running on port 8000
- ChromaDB for vector storage
- Memory server for context persistence
- Observability daemon for metrics
- Frontend on port 5173
- API server on port 4200

