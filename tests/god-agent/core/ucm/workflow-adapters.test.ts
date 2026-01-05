import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdapterRegistry,
  PhDPipelineAdapter,
  CodeReviewAdapter,
  GeneralTaskAdapter,
  WorkflowAdapter
} from '@god-agent/core/ucm/index.js';

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('adapter detection', () => {
    it('should detect PhD pipeline workflow', () => {
      const phdContext = {
        task: 'Literature review for machine learning research',
        phase: 'research',
        description: 'Systematic review of neural network papers'
      };

      const adapter = registry.getAdapter(phdContext);

      expect(adapter).toBeInstanceOf(PhDPipelineAdapter);
    });

    it('should detect code review workflow', () => {
      const reviewContext = {
        task: 'Review pull request #123',
        files: ['src/index.ts', 'tests/index.test.ts'],
        description: 'Code review for new feature'
      };

      const adapter = registry.getAdapter(reviewContext);

      expect(adapter).toBeInstanceOf(CodeReviewAdapter);
    });

    it('should fallback to general task adapter', () => {
      const genericContext = {
        task: 'Some generic task',
        description: 'Unspecified workflow'
      };

      const adapter = registry.getAdapter(genericContext);

      expect(adapter).toBeInstanceOf(GeneralTaskAdapter);
    });

    it('should detect PhD keywords in description', () => {
      const contexts = [
        { task: 'Test', description: 'dissertation chapter draft' },
        { task: 'Test', description: 'thesis methodology' },
        { task: 'Test', description: 'academic literature synthesis' }
      ];

      contexts.forEach(ctx => {
        const adapter = registry.getAdapter(ctx);
        expect(adapter).toBeInstanceOf(PhDPipelineAdapter);
      });
    });

    it('should detect code review keywords', () => {
      const contexts = [
        { task: 'pr review for feature-x' },
        { task: 'analyze code quality' },
        { task: 'diff review required' }
      ];

      contexts.forEach(ctx => {
        const adapter = registry.getAdapter(ctx);
        expect(adapter).toBeInstanceOf(CodeReviewAdapter);
      });
    });

    it('should prioritize PhD over code review when both match', () => {
      const ambiguousContext = {
        task: 'review literature on code quality',
        phase: 'research'
      };

      const adapter = registry.getAdapter(ambiguousContext);

      expect(adapter).toBeInstanceOf(PhDPipelineAdapter);
    });
  });

  describe('custom adapter registration', () => {
    it('should allow registering custom adapters', () => {
      class CustomAdapter implements WorkflowAdapter {
        detect(context: any): boolean {
          return context.task === 'custom';
        }
        getConfig() {
          return { windowSize: 5, priorities: [] };
        }
      }

      registry.register('custom', CustomAdapter);

      const adapter = registry.getAdapter({ task: 'custom' });
      expect(adapter).toBeInstanceOf(CustomAdapter);
    });

    it('should override default adapters', () => {
      class NewPhDAdapter implements WorkflowAdapter {
        detect() { return true; }
        getConfig() {
          return { windowSize: 10, priorities: [] };
        }
      }

      registry.register('phd', NewPhDAdapter);

      const adapter = registry.getAdapter({ phase: 'research' });
      expect(adapter).toBeInstanceOf(NewPhDAdapter);
    });
  });
});

describe('PhDPipelineAdapter', () => {
  let adapter: PhDPipelineAdapter;

  beforeEach(() => {
    adapter = new PhDPipelineAdapter();
  });

  describe('detection', () => {
    it('should detect PhD phase keywords', () => {
      const phases = [
        'planning', 'research', 'analysis', 'writing',
        'revision', 'submission'
      ];

      phases.forEach(phase => {
        expect(adapter.detect({ phase })).toBe(true);
      });
    });

    it('should detect dissertation keywords', () => {
      const keywords = [
        'dissertation', 'thesis', 'literature review',
        'methodology', 'findings', 'academic'
      ];

      keywords.forEach(keyword => {
        expect(adapter.detect({ task: keyword })).toBe(true);
        expect(adapter.detect({ description: keyword })).toBe(true);
      });
    });

    it('should not detect non-PhD contexts', () => {
      const contexts = [
        { task: 'Build web app' },
        { task: 'Fix bug in production' },
        { task: 'Deploy to server' }
      ];

      contexts.forEach(ctx => {
        expect(adapter.detect(ctx)).toBe(false);
      });
    });
  });

  describe('configuration', () => {
    it('should return phase-specific window sizes', () => {
      const phases = {
        planning: 2,
        research: 3,
        analysis: 3,
        writing: 4,
        revision: 3,
        submission: 2
      };

      Object.entries(phases).forEach(([phase, expectedSize]) => {
        const config = adapter.getConfig({ phase });
        expect(config.windowSize).toBe(expectedSize);
      });
    });

    it('should default to size 3 for unknown phases', () => {
      const config = adapter.getConfig({ phase: 'unknown' });

      expect(config.windowSize).toBe(3);
    });

    it('should return default when no phase specified', () => {
      const config = adapter.getConfig({});

      expect(config.windowSize).toBeGreaterThan(0);
    });

    it('should include priority settings', () => {
      const config = adapter.getConfig({ phase: 'research' });

      expect(config).toHaveProperty('priorities');
      expect(Array.isArray(config.priorities)).toBe(true);
    });

    it('should have larger window for writing phase', () => {
      const writingConfig = adapter.getConfig({ phase: 'writing' });
      const planningConfig = adapter.getConfig({ phase: 'planning' });

      expect(writingConfig.windowSize).toBeGreaterThan(planningConfig.windowSize);
    });
  });

  describe('phase-specific behavior', () => {
    it('should recognize all standard PhD phases', () => {
      const standardPhases = [
        'planning', 'research', 'analysis',
        'writing', 'revision', 'submission'
      ];

      standardPhases.forEach(phase => {
        const config = adapter.getConfig({ phase });
        expect(config.windowSize).toBeGreaterThan(0);
      });
    });

    it('should handle case-insensitive phase names', () => {
      const config1 = adapter.getConfig({ phase: 'RESEARCH' });
      const config2 = adapter.getConfig({ phase: 'research' });
      const config3 = adapter.getConfig({ phase: 'Research' });

      expect(config1.windowSize).toBe(config2.windowSize);
      expect(config2.windowSize).toBe(config3.windowSize);
    });
  });
});

