/**
 * Intelligent Project Type Detector
 * 
 * Analyzes user input to determine:
 * - Project type (coding, research, writing, general)
 * - Required infrastructure (specs, docs, pipelines)
 * - Complexity level
 * - Recommended scaffolding
 * 
 * @module src/god-agent/core/project/project-detector
 */

import type { TaskDomain, TaskComplexity } from '../routing/routing-types.js';

// ==================== Project Types ====================

export type ProjectType = 
  | 'coding'      // Needs PRD, SPEC, TECH, TASKS, CONSTITUTION
  | 'research'    // Needs research pipeline, literature review structure
  | 'writing'     // Needs outline, draft structure
  | 'general';    // No scaffolding needed (simple Q&A)

export interface IProjectAnalysis {
  /** Detected project type */
  type: ProjectType;
  
  /** Confidence score 0-1 */
  confidence: number;
  
  /** Primary domain from task analysis */
  domain: TaskDomain;
  
  /** Complexity assessment */
  complexity: TaskComplexity;
  
  /** Whether this needs full project scaffolding */
  needsScaffolding: boolean;
  
  /** Suggested project name (kebab-case) */
  suggestedName: string;
  
  /** Recommended infrastructure components */
  infrastructure: IInfrastructureRequirements;
  
  /** Detected features/capabilities needed */
  detectedFeatures: string[];
  
  /** Analysis timestamp */
  analyzedAt: number;
}

export interface IInfrastructureRequirements {
  /** Need PRD document */
  needsPRD: boolean;
  
  /** Need functional spec */
  needsSpec: boolean;
  
  /** Need technical spec */
  needsTech: boolean;
  
  /** Need task breakdown */
  needsTasks: boolean;
  
  /** Need constitution/rules */
  needsConstitution: boolean;
  
  /** Need .ai/ tracking directory */
  needsAITracking: boolean;
  
  /** Need Claude Flow coordination */
  needsClaudeFlow: boolean;
  
  /** Need research pipeline */
  needsResearchPipeline: boolean;
  
  /** Number of estimated agents needed */
  estimatedAgents: number;
  
  /** Suggested topology */
  topology: 'centralized' | 'hierarchical' | 'mesh';
}

// ==================== Detection Patterns ====================

/**
 * Patterns indicating a coding project
 */
const CODING_PROJECT_PATTERNS = [
  // Implementation patterns - more flexible matching
  /\b(implement|build|create|develop|make|design)\b.*(app|api|system|service|platform|application|website|portal|dashboard)/i,
  /\b(implement|build|create|develop)\s+(a|an|the)?\s*\w+/i,
  
  // Technical patterns
  /full[\s-]?stack/i,
  /front[\s-]?end/i,
  /back[\s-]?end/i,
  /microservices?/i,
  /api\s+(for|that|which)/i,
  /database\s+(schema|design|model)/i,
  
  // Project scale indicators
  /end[\s-]?to[\s-]?end/i,
  /complete\s+(system|solution|implementation)/i,
  /production[\s-]?ready/i,
  /scalable/i,
  /enterprise/i,
  
  // Feature indicators
  /with\s+(authentication|auth|login)/i,
  /including\s+(tests?|testing)/i,
  /with\s+(ci|cd|deployment)/i,
  /with\s+(docker|kubernetes|k8s)/i,
];

/**
 * Patterns indicating a research project
 */
const RESEARCH_PROJECT_PATTERNS = [
  // Research patterns - more flexible
  /\bresearch\b/i,
  /\banalyze\b.*\b(options|alternatives|approaches|methods|solutions)/i,
  /literature\s+review/i,
  /systematic\s+review/i,
  /comparative\s+(analysis|study)/i,
  /investigate\s+(the|how|why|what)/i,
  
  // Academic patterns
  /thesis/i,
  /dissertation/i,
  /academic\s+paper/i,
  /research\s+paper/i,
  /survey\s+(of|on)/i,
  /state\s+of\s+(the\s+)?art/i,
  
  // Analysis patterns
  /in[\s-]?depth\s+analysis/i,
  /comprehensive\s+(review|analysis|study)/i,
  /exploratory\s+(research|study)/i,
  /best\s+practices/i,
];

/**
 * Patterns indicating a writing project
 */
const WRITING_PROJECT_PATTERNS = [
  // Document creation
  /write\s+(a|an|the)?\s*(document|article|blog|post)/i,
  /create\s+(a|an|the)?\s*(document|guide|tutorial)/i,
  /draft\s+(a|an|the)?\s*\w+/i,
  
  // Content types
  /documentation\s+(for|about)/i,
  /readme/i,
  /technical\s+writing/i,
  /user\s+guide/i,
  /api\s+documentation/i,
  
  // Narrative patterns
  /essay\s+(on|about)/i,
  /report\s+(on|about)/i,
  /whitepaper/i,
];

