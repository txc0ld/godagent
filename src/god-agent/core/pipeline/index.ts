/**
 * God Agent Pipeline Module
 *
 * TASK-PHD-001 - 48-Agent PhD Pipeline
 * - 48 agents across 7 phases
 * - DAG-based dependency management
 * - Critical agent validation
 * - Integration with Relay Race and Shadow Vector
 *
 * DAI-002 - Multi-Agent Sequential Pipeline Orchestration
 * - Sequential execution (RULE-004: no Promise.all)
 * - Memory coordination via InteractionStore (RULE-005)
 * - DAI-001 AgentSelector integration (RULE-006)
 * - Forward-looking prompts (RULE-007)
 */

import { getPhDPipelineConfig } from './phd-pipeline-config.js';

// ===== PHD PIPELINE ORCHESTRATOR =====

export {
  PhDPipelineOrchestrator,
  type IAgentExecutor,
  type IShadowTracker,
} from './phd-pipeline-orchestrator.js';

// ===== PHD PIPELINE CONFIG TYPE (for god-agent.ts compatibility) =====

/**
 * Configuration interface for god-agent.ts integration
 */
export interface PhdPipelineConfig {
  relayRace?: unknown;
  attentionFactory?: unknown;
  memoryEngine?: unknown;
  verbose?: boolean;
  [key: string]: unknown;
}

/**
 * Wrapper class for god-agent.ts compatibility
 * Accepts simplified config and creates proper orchestrator
 */
export class PhdPipelineOrchestrator {
  private config: PhdPipelineConfig;
  private initialized: boolean = false;

  constructor(config: PhdPipelineConfig) {
    this.config = config;
    // The orchestrator is created lazily or during initialization
  }

  /**
   * Initialize the pipeline (if needed)
   */
  async initialize(): Promise<{ success: boolean }> {
    this.initialized = true;
    return { success: true };
  }

  /**
   * Check if pipeline is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the underlying config
   */
  getConfig(): PhdPipelineConfig {
    return this.config;
  }

  /**
   * Get a standardized pipeline config for the full orchestrator
   */
  static getPipelineConfig() {
    return getPhDPipelineConfig();
  }
}

// ===== PIPELINE CONFIGURATION =====

export {
  PHD_PIPELINE_CONFIG,
  getPhDPipelineConfig,
  getAgentById,
  getAgentByKey,
  getAgentsByPhase,
  getCriticalAgents,
} from './phd-pipeline-config.js';

// ===== TYPE DEFINITIONS =====

export {
  DEFAULT_AGENT_TIMEOUT,
  CRITICAL_AGENT_KEYS,
  PHASE_NAMES,
  PipelineConfigError,
  PipelineExecutionError,
  CriticalAgentError,
  createPipelineState,
  generatePipelineId,
  isCriticalAgent,
} from './pipeline-types.js';

export type {
  AgentId,
  AgentKey,
  PhaseId,
  IAgentConfig,
  IPhaseConfig,
  IPipelineMetadata,
  IPipelineConfig,
  AgentStatus,
  IAgentExecutionRecord,
  IPipelineState,
  IPipelineProgress,
} from './pipeline-types.js';

// ===== PIPELINE BRIDGE =====

export {
  PipelineBridge,
  type IPipelineBridgeConfig,
  type ITopologicalSortResult,
  type IMappedAgentDefinition,
} from './pipeline-bridge.js';

export {
  PhDPipelineBridge,
  createPhDPipelineBridge,
  PHASE_QUALITY_REQUIREMENTS,
  CITATION_REQUIREMENTS,
  WRITING_PHASE_ID,
  QA_PHASE_ID,
} from './phd-pipeline-bridge.js';

// ===== QUALITY GATE VALIDATION =====

export {
  QualityGateValidator,
  createPhDQualityGateValidator,
  DEFAULT_QUALITY_RULES,
  type IQualityCheck,
  type IQualityValidationResult,
  type IQualityRule,
} from './quality-gate-validator.js';

