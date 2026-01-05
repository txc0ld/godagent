/**
 * Project Scaffolding Service
 * 
 * Creates project infrastructure based on detected requirements:
 * - Directory structure
 * - Specification documents (PRD, SPEC, TECH, TASKS, CONSTITUTION)
 * - AI tracking files
 * - Claude Flow configuration
 * 
 * @module src/god-agent/core/project/project-scaffolder
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { IProjectAnalysis, ProjectType } from './project-detector.js';

// ==================== Types ====================

export interface IScaffoldConfig {
  /** Project root directory */
  projectRoot: string;
  
  /** Project analysis from detector */
  analysis: IProjectAnalysis;
  
  /** Original user input */
  userInput: string;
  
  /** Optional project ID (auto-generated if not provided) */
  projectId?: string;
  
  /** Whether to overwrite existing files */
  overwrite?: boolean;
}

export interface IScaffoldResult {
  /** Whether scaffolding succeeded */
  success: boolean;
  
  /** Project ID */
  projectId: string;
  
  /** Created directories */
  directories: string[];
  
  /** Created files */
  files: string[];
  
  /** Errors if any */
  errors: string[];
  
  /** Paths to key documents */
  paths: {
    docsRoot?: string;
    specsRoot?: string;
    aiTrackingRoot?: string;
    prd?: string;
    spec?: string;
    tech?: string;
    tasks?: string;
    constitution?: string;
  };
}

// ==================== Template Generators ====================

/**
 * Generate PRD document
 */
function generatePRD(
  projectId: string,
  projectName: string,
  userInput: string,
  features: string[],
  complexity: string
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const reqIds = features.map((f, i) => `REQ-${projectId.toUpperCase()}-${String(i + 1).padStart(3, '0')}`);
  
  return `# Product Requirements Document
<!-- PRD-${projectId.toUpperCase()}-001 | Version 1.0 | ${timestamp} -->

## Document Control
| Field | Value |
|-------|-------|
| Document ID | PRD-${projectId.toUpperCase()}-001 |
| Version | 1.0 |
| Status | Draft |
| Created | ${timestamp} |
| Last Updated | ${timestamp} |

## 1. Executive Summary

### 1.1 Project Overview
**Project Name:** ${projectName}
**Complexity:** ${complexity}

### 1.2 Problem Statement
${userInput}

### 1.3 Objectives
- Deliver a fully functional solution meeting all requirements
- Ensure code quality through comprehensive testing
- Follow best practices and architectural standards

## 2. Functional Requirements

### 2.1 Core Requirements
${features.map((f, i) => `
#### ${reqIds[i]}: ${f.charAt(0).toUpperCase() + f.slice(1)}
- **Priority:** High
- **Description:** Implement ${f} functionality
- **Acceptance Criteria:**
  - [ ] Feature is fully implemented
  - [ ] Tests pass with >80% coverage
  - [ ] Documentation complete
`).join('\n')}

### 2.2 User Stories
${features.slice(0, 3).map((f, i) => `
#### US-${String(i + 1).padStart(3, '0')}: ${f}
**As a** user
**I want to** use ${f} functionality
**So that** I can achieve my goals efficiently
`).join('\n')}

## 3. Non-Functional Requirements

### 3.1 Performance
| NFR-ID | Requirement | Target |
|--------|-------------|--------|
| NFR-001 | API Response Time | < 200ms P95 |
| NFR-002 | Page Load Time | < 3s on 3G |
| NFR-003 | Concurrent Users | 100+ |

### 3.2 Security
| NFR-ID | Requirement |
|--------|-------------|
| NFR-004 | Input validation on all endpoints |
| NFR-005 | Secure authentication/authorization |
| NFR-006 | No sensitive data in logs |

### 3.3 Reliability
| NFR-ID | Requirement | Target |
|--------|-------------|--------|
| NFR-007 | Uptime | 99.9% |
| NFR-008 | Error Rate | < 0.1% |

## 4. Constraints and Assumptions

### 4.1 Technical Constraints
- Must use TypeScript
- Must include comprehensive tests
- Must follow established coding standards

### 4.2 Assumptions
- Development environment is properly configured
- Required dependencies are available
- Team has necessary expertise

## 5. Success Metrics
- All requirements implemented and tested
- Test coverage > 80%
- All acceptance criteria met
- Documentation complete

## 6. Appendix

### 6.1 Glossary
| Term | Definition |
|------|------------|
| PRD | Product Requirements Document |
| NFR | Non-Functional Requirement |

### 6.2 References
- Constitution: CONSTITUTION-${projectId.toUpperCase()}-001
- Technical Spec: TECH-${projectId.toUpperCase()}-001
- Task Plan: TASKS-${projectId.toUpperCase()}-001
`;
}

