/**
 * Model Configuration (SPEC-MODEL-001)
 *
 * Centralized configuration for Claude model selection.
 * Updated for Claude 4.5 series (Sonnet 4.5 and Opus 4.5)
 */

export const CLAUDE_MODELS = {
  // Latest Models (Recommended)
  SONNET_4_5: 'claude-sonnet-4-5-20250929',
  OPUS_4_5: 'claude-opus-4-5-20251101',
  HAIKU_4_5: 'claude-haiku-4-5-20251001',

  // Model Aliases (use for auto-update to latest)
  SONNET_LATEST: 'claude-sonnet-4-5',
  OPUS_LATEST: 'claude-opus-4-5',
  HAIKU_LATEST: 'claude-3-5-haiku-latest',

  // Claude 4 Series
  SONNET_4: 'claude-sonnet-4-20250514',
  OPUS_4: 'claude-opus-4-20250514',
  OPUS_4_1: 'claude-opus-4-1-20250805',

  // Claude 3.7 Series
  SONNET_3_7: 'claude-3-7-sonnet-20250219',
  SONNET_3_7_LATEST: 'claude-3-7-sonnet-latest',

  // Claude 3.5 Series (Legacy)
  SONNET_3_5: 'claude-3-5-sonnet-20241022',
  HAIKU_3_5: 'claude-3-5-haiku-20241022',

  // Claude 3 Series (Legacy)
  OPUS_3: 'claude-3-opus-20240229',
  HAIKU_3: 'claude-3-haiku-20240307',
} as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS];

/**
 * Model capabilities and recommended use cases
 */
export const MODEL_CAPABILITIES = {
  [CLAUDE_MODELS.OPUS_4_5]: {
    name: 'Claude Opus 4.5',
    tier: 'flagship',
    contextWindow: 200000,
    maxOutput: 8192,
    strengths: ['Complex reasoning', 'Research', 'Analysis', 'Code architecture'],
    costTier: 'premium',
    recommended: ['god-research', 'complex-analysis', 'architecture-design'],
  },
  [CLAUDE_MODELS.SONNET_4_5]: {
    name: 'Claude Sonnet 4.5',
    tier: 'balanced',
    contextWindow: 200000,
    maxOutput: 8192,
    strengths: ['General tasks', 'Code generation', 'Writing', 'Fast responses'],
    costTier: 'standard',
    recommended: ['god-ask', 'god-code', 'god-write', 'general'],
  },
  [CLAUDE_MODELS.HAIKU_4_5]: {
    name: 'Claude Haiku 4.5',
    tier: 'fast',
    contextWindow: 200000,
    maxOutput: 8192,
    strengths: ['Quick tasks', 'Simple queries', 'High throughput'],
    costTier: 'economy',
    recommended: ['quick-lookup', 'simple-tasks', 'high-volume'],
  },
} as const;

/**
 * Default model configuration
 */
export const DEFAULT_MODELS = {
  // Primary model for general use (balanced cost/performance)
  DEFAULT: CLAUDE_MODELS.SONNET_4_5,

  // Model for complex reasoning tasks
  REASONING: CLAUDE_MODELS.OPUS_4_5,

  // Model for fast, simple tasks
  FAST: CLAUDE_MODELS.HAIKU_4_5,

  // Model for code generation (Opus 4.5 for best code quality)
  CODE: CLAUDE_MODELS.OPUS_4_5,

  // Model for writing tasks
  WRITING: CLAUDE_MODELS.SONNET_4_5,

  // Model for research tasks
  RESEARCH: CLAUDE_MODELS.OPUS_4_5,
} as const;

/**
 * Get the recommended model for a task type
 */
export function getModelForTask(taskType: string): ClaudeModel {
  const taskModelMap: Record<string, ClaudeModel> = {
    'ask': DEFAULT_MODELS.DEFAULT,
    'code': DEFAULT_MODELS.CODE,  // Opus 4.5 for best code quality
    'write': DEFAULT_MODELS.WRITING,
    'research': DEFAULT_MODELS.RESEARCH,
    'analyze': DEFAULT_MODELS.REASONING,
    'quick': DEFAULT_MODELS.FAST,
    'simple': DEFAULT_MODELS.FAST,
    'debug': DEFAULT_MODELS.CODE,  // Also use Opus for debugging
    'refactor': DEFAULT_MODELS.CODE,  // And refactoring
  };

  return taskModelMap[taskType.toLowerCase()] || DEFAULT_MODELS.DEFAULT;
}

/**
 * Model selection based on complexity
 */
export function getModelByComplexity(complexity: 'low' | 'medium' | 'high'): ClaudeModel {
  switch (complexity) {
    case 'low':
      return CLAUDE_MODELS.HAIKU_4_5;
    case 'high':
      return CLAUDE_MODELS.OPUS_4_5;
    default:
      return CLAUDE_MODELS.SONNET_4_5;
  }
}

/**
 * Validate if a model string is valid
 */
export function isValidModel(model: string): model is ClaudeModel {
  return Object.values(CLAUDE_MODELS).includes(model as ClaudeModel);
}

/**
 * Get model info
 */
export function getModelInfo(model: ClaudeModel) {
  const capabilities = MODEL_CAPABILITIES as Record<string, typeof MODEL_CAPABILITIES[keyof typeof MODEL_CAPABILITIES]>;
  return capabilities[model] || {
    name: model,
    tier: 'unknown',
    contextWindow: 200000,
    maxOutput: 8192,
    strengths: [] as string[],
    costTier: 'unknown',
    recommended: [] as string[],
  };
}