/**
 * Complexity indicators
 */
const COMPLEXITY_INDICATORS = {
  simple: [
    /simple/i,
    /basic/i,
    /quick/i,
    /small/i,
    /minimal/i,
  ],
  moderate: [
    /moderate/i,
    /standard/i,
    /typical/i,
    /normal/i,
  ],
  complex: [
    /complex/i,
    /advanced/i,
    /comprehensive/i,
    /complete/i,
    /full/i,
    /enterprise/i,
    /production/i,
    /scalable/i,
    /distributed/i,
  ],
};

// ==================== Project Detector ====================

export class ProjectDetector {
  /**
   * Analyze input to detect project type and requirements
   */
  analyze(input: string): IProjectAnalysis {
    const normalizedInput = input.trim().toLowerCase();
    
    // Calculate scores for each project type
    const codingScore = this.calculateCodingScore(normalizedInput);
    const researchScore = this.calculateResearchScore(normalizedInput);
    const writingScore = this.calculateWritingScore(normalizedInput);
    
    // Determine type based on highest score
    const scores = {
      coding: codingScore,
      research: researchScore,
      writing: writingScore,
    };
    
    let type: ProjectType = 'general';
    let maxScore = 0;
    
    for (const [projectType, score] of Object.entries(scores)) {
      if (score > maxScore && score >= 0.3) { // Minimum threshold
        maxScore = score;
        type = projectType as ProjectType;
      }
    }
    
    // Assess complexity
    const complexity = this.assessComplexity(normalizedInput);
    
    // Determine domain
    const domain = this.detectDomain(normalizedInput);
    
    // Check if scaffolding is needed
    const needsScaffolding = type !== 'general' && (
      complexity === 'complex' || 
      complexity === 'moderate' ||
      maxScore >= 0.5
    );
    
    // Generate suggested name
    const suggestedName = this.generateProjectName(normalizedInput);
    
    // Detect features
    const detectedFeatures = this.detectFeatures(normalizedInput);
    
    // Determine infrastructure requirements
    const infrastructure = this.determineInfrastructure(
      type,
      complexity,
      detectedFeatures
    );
    
    return {
      type,
      confidence: maxScore,
      domain,
      complexity,
      needsScaffolding,
      suggestedName,
      infrastructure,
      detectedFeatures,
      analyzedAt: Date.now(),
    };
  }
  