/**
 * Generate Functional Specification
 */
function generateSpec(
  projectId: string,
  projectName: string,
  userInput: string,
  features: string[]
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  
  return `# Functional Specification
<!-- SPEC-${projectId.toUpperCase()}-001 | Version 1.0 | ${timestamp} -->

## Document Control
| Field | Value |
|-------|-------|
| Document ID | SPEC-${projectId.toUpperCase()}-001 |
| Version | 1.0 |
| Status | Draft |
| Created | ${timestamp} |
| PRD Reference | PRD-${projectId.toUpperCase()}-001 |

## 1. System Overview

### 1.1 Purpose
${userInput}

### 1.2 Scope
This specification covers the functional behavior of ${projectName}.

## 2. Functional Specifications

${features.map((f, i) => `
### 2.${i + 1} ${f.charAt(0).toUpperCase() + f.slice(1)} Module

#### 2.${i + 1}.1 Description
Implements ${f} functionality as required by REQ-${projectId.toUpperCase()}-${String(i + 1).padStart(3, '0')}.

#### 2.${i + 1}.2 Interfaces
\`\`\`typescript
interface I${f.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Config {
  enabled: boolean;
  options?: Record<string, unknown>;
}
\`\`\`

#### 2.${i + 1}.3 Behavior
1. Initialize module with configuration
2. Validate input parameters
3. Execute core logic
4. Return result or error

#### 2.${i + 1}.4 Error Handling
- Invalid input: Return validation error
- System error: Log and return generic error
- Timeout: Retry with exponential backoff
`).join('\n')}

## 3. Data Flows

### 3.1 Primary Flow
\`\`\`
User Input → Validation → Processing → Output
              ↓              ↓
           Error         Storage
\`\`\`

## 4. State Management

### 4.1 Application States
| State | Description | Transitions |
|-------|-------------|-------------|
| IDLE | Ready for input | → PROCESSING |
| PROCESSING | Handling request | → COMPLETE, ERROR |
| COMPLETE | Request finished | → IDLE |
| ERROR | Error occurred | → IDLE |

## 5. Test Cases

### 5.1 Unit Tests
${features.slice(0, 3).map((f, i) => `
#### TC-${String(i + 1).padStart(3, '0')}: ${f} - Happy Path
- **Given:** Valid input
- **When:** ${f} is invoked
- **Then:** Expected output returned
`).join('\n')}

### 5.2 Integration Tests
- API endpoint integration
- Database operations
- External service communication

### 5.3 Edge Cases
- Empty input handling
- Maximum payload sizes
- Concurrent request handling
`;
}

/**
 * Generate Technical Specification
 */
