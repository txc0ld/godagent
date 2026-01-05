#!/usr/bin/env npx tsx
/**
 * Store Claude Code Hooks documentation in InteractionStore
 *
 * Implements: TECH-HKS-001 documentation storage
 *
 * This script stores metadata about the hooks documentation for future agent retrieval.
 */

import { UniversalAgent } from '../src/god-agent/universal/universal-agent.js';

async function main(): Promise<void> {
  console.log('[store-hooks-documentation] Initializing God Agent...');

  const agent = new UniversalAgent({ verbose: false });
  await agent.initialize();

  console.log('[store-hooks-documentation] Storing documentation metadata...');

  // Store main documentation reference
  await agent.storeKnowledge({
    content: JSON.stringify({
      path: './docs/CLAUDE-CODE-HOOKS-USER-GUIDE.md',
      title: 'Claude Code Hooks User Guide',
      description: 'Complete user documentation for HKS-001 Claude Code Hooks integration including pre-task context injection, post-task findings extraction, and ReasoningBank feedback',
      version: '1.0.0',
      components: [
        'ContextInjector - Pre-task memory query and injection',
        'OutputExtractor - Post-task TASK COMPLETION SUMMARY parsing',
        'FeedbackSubmitter - Quality estimation and ReasoningBank feedback',
        'Shell wrappers - Timeout enforcement and error handling'
      ],
      keyFeatures: [
        'Automatic context injection from InteractionStore',
        'TASK COMPLETION SUMMARY extraction',
        'Heuristic parsing fallback',
        'Quality estimation (0-1 score)',
        'Retry queue for failed feedback',
        'JSON logging to stderr'
      ],
      relatedFiles: [
        '.claude/hooks/pre-task.sh',
        '.claude/hooks/post-task.sh',
        '.claude/hooks/config.json',
        'scripts/hooks/context-injector.ts',
        'scripts/hooks/output-extractor.ts',
        'scripts/hooks/feedback-submitter.ts',
        'scripts/hooks/hook-types.ts',
        'scripts/hooks/hook-logger.ts'
      ],
      testFiles: [
        'tests/hooks/pre-task.test.ts',
        'tests/hooks/post-task.test.ts',
        'tests/hooks/e2e.test.ts'
      ]
    }),
    category: 'documentation',
    domain: 'project/docs',
    tags: ['hooks', 'hks-001', 'claude-code', 'documentation', 'user-guide']
  });

  // Store technical architecture reference
  await agent.storeKnowledge({
    content: JSON.stringify({
      system: 'Claude Code Hooks',
      specId: 'HKS-001',
      architecture: {
        preTaskHook: {
          entryPoint: '.claude/hooks/pre-task.sh',
          implementation: 'scripts/hooks/pre-task.ts',
          services: ['ContextInjector'],
          flow: 'Shell wrapper → TypeScript → InteractionStore query → Context formatting → Prompt injection'
        },
        postTaskHook: {
          entryPoint: '.claude/hooks/post-task.sh',
          implementation: 'scripts/hooks/post-task.ts',
          services: ['OutputExtractor', 'FeedbackSubmitter'],
          flow: 'Shell wrapper → TypeScript → Summary extraction → InteractionStore storage → ReasoningBank feedback'
        }
      },
      exitCodes: {
        0: 'SUCCESS',
        1: 'ERROR',
        2: 'VALIDATION_FAILURE',
        3: 'TIMEOUT'
      },
      constitution: {
        'AP-001': 'No fallbacks - throw on null dependencies',
        'GUARD-HKS-004': 'Write verification via read-back',
        'SEC-HKS-004': 'Input sanitization for domains/tags',
        'FM-HKS-003': 'Heuristic parser for missing TASK COMPLETION SUMMARY'
      }
    }),
    category: 'architecture',
    domain: 'project/hooks',
    tags: ['architecture', 'hks-001', 'technical', 'hooks-system']
  });

  // Store TASK COMPLETION SUMMARY format reference
  await agent.storeKnowledge({
    content: JSON.stringify({
      format: 'TASK COMPLETION SUMMARY',
      purpose: 'Structured output format for subagent memory coordination',
      sections: {
        'What I Did': 'Required - 1-2 sentence summary',
        'Files Created/Modified': 'Optional - List of file paths with descriptions',
        'InteractionStore Entries': 'Required - Domain/tags/description for each entry',
        'ReasoningBank Feedback': 'Optional - Trajectory ID, quality (0-1), outcome',
        'Query Commands': 'Optional - TypeScript code examples for retrieval',
        'Next Agent Guidance': 'Required - Instructions for future agents'
      },
      example: `## TASK COMPLETION SUMMARY

**What I Did**: Implemented user API with CRUD endpoints.

**Files Created/Modified**:
- \`./src/users/api.ts\` - User API implementation

**InteractionStore Entries** (for orchestration):
- Domain: \`project/api\`, Tags: \`['users', 'crud']\` - User endpoint schemas

**ReasoningBank Feedback**:
- Trajectory: \`trj_abc123\` - Quality: \`0.95\`, Outcome: \`positive\`

**Next Agent Guidance**: Frontend agents should query domain \`project/api\` with tag \`users\`.`
    }),
    category: 'protocol',
    domain: 'project/hooks',
    tags: ['task-completion-summary', 'output-format', 'subagent-protocol', 'memory-coordination']
  });

  console.log('[store-hooks-documentation] Documentation stored successfully!');
  console.log('[store-hooks-documentation] Query with:');
  console.log('  - interactionStore.getKnowledgeByDomain("project/docs")');
  console.log('  - interactionStore.getKnowledgeByDomain("project/hooks")');

  process.exit(0);
}

main().catch((error) => {
  console.error('[store-hooks-documentation] ERROR:', error);
  process.exit(1);
});
