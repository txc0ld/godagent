/**
 * PipelineConfigLoader - Loads pipeline configuration from agent definition files
 * Implements REQ-PIPE-040 (support all 45+ agents)
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { createComponentLogger, ConsoleLogHandler, LogLevel } from '../core/observability/index.js';

const logger = createComponentLogger('PipelineLoader', {
  minLevel: LogLevel.WARN,
  handlers: [new ConsoleLogHandler({ useStderr: true })]
});

const AGENTS_DIR = '.claude/agents/phdresearch';

/**
 * Agent configuration from definition file
 */
export interface AgentConfig {
  key: string;
  name: string;
  phase: number;
  order: number;
  description: string;
  type?: string;
  dependencies: string[];
  timeout: number;
  critical: boolean;
  expectedOutputs: string[];
  inputs: string[];
  outputs: string[];
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  id: string;
  name: string;
  agents: AgentConfig[];
}

/**
 * Phase definitions
 */
const _PHASE_ORDER: Record<string, number> = {
  'Foundation': 1,
  'Exploration': 2,
  'Context': 3,
  'Analysis': 4,
  'Synthesis': 5,
  'Writing': 6,
  'Validation': 7
};

/**
 * Agent order within phases (static agents only)
 */
const AGENT_ORDER: Record<string, number> = {
  // Phase 1: Foundation
  'step-back-analyzer': 1,
  'self-ask-decomposer': 2,
  'ambiguity-clarifier': 3,
  'research-planner': 4,
  'construct-definer': 5,
  'dissertation-architect': 6,

  // Phase 2: Discovery
  'literature-mapper': 7,
  'systematic-reviewer': 8,
  'source-tier-classifier': 9,
  'citation-extractor': 10,
  'context-tier-manager': 11,

  // Phase 3: Architecture
  'theoretical-framework-analyst': 12,
  'contradiction-analyzer': 13,
  'gap-hunter': 14,
  'risk-analyst': 15,

  // Phase 4: Synthesis
  'evidence-synthesizer': 16,
  'pattern-analyst': 17,
  'thematic-synthesizer': 18,
  'theory-builder': 19,
  'opportunity-identifier': 20,

  // Phase 5: Design
  'method-designer': 21,
  'ethics-reviewer': 22,
  'hypothesis-generator': 23,
  'model-architect': 24,
  'analysis-planner': 25,
  'sampling-strategist': 26,
  'instrument-developer': 27,
  'validity-guardian': 28,
  'methodology-scanner': 29,
  'methodology-writer': 30,

  // Phase 6: Writing (dynamic, handled separately)
  'introduction-writer': 31,
  'literature-review-writer': 32,
  'results-writer': 33,
  'discussion-writer': 34,
  'conclusion-writer': 35,
  'abstract-writer': 36,

  // Phase 7: Validation
  'adversarial-reviewer': 37,
  'confidence-quantifier': 38,
  'citation-validator': 39,
  'reproducibility-checker': 40,
  'apa-citation-specialist': 41,
  'consistency-validator': 42,
  'quality-assessor': 43,
  'bias-detector': 44,
  'file-length-manager': 45
};

/**
 * PipelineConfigLoader class
 */