function generateTech(
  projectId: string,
  projectName: string,
  features: string[],
  complexity: string
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  
  return `# Technical Specification
<!-- TECH-${projectId.toUpperCase()}-001 | Version 1.0 | ${timestamp} -->

## Document Control
| Field | Value |
|-------|-------|
| Document ID | TECH-${projectId.toUpperCase()}-001 |
| Version | 1.0 |
| Status | Draft |
| Created | ${timestamp} |
| PRD Reference | PRD-${projectId.toUpperCase()}-001 |
| SPEC Reference | SPEC-${projectId.toUpperCase()}-001 |

## 1. Architecture Overview

### 1.1 System Architecture
\`\`\`
┌─────────────────────────────────────────────────────┐
│                    CLIENT LAYER                      │
│              (UI / CLI / API Consumers)              │
├─────────────────────────────────────────────────────┤
│                     API LAYER                        │
│              (REST / GraphQL Endpoints)              │
├─────────────────────────────────────────────────────┤
│                   SERVICE LAYER                      │
│              (Business Logic / Domain)               │
├─────────────────────────────────────────────────────┤
│                    DATA LAYER                        │
│              (Database / Cache / Storage)            │
└─────────────────────────────────────────────────────┘
\`\`\`

### 1.2 Technology Stack
| Component | Technology | Version |
|-----------|------------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 22.x |
| Testing | Vitest | Latest |
| Linting | ESLint | Latest |

## 2. Component Design

${features.map((f, i) => `
### 2.${i + 1} ${f.charAt(0).toUpperCase() + f.slice(1)} Component

#### 2.${i + 1}.1 Responsibilities
- Implement ${f} logic
- Handle errors gracefully
- Emit metrics/events

#### 2.${i + 1}.2 Dependencies
- Core utilities
- Database client (if applicable)
- External services (if applicable)

#### 2.${i + 1}.3 File Structure
\`\`\`
src/
├── ${f}/
│   ├── index.ts
│   ├── ${f}.ts
│   ├── ${f}.test.ts
│   └── types.ts
\`\`\`
`).join('\n')}

## 3. Database Schema

### 3.1 Tables
\`\`\`sql
-- Core entities
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data JSON NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);
\`\`\`

## 4. API Endpoints

### 4.1 REST API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/status | System status |
${features.map(f => `| POST | /api/${f} | ${f} operation |`).join('\n')}

### 4.2 Response Format
\`\`\`json
{
  "success": true,
  "data": { ... },
  "error": null,
  "metadata": {
    "timestamp": "ISO-8601",
    "requestId": "uuid"
  }
}
\`\`\`

## 5. Performance Budgets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API P95 | < 200ms | Response time |
| Memory | < 512MB | Peak usage |
| CPU | < 70% | Peak utilization |
| Startup | < 5s | Cold start |

## 6. Security Considerations

### 6.1 Input Validation
- All user input must be validated
- Use parameterized queries
- Sanitize output

### 6.2 Authentication
- JWT-based authentication
- Secure token storage
- Token refresh mechanism

### 6.3 Authorization
- Role-based access control
- Principle of least privilege
- Audit logging

## 7. Deployment

### 7.1 Requirements
- Node.js 22+
- npm 10+
- SQLite 3.x

### 7.2 Configuration
\`\`\`bash
# Environment variables
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
\`\`\`
`;
}

/**
 * Generate Task Plan
 */
