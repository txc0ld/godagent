# Claude Flow: Universal Development Guide

## ⚠️ GOLDEN RULE: 99.9% Sequential Execution
## ALWAYS USE AGENTDB REASONING BANK!
## 🔮 CRITICAL: Forward-Looking Subagent Coordination

## ⚠️ CRITICAL SYNTAX WARNING: Memory Store Commands

**CORRECT SYNTAX (Positional Arguments)**:
```bash
npx claude-flow memory store "<key>" '<json-value>' --namespace "<namespace>"
```

**WRONG SYNTAX (Will Fail)**:
```bash
❌ npx claude-flow memory store --namespace "..." --key "..." --value "..."  # INCORRECT!
❌ npx claude-flow memory store --key "..." --value "..." --namespace "..."  # INCORRECT!
```

**Examples**:
```bash
✅ npx claude-flow memory store "api-schema" '{"endpoints": [...]}' --namespace "project/api"
✅ npx claude-flow memory store "bug-fix" '{"issue": "...", "solution": "..."}' --namespace "project/bugs"
```

**Why This Matters**: ReasoningBank mode expects positional arguments. Using flags will cause "Usage: memory store <key> <value> --reasoningbank" errors.

**Can Task B start BEFORE Task A finishes?**
- **NO (99.9%)** → Sequential (separate messages)
- **YES (0.1% - read-only only)** → Parallel (single message)

**When prompting subagents, ALWAYS include:**
1. **Future agent context** - What agents spawn after this
2. **Downstream requirements** - What future agents need
3. **Memory guidance** - What to store for future utility
4. **Namespace strategy** - Where to place memories

**Common Dependencies** (require sequential):
- Backend → Frontend integration
- API schema → Client implementation
- Database schema → Backend → Frontend
- Event structure → Handlers → UI
- File modification → Tests

**Parallel ONLY when**:
- Read-only analysis
- Independent linters/formatters
- Zero modifications

## Essential Commands

```bash
# Setup (ALWAYS FIRST)
npx claude-flow@alpha init
npx claude-flow@alpha agent memory init      # 88% success vs 60%
npx claude-flow@alpha agent memory status

# Memory (CORRECT SYNTAX - positional arguments!)
npx claude-flow memory store "name" '{"key":"value"}' --namespace "project/area"
npx claude-flow memory retrieve --key "project/area/name"

# Coordination
npx claude-flow coordination swarm-init --topology [centralized|hierarchical|mesh]
npx claude-flow coordination task-orchestrate --strategy sequential

# Hooks
npx claude-flow hooks pre-task --description "task"
npx claude-flow hooks post-edit --file "path" --memory-key "key"
npx claude-flow hooks session-end --export-metrics

# Analysis
npx claude-flow analysis bottleneck-detect
npx claude-flow analysis token-usage --breakdown
npx claude-flow agent booster edit  # 352x faster
```

## 🔮 Forward-Looking Subagent Coordination

### Critical: Subagents Have No Memory

Each subagent starts clean. They can't see previous work unless you:
1. Tell them where to look in memory
2. Tell them what to store for future agents

### Optimal Subagent Prompt Pattern

When spawning ANY subagent, include 4-part context:

```bash
Task("[agent-type]", `
  ## YOUR TASK
  [Primary task]

  ## WORKFLOW CONTEXT
  Agent #N of M | Previous: [what, where stored] | Next: [who, what they need]

  ## MEMORY RETRIEVAL
  npx claude-flow memory retrieve --key "project/[namespace]"
  Understand: [schemas/decisions/constraints from previous agents]

  ## MEMORY STORAGE (For Next Agents)
  1. For [Next Agent]: key "project/[ns]/[key]" - [what/why]
  2. For [Future Agent]: key "project/[ns]/[key]" - [what/why]

  ## STEPS
  1. Retrieve memories
  2. Validate data
  3. Execute task
  4. Store memories
  5. Verify: npx claude-flow memory retrieve --key "[your-key]"

  ## SUCCESS
  - Task complete
  - Memories stored
  - Next agents have what they need
`)
```

### Example: 4-Agent Feature Workflow

```bash
# TodoWrite - batch all todos
TodoWrite({ todos: [
  {id: "1", content: "Backend: Implement feature", status: "pending"},
  {id: "2", content: "Integration: Add types", status: "pending"},
  {id: "3", content: "UI: Build component", status: "pending"},
  {id: "4", content: "Tests: Integration tests", status: "pending"}
]})

# Agent 1: Backend (Message 1)
Task("backend-dev", `
  ## TASK: Implement backend feature
  ## CONTEXT: Agent #1/4 | Next: Integration (needs schema), UI (needs viz), Tests (needs endpoints)
  ## RETRIEVAL: npx claude-flow memory retrieve --key "project/analysis/feature"
  ## STORAGE:
  1. For Integration: "project/events/schema" - TypeScript interface
  2. For UI: "project/frontend/requirements" - viz specs
  3. For Tests: "project/api/changes" - test scenarios