describe('CodeReviewAdapter', () => {
  let adapter: CodeReviewAdapter;

  beforeEach(() => {
    adapter = new CodeReviewAdapter();
  });

  describe('detection', () => {
    it('should detect code review keywords', () => {
      const keywords = [
        'review', 'pull request', 'pr', 'diff',
        'code quality', 'merge'
      ];

      keywords.forEach(keyword => {
        expect(adapter.detect({ task: keyword })).toBe(true);
      });
    });

    it('should detect when files array is present', () => {
      const context = {
        files: ['src/index.ts', 'tests/index.test.ts']
      };

      expect(adapter.detect(context)).toBe(true);
    });

    it('should detect PR numbers in task', () => {
      const contexts = [
        { task: 'Review PR #123' },
        { task: 'Check pull request 456' },
        { task: 'Merge PR#789' }
      ];

      contexts.forEach(ctx => {
        expect(adapter.detect(ctx)).toBe(true);
      });
    });

    it('should not detect non-review contexts', () => {
      const contexts = [
        { task: 'Write new feature' },
        { task: 'Research literature' },
        { task: 'Deploy application' }
      ];

      contexts.forEach(ctx => {
        expect(adapter.detect(ctx)).toBe(false);
      });
    });
  });

  describe('configuration', () => {
    it('should return appropriate window size', () => {
      const config = adapter.getConfig({});

      expect(config.windowSize).toBeGreaterThan(0);
      expect(config.windowSize).toBeLessThanOrEqual(5);
    });

    it('should scale window based on number of files', () => {
      const smallReview = adapter.getConfig({ files: ['file1.ts'] });
      const largeReview = adapter.getConfig({
        files: Array(20).fill('').map((_, i) => `file${i}.ts`)
      });

      expect(largeReview.windowSize).toBeGreaterThanOrEqual(smallReview.windowSize);
    });

    it('should include code review priorities', () => {
      const config = adapter.getConfig({});

      expect(config).toHaveProperty('priorities');
      expect(Array.isArray(config.priorities)).toBe(true);
    });

    it('should handle missing files array', () => {
      const config = adapter.getConfig({ task: 'Review code' });

      expect(config.windowSize).toBeGreaterThan(0);
    });
  });
});

describe('GeneralTaskAdapter', () => {
  let adapter: GeneralTaskAdapter;

  beforeEach(() => {
    adapter = new GeneralTaskAdapter();
  });

  describe('detection', () => {
    it('should always return true (fallback adapter)', () => {
      const contexts = [
        { task: 'anything' },
        { task: 'random task' },
        {},
        { description: 'some work' }
      ];

      contexts.forEach(ctx => {
        expect(adapter.detect(ctx)).toBe(true);
      });
    });
  });

  describe('configuration', () => {
    it('should return default window size', () => {
      const config = adapter.getConfig({});

      expect(config.windowSize).toBeGreaterThan(0);
      expect(config.windowSize).toBe(3); // Standard default
    });

    it('should have consistent config for all contexts', () => {
      const config1 = adapter.getConfig({ task: 'task1' });
      const config2 = adapter.getConfig({ task: 'task2' });

      expect(config1.windowSize).toBe(config2.windowSize);
    });

    it('should include basic priorities', () => {
      const config = adapter.getConfig({});

      expect(config).toHaveProperty('priorities');
    });
  });
});

describe('adapter integration', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('should select correct adapter for real-world PhD scenario', () => {
    const context = {
      task: 'Conduct systematic literature review',
      phase: 'research',
      description: 'Review papers on reinforcement learning for dissertation chapter 2'
    };

    const adapter = registry.getAdapter(context);
    expect(adapter).toBeInstanceOf(PhDPipelineAdapter);

    const config = adapter.getConfig(context);
    expect(config.windowSize).toBe(3); // Research phase
  });

  it('should select correct adapter for real-world code review', () => {
    const context = {
      task: 'Review PR #456: Add authentication feature',
      files: [
        'src/auth/login.ts',
        'src/auth/register.ts',
        'tests/auth.test.ts'
      ]
    };

    const adapter = registry.getAdapter(context);
    expect(adapter).toBeInstanceOf(CodeReviewAdapter);

    const config = adapter.getConfig(context);
    expect(config.windowSize).toBeGreaterThan(0);
  });

  it('should handle workflow transitions', () => {
    // Start with planning
    let adapter = registry.getAdapter({ phase: 'planning' });
    let config = adapter.getConfig({ phase: 'planning' });
    expect(config.windowSize).toBe(2);

    // Move to research
    adapter = registry.getAdapter({ phase: 'research' });
    config = adapter.getConfig({ phase: 'research' });
    expect(config.windowSize).toBe(3);

    // Move to writing
    adapter = registry.getAdapter({ phase: 'writing' });
    config = adapter.getConfig({ phase: 'writing' });
    expect(config.windowSize).toBe(4);
  });
});
