export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agent?: string;
  routing?: RoutingInfo;
  trajectoryId?: string;
  qualityScore?: number;
  isError?: boolean;
}

export interface RoutingInfo {
  confidence: number;
  agentCategory?: string;
  factors?: RoutingFactor[];
  alternatives?: AlternativeAgent[];
  pipeline?: PipelineStep[];
}

export interface RoutingFactor {
  name: string;
  weight: number;
  contribution: number;
  description?: string;
}

export interface AlternativeAgent {
  id: string;
  name: string;
  confidence: number;
}

export interface PipelineStep {
  step: number;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  category: string;
  description?: string;
  confidence: number;
  factors?: RoutingFactor[];
  capabilities?: string[];
}

export interface SystemStatus {
  initialized: boolean;
  runtime: string;
  health: {
    vectorDB: 'healthy' | 'degraded' | 'unavailable';
    graphDB: 'healthy' | 'degraded' | 'unavailable';
    memory: 'healthy' | 'degraded' | 'unavailable';
    reasoning: 'healthy' | 'degraded' | 'unavailable';
    learning: 'healthy' | 'degraded' | 'unavailable';
  };
  stats?: {
    totalInteractions: number;
    knowledgeEntries: number;
    agentCount: number;
    categoryCount: number;
  };
}

export interface ApiResponse<T = unknown> {
  command: string;
  selectedAgent: string;
  prompt: string;
  isPipeline: boolean;
  result: T;
  success: boolean;
  error?: string;
  trajectoryId?: string;
  qualityScore?: number;
  routing?: RoutingInfo;
}

export type TaskMode = 'ask' | 'code' | 'research' | 'write';

// ==================== Project Types ====================

export type ProjectType = 'coding' | 'research' | 'writing' | 'general';

export interface ProjectAnalysis {
  type: ProjectType;
  confidence: number;
  domain: string;
  complexity: 'simple' | 'moderate' | 'complex';
  needsScaffolding: boolean;
  suggestedName: string;
  infrastructure: InfrastructureRequirements;
  detectedFeatures: string[];
  analyzedAt: number;
}

export interface InfrastructureRequirements {
  needsPRD: boolean;
  needsSpec: boolean;
  needsTech: boolean;
  needsTasks: boolean;
  needsConstitution: boolean;
  needsAITracking: boolean;
  needsClaudeFlow: boolean;
  needsResearchPipeline: boolean;
  estimatedAgents: number;
  topology: 'centralized' | 'hierarchical' | 'mesh';
}

export interface ProjectInitResult {
  success: boolean;
  projectId: string;
  directories: string[];
  files: string[];
  errors: string[];
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

export interface ProjectAnalyzeResponse {
  command: string;
  success: boolean;
  projectType?: string;
  analysis?: ProjectAnalysis;
  error?: string;
}

export interface ProjectInitResponse {
  command: string;
  success: boolean;
  projectId?: string;
  projectType?: string;
  analysis?: ProjectAnalysis;
  scaffoldResult?: ProjectInitResult;
  error?: string;
}

// ==================== Setup Types ====================

export interface SetupConfig {
  anthropicApiKey: string;
  embeddingApiUrl: string;
  preferredModel?: string;
}

// Available Claude models
export const CLAUDE_MODELS = {
  // Latest Models (Claude 4.5 Series)
  'claude-sonnet-4-5': 'Claude Sonnet 4.5 (Recommended)',
  'claude-opus-4-5': 'Claude Opus 4.5 (Most Capable)',
  'claude-haiku-4-5': 'Claude Haiku 4.5 (Fastest)',
  // Claude 4 Series
  'claude-sonnet-4-0': 'Claude Sonnet 4.0',
  'claude-opus-4-0': 'Claude Opus 4.0',
} as const;

export interface SetupValidationResult {
  anthropic: { valid: boolean; error?: string };
  embedding: { valid: boolean; error?: string };
  services: { valid: boolean; error?: string };
}

export interface SetupCheckResult {
  configured: boolean;
  hasAnthropicKey: boolean;
  servicesRunning: boolean;
}