  /**
   * Calculate coding project score
   */
  private calculateCodingScore(input: string): number {
    let score = 0;
    let matches = 0;
    
    for (const pattern of CODING_PROJECT_PATTERNS) {
      if (pattern.test(input)) {
        score += 0.2;
        matches++;
      }
    }
    
    // Boost for multiple indicators
    if (matches >= 2) score += 0.15;
    if (matches >= 3) score += 0.15;
    if (matches >= 5) score += 0.15;
    
    // Boost based on detected features (authentication, database, api, etc.)
    const featurePatterns = [
      /auth(entication)?/i,
      /database/i,
      /\bapi\b/i,
      /payment/i,
      /user\s*(management|registration)/i,
      /shopping\s*cart/i,
      /crud/i,
      /backend/i,
      /frontend/i,
    ];
    
    for (const pattern of featurePatterns) {
      if (pattern.test(input)) {
        score += 0.1;
      }
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Calculate research project score
   */
  private calculateResearchScore(input: string): number {
    let score = 0;
    let matches = 0;
    
    for (const pattern of RESEARCH_PROJECT_PATTERNS) {
      if (pattern.test(input)) {
        score += 0.25;
        matches++;
      }
    }
    
    if (matches >= 2) score += 0.15;
    
    // Additional research indicators
    const researchKeywords = [
      /best\s+practices/i,
      /how\s+to/i,
      /comparison/i,
      /state\s+of\s+the\s+art/i,
      /review\s+(of|on)/i,
      /analysis\s+(of|on)/i,
      /\bml\b|machine\s+learning/i,
      /\bai\b|artificial\s+intelligence/i,
    ];
    
    for (const pattern of researchKeywords) {
      if (pattern.test(input)) {
        score += 0.1;
      }
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Calculate writing project score
   */
  private calculateWritingScore(input: string): number {
    let score = 0;
    let matches = 0;
    
    for (const pattern of WRITING_PROJECT_PATTERNS) {
      if (pattern.test(input)) {
        score += 0.2;
        matches++;
      }
    }
    
    if (matches >= 2) score += 0.1;
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Assess complexity from input
   */
  private assessComplexity(input: string): TaskComplexity {
    // Check for explicit complexity indicators
    for (const pattern of COMPLEXITY_INDICATORS.complex) {
      if (pattern.test(input)) return 'complex';
    }
    
    for (const pattern of COMPLEXITY_INDICATORS.simple) {
      if (pattern.test(input)) return 'simple';
    }
    
    // Heuristics based on input length and word count
    const wordCount = input.split(/\s+/).length;
    
    if (wordCount > 50) return 'complex';
    if (wordCount > 20) return 'moderate';
    
    return 'simple';
  }
  
  /**
   * Detect primary domain
   */
  private detectDomain(input: string): TaskDomain {
    const domainKeywords: Record<TaskDomain, string[]> = {
      code: ['implement', 'build', 'create', 'develop', 'code', 'function', 'class', 'api'],
      research: ['research', 'analyze', 'investigate', 'study', 'compare', 'survey'],
      testing: ['test', 'verify', 'validate', 'check', 'assert'],
      writing: ['write', 'document', 'draft', 'article', 'guide'],
      design: ['design', 'architect', 'plan', 'structure', 'model'],
      review: ['review', 'audit', 'inspect', 'evaluate'],
    };
    
    let maxMatches = 0;
    let detectedDomain: TaskDomain = 'code';
    
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      const matches = keywords.filter(kw => input.includes(kw)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedDomain = domain as TaskDomain;
      }
    }
    
    return detectedDomain;
  }
  
  /**
   * Generate kebab-case project name from input
   */
  private generateProjectName(input: string): string {
    // Extract key nouns/concepts
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'that', 'which', 'who', 'whom', 'this', 'these', 'those', 'it',
      'implement', 'create', 'build', 'develop', 'make', 'write',
    ]);
    
    const words = input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .slice(0, 4);
    
    if (words.length === 0) {
      return `project-${Date.now().toString(36)}`;
    }
    
    return words.join('-');
  }
  
  /**
   * Detect features needed
   */
  private detectFeatures(input: string): string[] {
    const features: string[] = [];
    
    const featurePatterns: Record<string, RegExp[]> = {
      'authentication': [/auth/i, /login/i, /user\s+management/i],
      'database': [/database/i, /sql/i, /mongo/i, /postgres/i, /mysql/i],
      'api': [/api/i, /rest/i, /graphql/i, /endpoint/i],
      'frontend': [/ui/i, /frontend/i, /react/i, /vue/i, /angular/i],
      'testing': [/test/i, /jest/i, /vitest/i, /coverage/i],
      'deployment': [/deploy/i, /ci/i, /cd/i, /docker/i, /kubernetes/i],
      'real-time': [/real[\s-]?time/i, /websocket/i, /sse/i, /streaming/i],
      'caching': [/cache/i, /redis/i, /memcached/i],
      'queue': [/queue/i, /rabbitmq/i, /kafka/i, /pub[\s-]?sub/i],
      'search': [/search/i, /elasticsearch/i, /algolia/i],
    };
    
    for (const [feature, patterns] of Object.entries(featurePatterns)) {
      if (patterns.some(p => p.test(input))) {
        features.push(feature);
      }
    }
    
    return features;
  }
  
  /**
   * Determine infrastructure requirements
   */
  private determineInfrastructure(
    type: ProjectType,
    complexity: TaskComplexity,
    features: string[]
  ): IInfrastructureRequirements {
    const base: IInfrastructureRequirements = {
      needsPRD: false,
      needsSpec: false,
      needsTech: false,
      needsTasks: false,
      needsConstitution: false,
      needsAITracking: false,
      needsClaudeFlow: false,
      needsResearchPipeline: false,
      estimatedAgents: 1,
      topology: 'centralized',
    };
    
    switch (type) {
      case 'coding':
        base.needsPRD = true;
        base.needsSpec = true;
        base.needsTech = true;
        base.needsTasks = true;
        base.needsConstitution = true;
        base.needsAITracking = true;
        base.needsClaudeFlow = true;
        
        // Estimate agents based on complexity and features
        if (complexity === 'complex') {
          base.estimatedAgents = 7 + features.length;
          base.topology = 'mesh';
        } else if (complexity === 'moderate') {
          base.estimatedAgents = 4 + Math.floor(features.length / 2);
          base.topology = 'hierarchical';
        } else {
          base.estimatedAgents = 2 + Math.min(features.length, 2);
          base.topology = 'centralized';
        }
        break;
        
      case 'research':
        base.needsPRD = true;
        base.needsAITracking = true;
        base.needsClaudeFlow = true;
        base.needsResearchPipeline = true;
        base.estimatedAgents = complexity === 'complex' ? 45 : 15;
        base.topology = complexity === 'complex' ? 'hierarchical' : 'centralized';
        break;
        
      case 'writing':
        base.needsAITracking = true;
        base.needsClaudeFlow = complexity !== 'simple';
        base.estimatedAgents = complexity === 'complex' ? 5 : 2;
        base.topology = 'centralized';
        break;
        
      case 'general':
        // No infrastructure needed
        break;
    }
    
    return base;
  }
}

