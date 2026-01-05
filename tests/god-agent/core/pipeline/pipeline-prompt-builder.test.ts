/**
 * DAI-002: Pipeline Prompt Builder Tests
 * TASK-003: Tests for PipelinePromptBuilder class
 *
 * RULE-002: No mock data - uses REAL agents from AgentRegistry
 * RULE-007: Verifies forward-looking prompts with workflow context
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  PipelinePromptBuilder,
  createPipelinePromptBuilder,
  IPromptContext,
  IBuiltPrompt,
} from '../../../../src/god-agent/core/pipeline/pipeline-prompt-builder.js';
import type { IPipelineDefinition, IPipelineStep } from '../../../../src/god-agent/core/pipeline/dai-002-types.js';
import { AgentRegistry } from '../../../../src/god-agent/core/agents/agent-registry.js';

// ==================== Test Setup ====================

describe('PipelinePromptBuilder', () => {
  let registry: AgentRegistry;
  let builder: PipelinePromptBuilder;
  let realAgentKey: string;
  let realAgentKey2: string;
  let realAgentKey3: string;

  beforeAll(async () => {
    // RULE-002: Use REAL agents from the registry
    registry = new AgentRegistry({ basePath: '.claude/agents', verbose: false });
    await registry.initialize('.claude/agents');

    // Get real agent keys for tests
    const allAgents = registry.getAll();
    expect(allAgents.length).toBeGreaterThan(3);
    realAgentKey = allAgents[0].key;
    realAgentKey2 = allAgents[1].key;
    realAgentKey3 = allAgents[2].key;

    builder = createPipelinePromptBuilder(registry);
  });

  afterAll(() => {
    registry.clear();
  });

  // ==================== Factory Function Tests ====================

  describe('createPipelinePromptBuilder', () => {
    it('should create a PipelinePromptBuilder instance', () => {
      const b = createPipelinePromptBuilder(registry);
      expect(b).toBeInstanceOf(PipelinePromptBuilder);
    });
  });

  // ==================== Basic Prompt Building ====================

  describe('buildPrompt', () => {
    it('should build a prompt with all required sections', () => {
      const pipeline = createTestPipeline([realAgentKey]);
      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test_123',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('## Agent:');
      expect(result.prompt).toContain('## WORKFLOW CONTEXT');
      expect(result.prompt).toContain('## MEMORY RETRIEVAL');
      expect(result.prompt).toContain('## YOUR TASK');
      expect(result.prompt).toContain('## MEMORY STORAGE');
      expect(result.prompt).toContain('## QUALITY REQUIREMENTS');
      expect(result.prompt).toContain('## SUCCESS CRITERIA');
    });

    it('should return metadata about the prompt', () => {
      const pipeline = createTestPipeline([realAgentKey, realAgentKey2]);
      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test_123',
      };

      const result = builder.buildPrompt(context);

      expect(result.agentKey).toBe(realAgentKey);
      expect(result.stepNumber).toBe(1);
      expect(result.totalSteps).toBe(2);
    });
  });

  // ==================== RULE-007: Workflow Context ====================

  describe('workflow context (RULE-007)', () => {
    it('should include agent position in pipeline', () => {
      const pipeline = createTestPipeline([realAgentKey, realAgentKey2, realAgentKey3]);

      // Test middle agent
      const context: IPromptContext = {
        step: pipeline.agents[1],
        stepIndex: 1,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('Agent #2 of 3');
    });

    it('should include pipeline name and ID', () => {
      const pipeline = createTestPipeline([realAgentKey]);
      pipeline.name = 'my-custom-pipeline';

      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_abc123',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('Pipeline: my-custom-pipeline');
      expect(result.prompt).toContain('pip_abc123');
    });

    it('should indicate first agent has no previous', () => {
      const pipeline = createTestPipeline([realAgentKey, realAgentKey2]);

      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('Previous: none (first agent)');
    });

    it('should indicate final agent has no next', () => {
      const pipeline = createTestPipeline([realAgentKey, realAgentKey2]);

      const context: IPromptContext = {
        step: pipeline.agents[1],
        stepIndex: 1,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('Next: none (FINAL agent)');
    });

    it('should include previous agent info for middle agents', () => {
      const pipeline = createTestPipeline([realAgentKey, realAgentKey2, realAgentKey3]);
      pipeline.agents[0].outputDomain = 'project/first-output';

      const context: IPromptContext = {
        step: pipeline.agents[1],
        stepIndex: 1,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain(`Previous: ${realAgentKey}`);
      expect(result.prompt).toContain('project/first-output');
    });

    it('should include next agent info for middle agents', () => {
      const pipeline = createTestPipeline([realAgentKey, realAgentKey2, realAgentKey3]);
      pipeline.agents[2].inputDomain = 'project/expected-input';

      const context: IPromptContext = {
        step: pipeline.agents[1],
        stepIndex: 1,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain(`Next: ${realAgentKey3}`);
      expect(result.prompt).toContain('needs: project/expected-input');
    });
  });

  // ==================== Memory Retrieval Section ====================

  describe('buildMemoryRetrievalSection', () => {
    it('should indicate N/A for first agent without input', () => {
      const step: IPipelineStep = {
        agentKey: realAgentKey,
        task: 'Test task',
        outputDomain: 'project/output',
        outputTags: ['test'],
      };

      const result = builder.buildMemoryRetrievalSection(step, 'pip_123', undefined, 0);

      expect(result).toContain('N/A - first agent');
      expect(result).toContain('you are the first agent');
    });

    it('should include initial input for first agent with input', () => {
      const step: IPipelineStep = {
        agentKey: realAgentKey,
        task: 'Test task',
        outputDomain: 'project/output',
        outputTags: ['test'],
      };

      const initialInput = { key: 'value', count: 42 };
      const result = builder.buildMemoryRetrievalSection(step, 'pip_123', initialInput, 0);

      expect(result).toContain('initial input');
      expect(result).toContain('"key": "value"');
      expect(result).toContain('"count": 42');
    });

    it('should include retrieval code for subsequent agents', () => {
      const step: IPipelineStep = {
        agentKey: realAgentKey,
        task: 'Test task',
        inputDomain: 'project/previous-output',
        outputDomain: 'project/output',
        outputTags: ['test'],
      };

      const result = builder.buildMemoryRetrievalSection(step, 'pip_123', undefined, 1);

      expect(result).toContain('from previous agent');
      expect(result).toContain("getKnowledgeByDomain('project/previous-output')");
      expect(result).toContain("includes('pip_123')");
    });

    it('should include tag filter when inputTags provided', () => {
      const step: IPipelineStep = {
        agentKey: realAgentKey,
        task: 'Test task',
        inputDomain: 'project/previous-output',
        inputTags: ['schema', 'api'],
        outputDomain: 'project/output',
        outputTags: ['test'],
      };

      const result = builder.buildMemoryRetrievalSection(step, 'pip_123', undefined, 1);

      expect(result).toContain("'schema'");
      expect(result).toContain("'api'");
    });
  });

  // ==================== Memory Storage Section ====================

  describe('buildMemoryStorageSection', () => {
    it('should include storeKnowledge code', () => {
      const step: IPipelineStep = {
        agentKey: realAgentKey,
        task: 'Test task',
        outputDomain: 'project/my-output',
        outputTags: ['impl', 'feature'],
      };

      const result = builder.buildMemoryStorageSection(step, 2, 'pip_456');

      expect(result).toContain('storeKnowledge');
      expect(result).toContain("domain: 'project/my-output'");
      expect(result).toContain("'impl'");
      expect(result).toContain("'feature'");
      expect(result).toContain("'pip_456'");
      expect(result).toContain("'step-2'");
    });

    it('should include step index and pipeline ID in content', () => {
      const step: IPipelineStep = {
        agentKey: realAgentKey,
        task: 'Test task',
        outputDomain: 'project/output',
        outputTags: ['test'],
      };

      const result = builder.buildMemoryStorageSection(step, 3, 'pip_789');

      expect(result).toContain('stepIndex: 3');
      expect(result).toContain("pipelineId: 'pip_789'");
    });

    it('should emphasize the CRITICAL storage requirement', () => {
      const step: IPipelineStep = {
        agentKey: realAgentKey,
        task: 'Test task',
        outputDomain: 'project/output',
        outputTags: ['test'],
      };

      const result = builder.buildMemoryStorageSection(step, 0, 'pip_test');

      expect(result).toContain('CRITICAL');
      expect(result).toContain('next agent depends on it');
    });
  });

  // ==================== Agent Description ====================

  describe('agent description', () => {
    it('should include agent description when available', () => {
      const pipeline = createTestPipeline([realAgentKey]);
      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);
      const agentDef = registry.getByKey(realAgentKey);

      // If the agent has a description, it should be in the prompt
      if (agentDef?.description) {
        expect(result.prompt).toContain(agentDef.description);
        expect(result.agentDescription).toBe(agentDef.description);
      }
    });

    it('should handle step without agentKey (DAI-001 selection)', () => {
      const pipeline: IPipelineDefinition = {
        name: 'test-pipeline',
        description: 'Test',
        agents: [{
          taskDescription: 'Implement authentication',
          task: 'Do the task',
          outputDomain: 'project/output',
          outputTags: ['test'],
        }],
        sequential: true,
      };

      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('DAI-001 Selection');
      expect(result.agentKey).toBeUndefined();
    });
  });

  // ==================== Quality Requirements ====================

  describe('quality requirements', () => {
    it('should include default quality threshold', () => {
      const pipeline = createTestPipeline([realAgentKey]);
      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('0.7'); // Default threshold
    });

    it('should include custom quality threshold', () => {
      const pipeline = createTestPipeline([realAgentKey]);
      pipeline.agents[0].minQuality = 0.85;

      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('0.85');
    });

    it('should mention ReasoningBank feedback', () => {
      const pipeline = createTestPipeline([realAgentKey]);
      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('ReasoningBank');
    });
  });

  // ==================== Success Criteria ====================

  describe('success criteria', () => {
    it('should include task completion requirement', () => {
      const pipeline = createTestPipeline([realAgentKey]);
      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('Task completed successfully');
    });

    it('should include InteractionStore storage requirement', () => {
      const pipeline = createTestPipeline([realAgentKey]);
      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('InteractionStore');
    });

    it('should mention TASK COMPLETION SUMMARY format', () => {
      const pipeline = createTestPipeline([realAgentKey]);
      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('TASK COMPLETION SUMMARY');
    });

    it('should mention next agent for non-final steps', () => {
      const pipeline = createTestPipeline([realAgentKey, realAgentKey2]);
      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('Next agent');
      expect(result.prompt).toContain('can retrieve your output');
    });

    it('should indicate pipeline completion for final agent', () => {
      const pipeline = createTestPipeline([realAgentKey, realAgentKey2]);
      const context: IPromptContext = {
        step: pipeline.agents[1],
        stepIndex: 1,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('Pipeline completion');
      expect(result.prompt).toContain('final agent');
    });
  });

  // ==================== Task Section ====================

  describe('task section', () => {
    it('should include the task from the step', () => {
      const pipeline = createTestPipeline([realAgentKey]);
      pipeline.agents[0].task = 'Implement REST API for user management';

      const context: IPromptContext = {
        step: pipeline.agents[0],
        stepIndex: 0,
        pipeline,
        pipelineId: 'pip_test',
      };

      const result = builder.buildPrompt(context);

      expect(result.prompt).toContain('Implement REST API for user management');
    });
  });

  // ==================== formatPreviousContext / formatNextContext ====================

  describe('formatPreviousContext', () => {
    it('should return "none (first agent)" for undefined', () => {
      const result = builder.formatPreviousContext(undefined);
      expect(result).toBe('none (first agent)');
    });

    it('should include agent key and domain', () => {
      const step: IPipelineStep = {
        agentKey: 'backend-dev',
        task: 'Test',
        outputDomain: 'project/api',
        outputTags: ['test'],
      };

      const result = builder.formatPreviousContext(step);

      expect(result).toContain('backend-dev');
      expect(result).toContain('project/api');
    });

    it('should handle missing agentKey', () => {
      const step: IPipelineStep = {
        taskDescription: 'Some task',
        task: 'Test',
        outputDomain: 'project/output',
        outputTags: ['test'],
      };

      const result = builder.formatPreviousContext(step);

      expect(result).toContain('previous-agent');
      expect(result).toContain('project/output');
    });
  });

  describe('formatNextContext', () => {
    it('should return "none (FINAL agent)" for undefined', () => {
      const result = builder.formatNextContext(undefined);
      expect(result).toBe('none (FINAL agent)');
    });

    it('should include agent key and needs', () => {
      const step: IPipelineStep = {
        agentKey: 'tester',
        task: 'Test',
        inputDomain: 'project/implementation',
        outputDomain: 'project/tests',
        outputTags: ['test'],
      };

      const result = builder.formatNextContext(step);

      expect(result).toContain('tester');
      expect(result).toContain('needs: project/implementation');
    });

    it('should handle missing inputDomain', () => {
      const step: IPipelineStep = {
        agentKey: 'reviewer',
        task: 'Test',
        outputDomain: 'project/reviews',
        outputTags: ['test'],
      };

      const result = builder.formatNextContext(step);

      expect(result).toContain('reviewer');
      expect(result).toContain('needs: your output');
    });
  });

  // ==================== Real Agent Integration (RULE-002) ====================

  describe('real agent integration (RULE-002)', () => {
    it('should build prompts for multi-agent pipeline with real agents', async () => {
      const allAgents = registry.getAll();
      const agents = allAgents.slice(0, 4);

      const pipeline: IPipelineDefinition = {
        name: 'real-agent-pipeline',
        description: 'Pipeline with real agents',
        agents: agents.map((agent, index) => ({
          agentKey: agent.key,
          task: `Task ${index + 1} for ${agent.key}`,
          inputDomain: index > 0 ? `project/step-${index - 1}` : undefined,
          outputDomain: `project/step-${index}`,
          outputTags: [`step-${index}`, agent.key],
        })),
        sequential: true,
      };

      // Build prompts for all steps
      const prompts: IBuiltPrompt[] = [];
      for (let i = 0; i < pipeline.agents.length; i++) {
        const context: IPromptContext = {
          step: pipeline.agents[i],
          stepIndex: i,
          pipeline,
          pipelineId: 'pip_real_test',
        };
        prompts.push(builder.buildPrompt(context));
      }

      // Verify all prompts were built
      expect(prompts.length).toBe(4);

      // Verify first agent has no previous
      expect(prompts[0].prompt).toContain('Previous: none');

      // Verify last agent is marked final
      expect(prompts[3].prompt).toContain('Next: none (FINAL agent)');

      // Verify middle agents have previous and next
      expect(prompts[1].prompt).toContain('Previous: ' + agents[0].key);
      expect(prompts[1].prompt).toContain('Next: ' + agents[2].key);
    });
  });
});

// ==================== Test Helpers ====================

/**
 * Create a test pipeline with given agent keys
 */
function createTestPipeline(agentKeys: string[]): IPipelineDefinition {
  return {
    name: 'test-pipeline',
    description: 'Test pipeline',
    agents: agentKeys.map((key, index) => ({
      agentKey: key,
      task: `Task ${index + 1}`,
      inputDomain: index > 0 ? `project/input-${index}` : undefined,
      outputDomain: `project/output-${index}`,
      outputTags: [`tag-${index}`],
    })),
    sequential: true,
  };
}