function generateTasks(
  projectId: string,
  projectName: string,
  features: string[],
  complexity: string,
  estimatedAgents: number
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Generate sprints based on complexity
  const sprintCount = complexity === 'complex' ? 5 : complexity === 'moderate' ? 3 : 2;
  
  let taskId = 1;
  const tasks: string[] = [];
  
  // Sprint 1: Setup & Foundation
  tasks.push(`
## Sprint 1: Setup & Foundation
**Duration:** 1-2 days
**Goal:** Project structure and core infrastructure

| Task ID | Description | Agent | Dependencies | Est. |
|---------|-------------|-------|--------------|------|
| TASK-${String(taskId++).padStart(3, '0')} | Initialize project structure | system-architect | None | 2h |
| TASK-${String(taskId++).padStart(3, '0')} | Set up build configuration | backend-dev | TASK-001 | 1h |
| TASK-${String(taskId++).padStart(3, '0')} | Configure linting and formatting | backend-dev | TASK-001 | 1h |
| TASK-${String(taskId++).padStart(3, '0')} | Set up testing framework | tester | TASK-002 | 1h |
| TASK-${String(taskId++).padStart(3, '0')} | Create CI/CD pipeline | backend-dev | TASK-002, TASK-004 | 2h |
`);

  // Sprint 2: Core Implementation
  tasks.push(`
## Sprint 2: Core Implementation
**Duration:** 2-3 days
**Goal:** Implement core functionality

| Task ID | Description | Agent | Dependencies | Est. |
|---------|-------------|-------|--------------|------|
${features.map((f, i) => 
  `| TASK-${String(taskId++).padStart(3, '0')} | Implement ${f} module | coder | Sprint 1 | 4h |`
).join('\n')}
| TASK-${String(taskId++).padStart(3, '0')} | Write unit tests for core modules | tester | Previous tasks | 3h |
`);

  // Sprint 3: Integration
  tasks.push(`
## Sprint 3: Integration & Testing
**Duration:** 2-3 days  
**Goal:** Integrate components and comprehensive testing

| Task ID | Description | Agent | Dependencies | Est. |
|---------|-------------|-------|--------------|------|
| TASK-${String(taskId++).padStart(3, '0')} | Integration testing | tester | Sprint 2 | 4h |
| TASK-${String(taskId++).padStart(3, '0')} | API documentation | code-analyzer | Sprint 2 | 2h |
| TASK-${String(taskId++).padStart(3, '0')} | Performance optimization | perf-analyzer | Sprint 2 | 3h |
| TASK-${String(taskId++).padStart(3, '0')} | Code review and refactoring | code-analyzer | All above | 3h |
`);

  if (sprintCount >= 4) {
    tasks.push(`
## Sprint 4: Polish & Documentation
**Duration:** 1-2 days
**Goal:** Final polish and documentation

| Task ID | Description | Agent | Dependencies | Est. |
|---------|-------------|-------|--------------|------|
| TASK-${String(taskId++).padStart(3, '0')} | User documentation | coder | Sprint 3 | 2h |
| TASK-${String(taskId++).padStart(3, '0')} | Error handling improvements | coder | Sprint 3 | 2h |
| TASK-${String(taskId++).padStart(3, '0')} | Final testing and validation | tester | All above | 3h |
`);
  }

  if (sprintCount >= 5) {
    tasks.push(`
## Sprint 5: Deployment & Release
**Duration:** 1 day
**Goal:** Deployment preparation

| Task ID | Description | Agent | Dependencies | Est. |
|---------|-------------|-------|--------------|------|
| TASK-${String(taskId++).padStart(3, '0')} | Deployment configuration | backend-dev | Sprint 4 | 2h |
| TASK-${String(taskId++).padStart(3, '0')} | Security audit | code-analyzer | Sprint 4 | 2h |
| TASK-${String(taskId++).padStart(3, '0')} | Release preparation | system-architect | All above | 1h |
`);
  }

  return `# Task Implementation Plan
<!-- TASKS-${projectId.toUpperCase()}-001 | Version 1.0 | ${timestamp} -->

## Document Control
| Field | Value |
|-------|-------|
| Document ID | TASKS-${projectId.toUpperCase()}-001 |
| Version | 1.0 |
| Status | Draft |
| Created | ${timestamp} |
| PRD Reference | PRD-${projectId.toUpperCase()}-001 |
| Total Tasks | ${taskId - 1} |
| Estimated Duration | ${sprintCount * 2}-${sprintCount * 3} days |

## Overview

### Project Summary
**Name:** ${projectName}
**Complexity:** ${complexity}
**Estimated Agents:** ${estimatedAgents}

### Dependency Order
All agents must follow the dependency order defined below. Tasks within a sprint can be parallelized if dependencies are met.

### Agent Assignment Strategy
| Agent Type | Task Types |
|------------|------------|
| system-architect | Architecture, structure, design |
| backend-dev | Implementation, configuration |
| coder | Feature development |
| tester | Testing, validation |
| code-analyzer | Review, documentation |
| perf-analyzer | Performance optimization |

${tasks.join('\n')}

## Dependency Graph
\`\`\`
Sprint 1 (Foundation)
    │
    ▼
Sprint 2 (Core)
    │
    ▼
Sprint 3 (Integration)
    │
    ▼
Sprint 4 (Polish) [if applicable]
    │
    ▼
Sprint 5 (Deploy) [if applicable]
\`\`\`

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Scope creep | Strict adherence to PRD requirements |
| Integration issues | Early integration testing |
| Performance problems | Continuous performance monitoring |

## Success Criteria
- [ ] All tasks completed
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Code review approved
- [ ] Performance targets met
`;
}