`)

# Agent 2: Integration (Message 2 - WAIT)
Task("coder", `
  ## TASK: Update integration types
  ## CONTEXT: Agent #2/4 | Previous: Backend ✓ | Next: UI, Tests
  ## RETRIEVAL: npx claude-flow memory retrieve --key "project/events/schema"
  ## STORAGE: For UI: "project/frontend/handler" - subscription pattern
`)

# Agent 3: UI (Message 3 - WAIT)
Task("coder", `
  ## TASK: Build UI component
  ## CONTEXT: Agent #3/4 | Previous: Backend, Integration ✓ | Next: Tests
  ## RETRIEVAL:
    npx claude-flow memory retrieve --key "project/frontend/requirements"
    npx claude-flow memory retrieve --key "project/frontend/handler"
  ## STORAGE: For Tests: "project/frontend/component" - location, selectors
`)

# Agent 4: Tests (Message 4 - WAIT)
Task("tester", `
  ## TASK: Integration tests
  ## CONTEXT: Agent #4/4 (FINAL) | Previous: All ✓
  ## RETRIEVAL: All keys from agents 1-3
  ## STORAGE: "project/tests/docs" - coverage, issues
`)
```

### Why Forward-Looking Works: 88% vs 60%

**Without**: Agents ask for info → delays, rework, 60% success, 2.5x slower
**With**: Agents store what's needed → 0 questions, 88% success, 1.85x faster

## Sequential Workflow Pattern

```bash
# Message 1: Backend
Task("backend-dev", `
  CONTEXT: Agent #1/4 | Next: Integration, UI, Tests
  TASK: Implement backend
  STORAGE: Store schemas for next 3 agents
`)
TodoWrite({ todos: [5-10 phases] })

# Message 2: Integration (WAIT)
Task("coder", `
  CONTEXT: Agent #2/4 | Previous: Backend ✓ | Next: UI, Tests
  RETRIEVAL: npx claude-flow memory retrieve --key "project/events/[name]"
  TASK: Update types
  STORAGE: Store handler for UI
`)

# Message 3: UI (WAIT)
Task("coder", `
  CONTEXT: Agent #3/4 | Previous: Backend, Integration ✓ | Next: Tests
  RETRIEVAL: Retrieve requirements + handler
  TASK: Build UI
  STORAGE: Store component location for Tests
`)

# Message 4: Tests (WAIT)
Task("tester", `
  CONTEXT: Agent #4/4 (FINAL) | Previous: All ✓
  RETRIEVAL: All keys from previous agents
  TASK: Integration tests
  STORAGE: Coverage report
`)
```

## Memory Namespace Convention

```bash
project/events/[type]      # Event schemas
project/api/[endpoint]     # API schemas
project/database/[table]   # DB schemas
project/frontend/[comp]    # Frontend patterns
project/performance/[ana]  # Performance data
project/bugs/[issue]       # Bug analysis
project/tests/[feature]    # Test docs
```

**Handoff Pattern**: Store → Wait → Retrieve

## Key Agents (66+ available)

| Agent | Use |
|-------|-----|
| `backend-dev` | APIs, events, routes |
| `coder` | Components, stores, UI |
| `code-analyzer` | Analysis, architecture |
| `tester` | Integration tests |
| `perf-analyzer` | Profiling, bottlenecks |
| `system-architect` | Architecture, data flow |
| `tdd-london-swarm` | TDD workflows |

**Coordinators**: `hierarchical-coordinator` (4-6 agents), `mesh-coordinator` (7+), `adaptive-coordinator` (dynamic)

## Topology Selection

| Agents | Topology | When |
|--------|----------|------|
| 1-3 | centralized | Simple fixes |
| 4-6 | hierarchical | Typical features |
| 7+ | mesh/adaptive | Major changes |

## Critical Rules

### ✅ ALWAYS
1. Sequential by default (99.9%)
2. Init ReasoningBank: `agent memory init` (88% vs 60%)
3. Forward-looking prompts (tell agents about future needs)
4. Store schemas in memory
5. Memory coordination (Backend → Frontend)
6. Batch TodoWrite (5-10+ todos)
7. Use hooks (pre-task, post-edit, session-end)
8. Include WORKFLOW CONTEXT in every Task()

### ❌ NEVER
1. Parallel backend + frontend (missing schemas)
2. Skip memory coordination (type mismatches)
3. Frontend before backend (missing contracts)
4. Skip ReasoningBank init (60% success)
5. Prompt without future context (60% success, delays)
6. Forget to tell where to retrieve memories (blind agents)

## Common Mistakes & Fixes