export class PipelineConfigLoader {
  private configCache: PipelineConfig | null = null;
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  /**
   * Load pipeline configuration from agent definition files
   * Returns config with all 45+ agents
   * [REQ-PIPE-040]
   */
  async loadPipelineConfig(): Promise<PipelineConfig> {
    if (this.configCache) {
      return this.configCache;
    }

    const agentsDir = path.join(this.basePath, AGENTS_DIR);

    let files: string[];
    try {
      files = await fs.readdir(agentsDir);
    } catch {
      // INTENTIONAL: Directory access failure - throw descriptive error for caller handling
      throw new Error(`Agents directory not found: ${agentsDir}`);
    }

    const agentFiles = files.filter(f => f.endsWith('.md'));
    const agents: AgentConfig[] = [];

    for (const file of agentFiles) {
      try {
        const filePath = path.join(agentsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const agent = this.parseAgentDefinition(content, file);
        agents.push(agent);
      } catch (error) {
        logger.warn('Failed to parse agent definition', { file, error: String(error) });
      }
    }

    // Sort agents by phase and order within phase
    agents.sort((a, b) => {
      if (a.phase !== b.phase) return a.phase - b.phase;
      return a.order - b.order;
    });

    this.configCache = {
      id: 'phd-research-pipeline',
      name: 'PhD Research Pipeline',
      agents
    };

    return this.configCache;
  }

  /**
   * Parse agent definition markdown file
   * Extract frontmatter and content
   */
  private parseAgentDefinition(content: string, filename: string): AgentConfig {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      throw new Error(`No frontmatter found in ${filename}`);
    }

    const frontmatter = this.parseYAML(frontmatterMatch[1]);

    // Extract description (content after frontmatter)
    const description = content.substring(frontmatterMatch[0].length).trim();

    // Build agent key from filename
    const key = filename.replace('.md', '');

    // Determine phase from agent type or use default ordering
    const phase = this.determinePhase(key, frontmatter);
    const order = AGENT_ORDER[key] || 99;

    return {
      key,
      name: (frontmatter.name as string | undefined) || key,
      phase,
      order,
      description,
      type: frontmatter.type as string | undefined,
      dependencies: (frontmatter.dependencies as string[] | undefined) || [],
      timeout: (frontmatter.timeout as number | undefined) || 300,
      critical: frontmatter.priority === 'critical' || (frontmatter.critical as boolean | undefined) || false,
      expectedOutputs: (frontmatter.expectedOutputs as string[] | undefined) || [],
      inputs: (frontmatter.inputs as string[] | undefined) || [],
      outputs: (frontmatter.outputs as string[] | undefined) || []
    };
  }

  /**
   * Determine phase from agent key and frontmatter
   */
  private determinePhase(key: string, frontmatter: Record<string, unknown>): number {
    // Check explicit phase in frontmatter
    if (typeof frontmatter.phase === 'number') {
      return frontmatter.phase;
    }

    // Infer from agent key
    if (key.includes('writer')) {
      return 6; // Writing phase
    }
    if (key.includes('reviewer') || key.includes('validator') || key.includes('checker')) {
      return 7; // Validation phase
    }

    // Use order lookup
    const order = AGENT_ORDER[key];
    if (order) {
      if (order <= 6) return 1;
      if (order <= 11) return 2;
      if (order <= 15) return 3;
      if (order <= 20) return 4;
      if (order <= 30) return 5;
      if (order <= 36) return 6;
      return 7;
    }

    return 1; // Default to Foundation phase
  }

  /**
   * Simple YAML parser for frontmatter
   */
  private parseYAML(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;

        // Parse value
        if (value.startsWith('[') && value.endsWith(']')) {
          // Array
          try {
            result[key] = JSON.parse(value.replace(/'/g, '"'));
          } catch {
            // INTENTIONAL: JSON parse failure for array value - use empty array as safe default
            result[key] = [];
          }
        } else if (value === 'true' || value === 'false') {
          // Boolean
          result[key] = value === 'true';
        } else if (!isNaN(Number(value))) {
          // Number
          result[key] = Number(value);
        } else {
          // String
          result[key] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    }

    return result;
  }

  /**
   * Get agent by index
   */
  async getAgentByIndex(index: number): Promise<AgentConfig> {
    const config = await this.loadPipelineConfig();

    if (index < 0 || index >= config.agents.length) {
      throw new Error(`Invalid agent index: ${index}. Valid range: 0-${config.agents.length - 1}`);
    }

    return config.agents[index];
  }

  /**
   * Get agent by key
   */
  async getAgentByKey(key: string): Promise<AgentConfig | undefined> {
    const config = await this.loadPipelineConfig();
    return config.agents.find(a => a.key === key);
  }

  /**
   * Check if agent is in Phase 6 (writing phase)
   */
  isPhase6Agent(agent: AgentConfig): boolean {
    return agent.phase === 6;
  }

  /**
   * Get agents for a specific phase
   */
  async getAgentsForPhase(phase: number): Promise<AgentConfig[]> {
    const config = await this.loadPipelineConfig();
    return config.agents.filter(a => a.phase === phase);
  }

  /**
   * Clear cache to force reload
   */
  clearCache(): void {
    this.configCache = null;
  }
}
