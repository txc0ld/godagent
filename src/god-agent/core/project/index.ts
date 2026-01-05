/**
 * Project Infrastructure Module
 * 
 * Provides intelligent project type detection and infrastructure scaffolding.
 * 
 * @module src/god-agent/core/project
 */

export { ProjectDetector } from './project-detector.js';
export type {
  ProjectType,
  IProjectAnalysis,
  IInfrastructureRequirements,
} from './project-detector.js';

export { ProjectScaffolder } from './project-scaffolder.js';
export type {
  IScaffoldConfig,
  IScaffoldResult,
} from './project-scaffolder.js';

