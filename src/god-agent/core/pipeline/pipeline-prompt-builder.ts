/**
 * DAI-002: Pipeline Prompt Builder
 * TASK-003: Builds forward-looking prompts for pipeline agents
 *
 * RULE-007: Forward-Looking Agent Prompts
 * - Every agent prompt MUST include workflow context
 * - Agents MUST know their position in pipeline
 * - Agents MUST know what previous agents produced
 * - Agents MUST know what next agents need
 *
 * This achieves 88% success rate vs 60% without context (per constitution)
 */

import type { AgentRegistry } from '../agents/agent-registry.js';
import type { IPipelineDefinition, IPipelineStep } from './dai-002-types.js';
import { DEFAULT_MIN_QUALITY } from './dai-002-types.js';

// ==================== Prompt Context Interface ====================

/**
 * Context data used to build a pipeline prompt
 */
export interface IPromptContext {
  /** Current step being executed */
  step: IPipelineStep;
  /** Index of current step (0-based) */
  stepIndex: number;
  /** Full pipeline definition */
  pipeline: IPipelineDefinition;
  /** Unique pipeline execution ID */
  pipelineId: string;
  /** Optional initial input for first agent */
  initialInput?: unknown;
}

/**
 * Built prompt result
 */
export interface IBuiltPrompt {
  /** The complete prompt string */
  prompt: string;
  /** Agent key (resolved or from step) */
  agentKey: string | undefined;
  /** Agent description if available */
  agentDescription: string | undefined;
  /** Step number (1-based for display) */
  stepNumber: number;
  /** Total steps in pipeline */
  totalSteps: number;
}

// ==================== Pipeline Prompt Builder ====================

/**
 * Builds forward-looking prompts for pipeline agents.
 * Implements RULE-007: Every prompt includes workflow context.
 *
 * @example
 * ```typescript
 * const builder = new PipelinePromptBuilder(agentRegistry);
 * const prompt = builder.buildPrompt({
 *   step: pipelineStep,
 *   stepIndex: 0,
 *   pipeline: pipelineDefinition,
 *   pipelineId: 'pip_123'
 * });
 * ```
 */
export class PipelinePromptBuilder {
  /**
   * Create a new prompt builder
   * @param agentRegistry - Registry to look up agent descriptions
   */
  constructor(private readonly agentRegistry: AgentRegistry) {}

  /**
   * Build a forward-looking prompt for a pipeline step.
   * Includes workflow context, memory retrieval, task, and memory storage sections.
   *
   * @param context - Context containing step, pipeline, and execution info
   * @returns Built prompt with metadata
   */
  buildPrompt(context: IPromptContext): IBuiltPrompt {
    const { step, stepIndex, pipeline, pipelineId, initialInput } = context;
    const totalSteps = pipeline.agents.length;
    const previousStep = stepIndex > 0 ? pipeline.agents[stepIndex - 1] : undefined;
    const nextStep = stepIndex < totalSteps - 1 ? pipeline.agents[stepIndex + 1] : undefined;

    // Look up agent definition if available
    const agentDef = step.agentKey
      ? this.agentRegistry.getByKey(step.agentKey)
      : undefined;

    const prompt = this.assemblePrompt({
      step,
      stepIndex,
      totalSteps,
      pipelineId,
      pipelineName: pipeline.name,
      agentDef,
      previousStep,
      nextStep,
      initialInput,
    });

    return {
      prompt,
      agentKey: step.agentKey,
      agentDescription: agentDef?.description,
      stepNumber: stepIndex + 1,
      totalSteps,
    };
  }

  /**
   * Assemble the full prompt from sections
   */
  private assemblePrompt(params: {
    step: IPipelineStep;
    stepIndex: number;
    totalSteps: number;
    pipelineId: string;
    pipelineName: string;
    agentDef?: { key: string; description?: string };
    previousStep?: IPipelineStep;
    nextStep?: IPipelineStep;
    initialInput?: unknown;
  }): string {
    const {
      step,
      stepIndex,
      totalSteps,
      pipelineId,
      pipelineName,
      agentDef,
      previousStep,
      nextStep,
      initialInput,
    } = params;

    const sections: string[] = [];

    // 1. Agent Header
    sections.push(this.buildAgentHeader(step, agentDef));

    // 2. Workflow Context (RULE-007)
    sections.push(this.buildWorkflowContext(
      stepIndex,
      totalSteps,
      pipelineName,
      pipelineId,
      previousStep,
      nextStep
    ));

    // 3. Memory Retrieval Section
    sections.push(this.buildMemoryRetrievalSection(step, pipelineId, initialInput, stepIndex));

    // 4. Task Section
    sections.push(this.buildTaskSection(step));

    // 5. Memory Storage Section
    sections.push(this.buildMemoryStorageSection(step, stepIndex, pipelineId));

    // 6. Quality Requirements
    sections.push(this.buildQualitySection(step));

    // 7. Success Criteria
    sections.push(this.buildSuccessCriteria(step, nextStep));

    return sections.join('\n\n---\n\n');
  }

  /**
   * Build agent header section
   */
  private buildAgentHeader(
    step: IPipelineStep,
    agentDef?: { key: string; description?: string }
  ): string {
    const agentName = step.agentKey || 'TBD (DAI-001 Selection)';
    const descLine = agentDef?.description
      ? `\n**Description:** ${agentDef.description}`
      : '';

    return `## Agent: ${agentName}${descLine}`;
  }