| Mistake | Fix |
|---------|-----|
| Parallel backend + frontend | Sequential: Backend stores → Frontend retrieves |
| No contract in memory | Store schema: `hooks post-edit --memory-key "project/api/[name]"` |
| Uncoordinated DB changes | Schema-first: Design → Store → Backend → Frontend |
| Skip ReasoningBank | Init: `agent memory init` + `agent memory status` |
| No future context | Include WORKFLOW CONTEXT in prompts |
| Missing retrieval info | Explicit keys: `memory retrieve --key "[key]"` |
| Unused stored memories | List future agents, what/why they need it |

## Performance

| Technique | Speedup | When | Risk |
|-----------|---------|------|------|
| Sequential + memory | 1.85x | Always | ✅ Safe |
| ReasoningBank | 1.85x | Always | ✅ Safe |
| Booster editing | 352x | Large batches | ✅ Safe |
| Adaptive topology | 1.5-2x | Complex | ✅ Safe |
| Parallel | 2.8-4.4x | Read-only ONLY | ⚠️ HIGH |

**WARNING**: Parallel with dependencies = failure

## Quick Reference

```bash
# 1. INIT
npx claude-flow@alpha agent memory init
npx claude-flow@alpha agent memory status

# 2. TASK PROMPT TEMPLATE
Task("[type]", `
  CONTEXT: Agent #N/M | Previous: [agents] | Next: [agents + needs]
  RETRIEVAL: npx claude-flow memory retrieve --key "[keys]"
  TASK: [task]
  STORAGE: For [Next]: "project/[ns]/[key]" - [what/why]
`)

# 3. WORKFLOW
Msg 1: Backend → Store schemas
Msg 2: Integration → Retrieve, update, store handler
Msg 3: UI → Retrieve, build, store location
Msg 4: Tests → Retrieve all, test

# 4. MEMORY KEYS
project/events/[e], project/api/[a], project/database/[d],
project/frontend/[f], project/performance/[p], project/bugs/[b], project/tests/[t]

# 5. AGENTS
backend-dev, coder, code-analyzer, tester, perf-analyzer, system-architect

# 6. RULES
✅ Sequential (99.9%), Forward-looking, Store for future, Batch todos
❌ Parallel backend+frontend, Skip context, Skip memory
```

## Key Takeaways

1. **99.9% Sequential** - Dependencies require it
2. **Forward-Looking** - Tell agents about future needs (88% vs 60%)
3. **Memory Coordination** - Backend → Frontend flow
4. **ReasoningBank First** - Init for 88% success
5. **Batch TodoWrite** - 5-10+ todos
6. **WORKFLOW CONTEXT** - Every Task() needs it
7. **If Uncertain** - Sequential (safer)

**Remember**: Sequential by default. Forward-looking prompts. Memory handoffs. Claude Flow coordinates, Claude Code executes.


## Truth & Quality Protocol

**Principle 0: Radical Candor - Truth Above All**

Subagents MUST be brutally honest. No lies, simulations, or illusions of functionality.

### Core Requirements:
1. **Absolute Truthfulness** - State only verified, factual information
2. **No Fallbacks** - Don't invent workarounds unless user approves
3. **No Illusions** - Never mislead about what works/doesn't work
4. **Fail Honestly** - If infeasible, state facts clearly

### Communication Style (INTJ + Type 8):
- **Direct** - Brutal honesty, no sugar-coating
- **Fact-Driven** - Logic and verification over feelings
- **Confrontational** - Challenge incorrect assumptions
- **Impatient** - No tolerance for inefficiency

### Key Phrases:
- "That won't work because..."
- "You're incorrect about..."
- "I cannot verify that claim"
- "Based on verifiable evidence..."
- "I will not simulate non-existent functionality"

### ALWAYS Inspect Subagent Results
Verify subagents are honest and truthful. Challenge any misleading output.

## Task Execution Protocol

### Core Framework

**1. Self-Assessment (Required)**
- After each task: Rate 1-100 vs user intent
- If < 100: Document gaps, iterate to 100
- Don't proceed until perfect score

**2. Verification**
- Spawn "reviewer subagent" to:
  - Verify intent match
  - Check edge cases
  - Validate success criteria
  - Suggest improvements

### Key Principles:
- Complete = 100/100 alignment
- Full context across subagents
- Document iterations
- Quality > speed

### Design Principles

**KISS** - Simple > complex. Easier to maintain/debug.

**YAGNI** - Build only what's needed now.

**Architecture**:
- Dependency Inversion - Depend on abstractions
- Open/Closed - Open for extension, closed for modification
- Single Responsibility - One purpose per unit
- Fail Fast - Check errors early

### Code Structure

**Limits**:
- Files: < 500 lines (refactor if larger)
- Functions: < 50 lines, single responsibility
- Classes: < 100 lines, single concept
- Organize by feature/responsibility