/**
 * Generate Constitution
 */
function generateConstitution(
  projectId: string,
  projectName: string,
  features: string[]
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  
  return `# Project Constitution
<!-- CONSTITUTION-${projectId.toUpperCase()}-001 | Version 1.0 | ${timestamp} -->

## Document Control
| Field | Value |
|-------|-------|
| Document ID | CONSTITUTION-${projectId.toUpperCase()}-001 |
| Version | 1.0 |
| Status | Active |
| Created | ${timestamp} |
| Project | ${projectName} |

## Preamble
This constitution establishes the immutable rules and standards for ${projectName}. All agents and developers MUST adhere to these rules without exception.

## Article 1: Technical Standards

### RULE-001: Language and Runtime
- TypeScript MUST be used for all code
- Node.js 22.x is the target runtime
- ES2022+ features are permitted

### RULE-002: Code Style
- Use kebab-case for file names
- Use PascalCase for classes and interfaces
- Use camelCase for functions and variables
- Use SCREAMING_SNAKE_CASE for constants

### RULE-003: File Organization
- One primary export per file
- Maximum 500 lines per file
- Co-locate tests with source files

### RULE-004: Error Handling
- All async operations MUST have error handling
- Use typed error classes
- Never swallow errors silently

## Article 2: Quality Requirements

### RULE-010: Testing
- Minimum 80% code coverage
- All public APIs MUST have tests
- Tests MUST be deterministic

### RULE-011: Documentation
- All public functions MUST have JSDoc
- README MUST be kept up to date
- Architecture decisions MUST be documented

### RULE-012: Code Review
- All changes MUST be reviewed
- Self-review before requesting review
- Address all review comments

## Article 3: Security

### RULE-020: Input Validation
- ALL user input MUST be validated
- Use parameterized queries only
- Sanitize output to prevent XSS

### RULE-021: Secrets Management
- NO secrets in code
- Use environment variables
- Rotate credentials regularly

### RULE-022: Authentication
- Implement proper authentication
- Use secure session management
- Enforce authorization checks

## Article 4: Performance

### RULE-030: Response Times
- API P95 < 200ms
- Page load < 3s on 3G
- No blocking operations on main thread

### RULE-031: Resource Usage
- Memory usage < 512MB
- CPU usage < 70% sustained
- Optimize database queries

## Article 5: Architecture

### RULE-040: Modularity
- Follow single responsibility principle
- Minimize coupling between modules
- Use dependency injection

### RULE-041: API Design
- Use consistent response formats
- Version APIs appropriately
- Document all endpoints

### RULE-042: Data Integrity
- Validate data at boundaries
- Use transactions where appropriate
- Implement proper backup strategy

## Article 6: Forbidden Patterns

### RULE-050: Anti-Patterns
These patterns are FORBIDDEN:
- \`var\` keyword (use const/let)
- \`any\` type without justification
- Inline SQL strings
- console.log in production
- Hardcoded magic numbers
- Circular dependencies

## Article 7: Agent Coordination

### RULE-060: Claude Flow
- Use sequential execution by default
- Store results in memory for next agent
- Include WORKFLOW CONTEXT in all prompts

### RULE-061: Memory Management
- Use namespace conventions consistently
- Clean up temporary data
- Document memory locations

### RULE-062: Task Handoff
- Report created memories clearly
- Brief next agent on retrieval
- Verify previous work before continuing

## Article 8: Enforcement

### RULE-070: Compliance
- Pre-commit hooks MUST pass
- CI pipeline MUST succeed
- Constitution violations block merge

### RULE-071: Exceptions
- No exceptions without documented justification
- All exceptions require team approval
- Exceptions MUST be time-bounded

## Signatures
This constitution is binding upon acceptance.

---
*Generated by God Agent Project Scaffolder*
*${timestamp}*
`;
}