  /**
   * Build workflow context section (RULE-007 core requirement)
   */
  private buildWorkflowContext(
    stepIndex: number,
    totalSteps: number,
    pipelineName: string,
    pipelineId: string,
    previousStep?: IPipelineStep,
    nextStep?: IPipelineStep
  ): string {
    return `## WORKFLOW CONTEXT
Agent #${stepIndex + 1} of ${totalSteps}
Pipeline: ${pipelineName} (ID: ${pipelineId})
Previous: ${this.formatPreviousContext(previousStep)}
Next: ${this.formatNextContext(nextStep)}`;
  }

  /**
   * Format previous agent context
   */
  formatPreviousContext(previousStep?: IPipelineStep): string {
    if (!previousStep) {
      return 'none (first agent)';
    }
    const agentName = previousStep.agentKey || 'previous-agent';
    return `${agentName} (${previousStep.outputDomain})`;
  }

  /**
   * Format next agent context
   */
  formatNextContext(nextStep?: IPipelineStep): string {
    if (!nextStep) {
      return 'none (FINAL agent)';
    }
    const agentName = nextStep.agentKey || 'next-agent';
    const needs = nextStep.inputDomain || 'your output';
    return `${agentName} (needs: ${needs})`;
  }

  /**
   * Build memory retrieval section
   */
  buildMemoryRetrievalSection(
    step: IPipelineStep,
    pipelineId: string,
    initialInput?: unknown,
    stepIndex?: number
  ): string {
    // First agent with initial input
    if (stepIndex === 0 && initialInput !== undefined) {
      return `## MEMORY RETRIEVAL (initial input)
Initial input provided:
\`\`\`json
${JSON.stringify(initialInput, null, 2)}
\`\`\``;
    }

    // First agent without input domain
    if (!step.inputDomain) {
      return `## MEMORY RETRIEVAL (N/A - first agent)
No previous agent output to retrieve - you are the first agent.`;
    }

    // Build retrieval code
    const tagsFilter = step.inputTags?.length
      ? ` &&\n  k.tags?.some(t => ['${step.inputTags!.join("', '")}'].includes(t))`
      : '';

    return `## MEMORY RETRIEVAL (from previous agent)
Retrieve previous agent's output:
\`\`\`typescript
const previousOutput = interactionStore.getKnowledgeByDomain('${step.inputDomain}');
const filtered = previousOutput.filter(k =>
  k.tags?.includes('${pipelineId}')${tagsFilter}
);
const data = JSON.parse(filtered[0]?.content || '{}');
\`\`\``;
  }

  /**
   * Build task section
   */
  private buildTaskSection(step: IPipelineStep): string {
    return `## YOUR TASK
${step.task}`;
  }

  /**
   * Build memory storage section
   */
  buildMemoryStorageSection(
    step: IPipelineStep,
    stepIndex: number,
    pipelineId: string
  ): string {
    const agentKey = step.agentKey || 'selected-agent';
    const tagsArray = [...step.outputTags, pipelineId, `step-${stepIndex}`];
    const tagsStr = tagsArray.map(t => `'${t}'`).join(', ');

    return `## MEMORY STORAGE (REQUIRED)
After completing your task, store your output for the next agent:
\`\`\`typescript
await agent.storeKnowledge({
  content: JSON.stringify({
    stepIndex: ${stepIndex},
    agentKey: '${agentKey}',
    output: YOUR_OUTPUT_HERE,
    pipelineId: '${pipelineId}'
  }),
  category: 'pipeline-step',
  domain: '${step.outputDomain}',
  tags: [${tagsStr}]
});
\`\`\`

**CRITICAL:** Store your output BEFORE completing. The next agent depends on it.`;
  }

  /**
   * Build quality requirements section
   */
  private buildQualitySection(step: IPipelineStep): string {
    const minQuality = step.minQuality ?? DEFAULT_MIN_QUALITY;
    return `## QUALITY REQUIREMENTS
- Minimum quality threshold: ${minQuality}
- Provide feedback to ReasoningBank after completion`;
  }

  /**
   * Build success criteria section
   */
  private buildSuccessCriteria(step: IPipelineStep, nextStep?: IPipelineStep): string {
    const minQuality = step.minQuality ?? DEFAULT_MIN_QUALITY;
    const nextAgentNote = nextStep
      ? `5. Next agent (${nextStep.agentKey || 'next-agent'}) can retrieve your output`
      : '5. Pipeline completion (you are the final agent)';

    return `## SUCCESS CRITERIA
1. Task completed successfully
2. Output stored in InteractionStore with correct domain/tags
3. Quality >= ${minQuality}
4. Response follows TASK COMPLETION SUMMARY format
${nextAgentNote}`;
  }
}

// ==================== Factory Function ====================

/**
 * Create a PipelinePromptBuilder with a given agent registry
 * @param agentRegistry - Initialized agent registry
 * @returns PipelinePromptBuilder instance
 */
export function createPipelinePromptBuilder(
  agentRegistry: AgentRegistry
): PipelinePromptBuilder {
  return new PipelinePromptBuilder(agentRegistry);
}