**After Implementing**: Create validation script

**Avoid**: Backward compatibility (unless needed), unnecessary complexity

**Goal**: Simplest implementation that fully meets requirements

**YOU MUST** Any documents that get created need to have their file location + brief description of the document put into the memory system so future agents can access it if they need that information. Make sure all subagents are aware to check the memory for past information that could be helpful to completing their objectives.

---

## #IMPORTANT: Subagent Memory & Response Protocol

### Critical: Maximum Claude Flow & Memory Utilization

**All subagents spawned by Claude Code MUST:**

1. **#IMPORTANT: Make MAXIMUM use of Claude Flow**
   - Use ALL applicable Claude Flow commands for coordination
   - Leverage memory system extensively for ALL findings
   - Follow optimal Claude Flow patterns as documented above

2. **#IMPORTANT: Save EVERYTHING to Memory & Docs**
   - **Memory System**: Store ALL findings, decisions, schemas, analyses
   - **./docs/ Directory**: Save ALL .md files to `/docs/` directory (NEVER root)
   - **ReasoningBank**: Use AgentDB Reasoning Bank for persistent knowledge
   - **Namespace Convention**: Follow `project/[area]/[key]` structure

3. **#IMPORTANT: Memory Storage Requirements**
   ```bash
   # Store every significant finding (CORRECT SYNTAX: key and value are positional!)
   npx claude-flow memory store "[name]" '{"data":"value"}' --namespace "project/[area]"

   # Save documentation files to docs/
   Write "./docs/[descriptive-name].md"

   # Store file metadata in memory (CORRECT SYNTAX: key and value are positional!)
   npx claude-flow memory store "[name]" '{"path": "./docs/[name].md", "description": "..."}' --namespace "project/docs"
   ```

4. **#IMPORTANT: Concise Response Format (REQUIRED)**

   When subagents complete their work, they MUST respond with:

   ```
   ## TASK COMPLETION SUMMARY

   **What I Did**: [1-2 sentence summary]

   **Files Created/Modified**:
   - `./docs/[filename].md` - [Brief description]
   - `./src/[filename].ts` - [Brief description]

   **Memory Locations** (for orchestration):
   - `project/[area]/[key1]` - [What it contains, why next agents need it]
   - `project/[area]/[key2]` - [What it contains, why next agents need it]

   **ReasoningBank Paths**:
   - `[namespace]/[path]` - [What's stored, how to access]

   **Access Commands**:
   ```bash
   # Retrieve this agent's findings
   npx claude-flow memory retrieve --key "project/[area]/[key]"

   # View documentation
   cat ./docs/[filename].md
   ```

   **Next Agent Guidance**: [What future agents should retrieve/know]
   ```

5. **#IMPORTANT: Why This Matters**
   - **Context Window Management**: Main Claude Code orchestrates efficiently without overfilling context
   - **Precise Agent Targeting**: Main agent can direct future subagents to EXACT memory locations
   - **Zero Redundancy**: Future agents retrieve only what they need
   - **Full Traceability**: All work documented with clear access paths

### Example Subagent Response

```
## TASK COMPLETION SUMMARY

**What I Did**: Analyzed Example backend event structure and documented SSE payload schemas for all 6 workflow stages.

**Files Created/Modified**:
- `./docs/app-event-schemas.md` - Complete SSE event payload specifications
- `./docs/app-backend-analysis.md` - Backend event emission patterns and timing

**Memory Locations** (for orchestration):
- `project/events/app-schema` - All 6 stage SSE payload structures (for Frontend integration)
- `project/api/app-endpoints` - Backend endpoint contracts (for Testing)
- `project/performance/event-timing` - Event emission timing data (for Optimization)

**ReasoningBank Paths**:
- `app/backend/events` - Event architecture decisions and rationale
- `app/schema/validation` - Schema validation rules

**Access Commands**:
```bash
# Retrieve event schemas
npx claude-flow memory retrieve --key "project/events/app-schema"

# View documentation
cat ./docs/app-event-schemas.md
cat ./docs/app-backend-analysis.md
```

**Next Agent Guidance**: Frontend agents should retrieve `project/events/app-schema` to implement TypeScript interfaces. Testing agents need `project/api/app-endpoints` for integration tests.
```

### Enforcement Checklist

Every subagent MUST verify before responding:
- [ ] Used Claude Flow commands extensively
- [ ] Stored ALL findings in memory with clear namespaces
- [ ] Saved ALL .md files to `./docs/` directory
- [ ] Response includes exact memory paths
- [ ] Response includes ReasoningBank locations
- [ ] Response includes access commands
- [ ] Response includes next agent guidance
- [ ] Response is concise (not verbose)
- [ ] Main agent can route future work efficiently

**Result**: Main Claude Code can orchestrate subagents with surgical precision, directing them to exact memory locations without context overload.