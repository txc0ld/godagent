# God Agent System Constitution
<!-- version="1.0" last_updated="2026-01-04" -->

## Metadata
- **Project Name:** God Agent - Self-Learning AI System
- **Spec Version:** 1.0.0
- **Authors:** God Agent Team

## Tech Stack

### Core Languages & Frameworks
| Component | Language | Framework | Version |
|-----------|----------|-----------|---------|
| Backend | TypeScript | Node.js | 22.x |
| Embedding API | Python | FastAPI | 0.100+ |
| Frontend | TypeScript | React + Vite | 5.x |
| Vector Store | Python | ChromaDB | 0.5+ |

### Required Libraries
- `better-sqlite3` - Local database
- `sentence-transformers` - Embedding model
- `tsx` - TypeScript execution
- `express` - API server
- `framer-motion` - Frontend animations

## Directory Structure
```
/
├── .ai/                          # AI context and memory
│   ├── activeContext.md          # Current session state
│   ├── decisionLog.md            # Architectural decisions
│   └── progress.md               # Roadmap completion status
├── .claude/agents/               # Agent definitions
├── specs/
│   ├── constitution.md           # This file
│   ├── functional/               # What to build
│   ├── technical/                # How to build
│   └── tasks/                    # Atomic work units
├── src/god-agent/
│   ├── universal/                # Universal agent CLI
│   ├── core/
│   │   ├── routing/              # Task analysis & agent selection
│   │   ├── memory/               # Knowledge persistence
│   │   ├── vector-db/            # Embedding storage
│   │   └── hooks/                # Event hooks
│   └── observability/            # Metrics & monitoring
├── frontend/                     # React application
│   ├── src/
│   └── server/                   # API server
└── embedding-api/                # Python embedding service
```

## Coding Standards

### Naming Conventions
- **Files:** kebab-case (e.g., `routing-engine.ts`)
- **Classes:** PascalCase (e.g., `RoutingEngine`)
- **Functions:** camelCase, verb-first (e.g., `analyzeTask`)
- **Variables:** camelCase
- **Constants:** SCREAMING_SNAKE_CASE
- **Interfaces:** IPascalCase (e.g., `IRoutingResult`)
- **Types:** TPascalCase (e.g., `TTaskDomain`)

### File Organization
- One class per file
- Co-locate tests with source as `[name].test.ts`
- Export via index.ts barrel files
- Maximum file size: 500 lines

### Error Handling
- All async operations must have explicit error handling
- Use typed Error classes (e.g., `RoutingError`)
- Log errors with context before re-throwing
- User-facing errors must be sanitized

## Anti-Patterns (FORBIDDEN)

| Pattern | Reason |
|---------|--------|
| `var` keyword | Use `const` or `let` |
| Hardcoded secrets | Use environment variables |
| Magic numbers | Define named constants |
| `console.log` in production | Use proper logging |
| `any` type | Use specific types |
| Inline SQL strings | Use parameterized queries |
| Direct LLM calls in routing | Routing must be deterministic |

## Security Requirements

| ID | Requirement |
|----|-------------|
| SEC-01 | All user input must be validated and sanitized |
| SEC-02 | API keys stored in environment variables only |
| SEC-03 | No sensitive data in logs or error messages |
| SEC-04 | Rate limiting on all public endpoints |
| SEC-05 | CORS configured for allowed origins only |

## Performance Budgets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Task Analysis | < 150ms P95 | Including embedding generation |
| Agent Routing | < 150ms P95 | Post-analysis selection |
| API Response | < 500ms P95 | Full request cycle |
| Embedding Generation | < 100ms P95 | Single text embedding |
| Frontend Initial Load | < 3s | On 3G connection |

## Testing Requirements

### Coverage Minimum
- 80% line coverage

### Required Tests
| Type | Scope |
|------|-------|
| Unit | All business logic (routing, analysis) |
| Integration | API endpoints, CLI commands |
| E2E | Critical user journeys |

## Orchestration Rules

### Agent Selection (RULE-ORCH-001)
Every routing decision MUST:
1. Include explanation of selection rationale
2. List contributing factors with weights
3. Provide alternatives with scores
4. Indicate cold start phase if applicable

### Memory Coordination (RULE-ORCH-002)
Agents MUST:
1. Store results in appropriate namespace
2. Include memory path in output
3. Specify what future agents should retrieve

### Sequential Execution (RULE-ORCH-003)
- 99.9% of tasks require sequential execution
- Parallel only for read-only operations
- Never parallel backend + frontend modifications

### Context Persistence (RULE-ORCH-004)
- Update activeContext.md at session end
- Log significant decisions to decisionLog.md
- Track progress in progress.md

## API Conventions

### REST Endpoints
```
POST /api/ask       - General questions
POST /api/code      - Code generation
POST /api/research  - Research tasks
POST /api/write     - Content writing
POST /api/feedback  - Learning feedback
GET  /api/status    - System status
GET  /api/agents    - List available agents
```

### Response Format
```json
{
  "command": "string",
  "selectedAgent": "string",
  "prompt": "string",
  "isPipeline": boolean,
  "result": { ... },
  "success": boolean,
  "error": "string (optional)",
  "trajectoryId": "string (optional)"
}
```

## Version Control

### Commit Messages
```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore
Scope: routing, memory, api, frontend, etc.
```

### Branch Strategy
- `main` - Production ready
- `develop` - Integration branch
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches

