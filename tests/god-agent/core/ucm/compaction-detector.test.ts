import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompactionDetector, CompactionMarkers } from '@god-agent/core/ucm/index.js';

describe('CompactionDetector', () => {
  let detector: CompactionDetector;

  beforeEach(() => {
    detector = new CompactionDetector();
  });

  describe('detection markers', () => {
    it('should detect "compact:" marker', () => {
      const response = 'compact: summarizing previous context...';

      const isCompacted = detector.detect(response);

      expect(isCompacted).toBe(true);
    });

    it('should detect "summarizing:" marker', () => {
      const response = 'summarizing: condensing the conversation history';

      const isCompacted = detector.detect(response);

      expect(isCompacted).toBe(true);
    });

    it('should detect "compressed:" marker', () => {
      const response = 'compressed: reducing context for efficiency';

      const isCompacted = detector.detect(response);

      expect(isCompacted).toBe(true);
    });

    it('should detect case-insensitive markers', () => {
      const responses = [
        'COMPACT: test',
        'Summarizing: test',
        'CoMpReSsEd: test'
      ];

      responses.forEach(response => {
        expect(detector.detect(response)).toBe(true);
      });
    });

    it('should detect markers with whitespace variations', () => {
      const responses = [
        'compact:test',
        'compact: test',
        'compact:  test',
        'compact:\ttest'
      ];

      responses.forEach(response => {
        expect(detector.detect(response)).toBe(true);
      });
    });

    it('should not detect non-compaction text', () => {
      const normalResponses = [
        'This is a normal response',
        'Here is the analysis you requested',
        'The function returns a value'
      ];

      normalResponses.forEach(response => {
        expect(detector.detect(response)).toBe(false);
      });
    });

    it('should detect markers in middle of text', () => {
      const response = 'Analysis shows compact: reduced context here';

      const isCompacted = detector.detect(response);

      expect(isCompacted).toBe(true);
    });

    it('should handle empty string', () => {
      const isCompacted = detector.detect('');

      expect(isCompacted).toBe(false);
    });

    it('should handle multiline text with markers', () => {
      const response = `Line 1
Line 2
compact: compaction detected
Line 4`;

      const isCompacted = detector.detect(response);

      expect(isCompacted).toBe(true);
    });
  });

  describe('state tracking', () => {
    it('should track compaction occurrences', () => {
      const response1 = 'compact: first compaction';
      const response2 = 'summarizing: second compaction';

      detector.detect(response1);
      detector.detect(response2);

      const state = detector.getState();
      expect(state.compactionCount).toBe(2);
    });

    it('should track last compaction timestamp', () => {
      const before = Date.now();
      detector.detect('compact: test');
      const after = Date.now();

      const state = detector.getState();
      expect(state.lastCompactionAt).toBeGreaterThanOrEqual(before);
      expect(state.lastCompactionAt).toBeLessThanOrEqual(after);
    });

    it('should initialize state correctly', () => {
      const state = detector.getState();

      expect(state.compactionCount).toBe(0);
      expect(state.lastCompactionAt).toBeNull();
      expect(state.inRecoveryMode).toBe(false);
    });

    it('should not increment count for non-compaction responses', () => {
      detector.detect('normal response');
      detector.detect('another normal response');

      const state = detector.getState();
      expect(state.compactionCount).toBe(0);
    });

    it('should track multiple compactions correctly', () => {
      for (let i = 0; i < 5; i++) {
        detector.detect('compact: iteration ' + i);
      }

      const state = detector.getState();
      expect(state.compactionCount).toBe(5);
    });
  });

  describe('recovery mode', () => {
    it('should enter recovery mode after detection', () => {
      detector.detect('compact: entering recovery');

      const state = detector.getState();
      expect(state.inRecoveryMode).toBe(true);
    });

    it('should exit recovery mode on demand', () => {
      detector.detect('compact: test');
      detector.exitRecoveryMode();

      const state = detector.getState();
      expect(state.inRecoveryMode).toBe(false);
    });

    it('should remain in recovery mode after multiple detections', () => {
      detector.detect('compact: first');
      detector.detect('summarizing: second');

      const state = detector.getState();
      expect(state.inRecoveryMode).toBe(true);
    });

    it('should not enter recovery mode without detection', () => {
      detector.detect('normal response');

      const state = detector.getState();
      expect(state.inRecoveryMode).toBe(false);
    });

    it('should allow re-entering recovery mode', () => {
      detector.detect('compact: first');
      detector.exitRecoveryMode();
      detector.detect('compact: second');

      const state = detector.getState();
      expect(state.inRecoveryMode).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      detector.detect('compact: test');
      detector.detect('summarizing: test2');

      detector.reset();

      const state = detector.getState();
      expect(state.compactionCount).toBe(0);
      expect(state.lastCompactionAt).toBeNull();
      expect(state.inRecoveryMode).toBe(false);
    });

    it('should allow reuse after reset', () => {
      detector.detect('compact: before reset');
      detector.reset();
      detector.detect('compact: after reset');

      const state = detector.getState();
      expect(state.compactionCount).toBe(1);
    });
  });

  describe('marker patterns', () => {
    it('should export CompactionMarkers constant', () => {
      expect(CompactionMarkers).toBeDefined();
      expect(Array.isArray(CompactionMarkers)).toBe(true);
      expect(CompactionMarkers.length).toBeGreaterThan(0);
    });

    it('should include standard markers', () => {
      const markerStrings = CompactionMarkers.map(m => m.source.toLowerCase());

      expect(markerStrings.some(m => m.includes('compact'))).toBe(true);
      expect(markerStrings.some(m => m.includes('summariz'))).toBe(true);
      expect(markerStrings.some(m => m.includes('compress'))).toBe(true);
    });
  });

  describe('performance', () => {
    it('should detect quickly for short text', () => {
      const text = 'compact: test';
      const start = performance.now();

      detector.detect(text);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1);
    });

    it('should detect quickly for long text', () => {
      const longText = 'word '.repeat(10000) + ' compact: marker ';
      const start = performance.now();

      detector.detect(longText);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(10);
    });
  });

  describe('edge cases', () => {
    it('should handle null-like values safely', () => {
      expect(() => detector.detect(null as any)).not.toThrow();
      expect(() => detector.detect(undefined as any)).not.toThrow();
    });

    it('should handle special characters', () => {
      const text = 'compact: special chars !@#$%^&*()';

      const isCompacted = detector.detect(text);

      expect(isCompacted).toBe(true);
    });

    it('should handle unicode text', () => {
      const text = 'compact: 世界 مرحبا дума';

      const isCompacted = detector.detect(text);

      expect(isCompacted).toBe(true);
    });

    it('should detect first marker when multiple present', () => {
      const text = 'compact: first summarizing: second compressed: third';

      const isCompacted = detector.detect(text);

      expect(isCompacted).toBe(true);

      const state = detector.getState();
      expect(state.compactionCount).toBe(1);
    });

    it('should handle very short text', () => {
      expect(detector.detect('c')).toBe(false);
      expect(detector.detect('co')).toBe(false);
      expect(detector.detect('compact:')).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should track conversation with mixed responses', () => {
      const responses = [
        'Normal analysis here',
        'compact: first compaction detected',
        'More normal content',
        'summarizing: second compaction',
        'Final response'
      ];

      responses.forEach(r => detector.detect(r));

      const state = detector.getState();
      expect(state.compactionCount).toBe(2);
      expect(state.inRecoveryMode).toBe(true);
    });

    it('should support recovery workflow', () => {
      // Detect compaction
      detector.detect('compact: context loss detected');
      expect(detector.getState().inRecoveryMode).toBe(true);

      // Perform recovery actions...

      // Exit recovery
      detector.exitRecoveryMode();
      expect(detector.getState().inRecoveryMode).toBe(false);

      // Continue normal operation
      detector.detect('normal response');
      expect(detector.getState().compactionCount).toBe(1);
    });
  });
});