/**
 * Generate AI tracking files
 */
function generateActiveContext(projectId: string, projectName: string): string {
  const timestamp = new Date().toISOString();
  
  return `# Active Context

## Last Updated
${timestamp} by system

## Current Focus
Project initialization and scaffolding for ${projectName}

## Active Task
**Task ID:** TASK-001
**Status:** Not Started
**Started:** N/A

## Recent Decisions
- Project scaffolded with full specification suite
- Constitution established

## Current Blockers
- None

## Open Questions
- None at this time

## Next Steps
1. Review generated specifications
2. Begin Sprint 1 tasks
3. Set up development environment

## Session Notes
Project ${projectId} initialized with:
- PRD document
- Functional specification
- Technical specification
- Task plan
- Constitution
`;
}

function generateImplementationState(projectId: string, taskCount: number): string {
  const tasks: Record<string, { status: string; startedAt: string | null; completedAt: string | null }> = {};
  
  for (let i = 1; i <= taskCount; i++) {
    tasks[`TASK-${String(i).padStart(3, '0')}`] = {
      status: 'pending',
      startedAt: null,
      completedAt: null,
    };
  }
  
  return JSON.stringify({
    projectId,
    version: '1.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks,
    summary: {
      total: taskCount,
      pending: taskCount,
      inProgress: 0,
      completed: 0,
      blocked: 0,
    },
  }, null, 2);
}

function generateProgress(projectId: string, projectName: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  
  return `# Implementation Progress

## Project: ${projectName}
## ID: ${projectId}

## Overall Status
- **Phase:** Initialization
- **Progress:** 0%
- **Last Updated:** ${timestamp}

## Phase Tracker

### Phase 1: Initialization
- [x] Generate specifications
- [x] Create project structure
- [ ] Review specifications
- [ ] Begin implementation

### Phase 2: Foundation
- [ ] Set up project
- [ ] Configure tooling
- [ ] Create base infrastructure

### Phase 3: Core Implementation
- [ ] Implement core features
- [ ] Write unit tests
- [ ] Integration testing

### Phase 4: Polish
- [ ] Documentation
- [ ] Code review
- [ ] Performance optimization

### Phase 5: Release
- [ ] Final testing
- [ ] Deployment
- [ ] Release notes

## Milestone Tracking

| Milestone | Target | Status |
|-----------|--------|--------|
| Specs Complete | Day 1 | ✓ Done |
| Foundation | Day 2-3 | Pending |
| Core Complete | Day 5-7 | Pending |
| Release Ready | Day 10 | Pending |

## Daily Log

### ${timestamp}
- Project scaffolded
- Specifications generated
- Ready for development
`;
}

// ==================== Scaffolder ====================