// ===== PHD PIPELINE RUNNER =====

export {
  PhDPipelineRunner,
  createPhDPipelineRunner,
  type IPhDPipelineRunnerOptions,
  type IRunnerStats,
  type IRunResult,
  type IMemoryEngine,
} from './phd-pipeline-runner.js';

// ============================================================================
// DAI-002: MULTI-AGENT SEQUENTIAL PIPELINE ORCHESTRATION
// ============================================================================

// ===== DAI-002 ERROR CLASSES =====

export {
  // Base error
  PipelineError,
  // Specific errors
  PipelineDefinitionError,
  PipelineExecutionError as DAI002ExecutionError,  // Alias to avoid conflict
  MemoryCoordinationError,
  QualityGateError,
  PipelineTimeoutError,
  AgentSelectionError,
  // Type guards
  isPipelineError,
  isPipelineDefinitionError,
  isPipelineExecutionError,
  isMemoryCoordinationError,
  isQualityGateError,
  isPipelineTimeoutError,
  isAgentSelectionError,
  // Factory helpers
  createMissingFieldError,
  createInvalidAgentError,
  wrapAsPipelineExecutionError,
} from './pipeline-errors.js';

// ===== DAI-002 TYPE DEFINITIONS =====

export type {
  // Pipeline definition types
  IPipelineDefinition,
  IPipelineStep,
  IPipelineStepStorage,
  // Event types
  IPipelineEvent,
  PipelineEventType,
  // Result types
  IStepResult as DAI002StepResult,
  IPipelineResult as DAI002PipelineResult,
  IPipelineOptions as DAI002PipelineOptions,
} from './dai-002-types.js';

export {
  PipelineEventType as DAI002EventType,
  // Constants
  DEFAULT_STEP_TIMEOUT,
  DEFAULT_PIPELINE_TIMEOUT,
  DEFAULT_MIN_QUALITY,
  // Utility functions (generatePipelineId already exported from pipeline-types.js)
  generatePipelineTrajectoryId,
  calculateOverallQuality,
} from './dai-002-types.js';

// ===== DAI-002 PIPELINE VALIDATOR =====

export {
  PipelineValidator,
  createPipelineValidator,
  type IValidationResult,
} from './pipeline-validator.js';

// ===== DAI-002 PIPELINE PROMPT BUILDER =====

export {
  PipelinePromptBuilder,
  createPipelinePromptBuilder,
  type IPromptContext,
  type IBuiltPrompt,
} from './pipeline-prompt-builder.js';

// ===== DAI-002 PIPELINE MEMORY COORDINATOR =====

export {
  PipelineMemoryCoordinator,
  createPipelineMemoryCoordinator,
  type IMemoryCoordinatorConfig,
  type IStoreResult,
  type IRetrieveResult,
} from './pipeline-memory-coordinator.js';

// ===== DAI-002 PIPELINE EXECUTOR =====

export {
  PipelineExecutor,
  createPipelineExecutor,
  type IPipelineExecutorConfig,
  type IStepExecutor,
  type IStepExecutionResult,
} from './pipeline-executor.js';

// Note: IPipelineOptions, IPipelineResult, IStepResult are re-exported from dai-002-types.ts above
// as DAI002PipelineOptions, DAI002PipelineResult, DAI002StepResult

// ===== DAI-002 COMMAND TASK BRIDGE =====

export {
  CommandTaskBridge,
  createCommandTaskBridge,
  // Types
  type IComplexityAnalysis,
  type IPipelineDecision,
  type IAgentMapping,
  type ICommandTaskBridgeConfig,
  type TaskType,
  // Constants
  DEFAULT_PIPELINE_THRESHOLD,
  PHASE_KEYWORDS,
  DOCUMENT_KEYWORDS,
  MULTI_STEP_PATTERNS,
  CONNECTOR_WORDS,
  DEFAULT_PHASE_MAPPINGS,
  DOCUMENT_AGENT_MAPPING,
} from './command-task-bridge.js';