export class ProjectScaffolder {
  /**
   * Scaffold a new project based on analysis
   */
  async scaffold(config: IScaffoldConfig): Promise<IScaffoldResult> {
    const result: IScaffoldResult = {
      success: false,
      projectId: config.projectId || this.generateProjectId(),
      directories: [],
      files: [],
      errors: [],
      paths: {},
    };
    
    const { projectRoot, analysis, userInput } = config;
    const projectId = result.projectId;
    const projectName = analysis.suggestedName;
    
    try {
      // Create docs directory structure
      const docsRoot = path.join(projectRoot, 'docs');
      const specsDir = path.join(docsRoot, 'god-agent-specs', projectId);
      const aiTrackingDir = path.join(docsRoot, 'god-agent-specs', `${projectId}-tracking`, '_ai');
      
      result.paths.docsRoot = docsRoot;
      result.paths.specsRoot = specsDir;
      result.paths.aiTrackingRoot = aiTrackingDir;
      
      // Create directories
      const dirs = [
        docsRoot,
        path.join(docsRoot, 'god-agent-specs'),
        specsDir,
        path.join(docsRoot, 'god-agent-specs', `${projectId}-tracking`),
        aiTrackingDir,
      ];
      
      for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
        result.directories.push(dir);
      }
      
      // Generate and write specification documents
      const { infrastructure, detectedFeatures, complexity } = analysis;
      
      if (infrastructure.needsPRD) {
        const prdPath = path.join(specsDir, `PRD-${projectId.toUpperCase()}-001.md`);
        const prdContent = generatePRD(
          projectId,
          projectName,
          userInput,
          detectedFeatures,
          complexity
        );
        await fs.writeFile(prdPath, prdContent, 'utf-8');
        result.files.push(prdPath);
        result.paths.prd = prdPath;
      }
      
      if (infrastructure.needsSpec) {
        const specPath = path.join(specsDir, `SPEC-${projectId.toUpperCase()}-001.md`);
        const specContent = generateSpec(
          projectId,
          projectName,
          userInput,
          detectedFeatures
        );
        await fs.writeFile(specPath, specContent, 'utf-8');
        result.files.push(specPath);
        result.paths.spec = specPath;
      }
      
      if (infrastructure.needsTech) {
        const techPath = path.join(specsDir, `TECH-${projectId.toUpperCase()}-001.md`);
        const techContent = generateTech(
          projectId,
          projectName,
          detectedFeatures,
          complexity
        );
        await fs.writeFile(techPath, techContent, 'utf-8');
        result.files.push(techPath);
        result.paths.tech = techPath;
      }
      
      if (infrastructure.needsTasks) {
        const tasksPath = path.join(specsDir, `TASKS-${projectId.toUpperCase()}-001.md`);
        const tasksContent = generateTasks(
          projectId,
          projectName,
          detectedFeatures,
          complexity,
          infrastructure.estimatedAgents
        );
        await fs.writeFile(tasksPath, tasksContent, 'utf-8');
        result.files.push(tasksPath);
        result.paths.tasks = tasksPath;
      }
      
      if (infrastructure.needsConstitution) {
        const constPath = path.join(specsDir, `CONSTITUTION-${projectId.toUpperCase()}-001.md`);
        const constContent = generateConstitution(
          projectId,
          projectName,
          detectedFeatures
        );
        await fs.writeFile(constPath, constContent, 'utf-8');
        result.files.push(constPath);
        result.paths.constitution = constPath;
      }
      
      // Generate AI tracking files
      if (infrastructure.needsAITracking) {
        // activeContext.md
        const activeContextPath = path.join(aiTrackingDir, 'activeContext.md');
        await fs.writeFile(
          activeContextPath,
          generateActiveContext(projectId, projectName),
          'utf-8'
        );
        result.files.push(activeContextPath);
        
        // implementation-state.json
        const taskCount = 20; // Approximate from tasks document
        const implStatePath = path.join(aiTrackingDir, 'implementation-state.json');
        await fs.writeFile(
          implStatePath,
          generateImplementationState(projectId, taskCount),
          'utf-8'
        );
        result.files.push(implStatePath);
        
        // progress.md
        const progressPath = path.join(aiTrackingDir, 'progress.md');
        await fs.writeFile(
          progressPath,
          generateProgress(projectId, projectName),
          'utf-8'
        );
        result.files.push(progressPath);
      }
      
      result.success = true;
      
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : String(error)
      );
    }
    
    return result;
  }
  
  /**
   * Generate unique project ID
   */
  private generateProjectId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
}

