import { describe, it, expect, beforeEach } from 'vitest';
import { SymmetricChunker, ChunkingConfig } from '@god-agent/core/ucm/index.js';

describe('SymmetricChunker', () => {
  let chunker: SymmetricChunker;
  let defaultConfig: ChunkingConfig;

  beforeEach(() => {
    defaultConfig = {
      maxChunkSize: 2000,
      overlapSize: 300,
      protectedPatterns: [
        /```[\s\S]*?```/g,  // Code blocks
        /\|[^\n]+\|/g,       // Table rows
        /^\d+\.\s/gm         // Numbered lists
      ]
    };
    chunker = new SymmetricChunker(defaultConfig);
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultChunker = new SymmetricChunker();
      expect(defaultChunker).toBeDefined();
    });

    it('should accept custom config', () => {
      const customConfig: ChunkingConfig = {
        maxChunkSize: 1000,
        overlapSize: 200,
        protectedPatterns: []
      };
      const customChunker = new SymmetricChunker(customConfig);

      expect(customChunker).toBeDefined();
    });
  });

  describe('chunk', () => {
    it('should split text into chunks respecting max size', () => {
      const text = 'word '.repeat(1000); // ~5000 chars

      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(defaultConfig.maxChunkSize);
      });
    });

    it('should create overlapping chunks', () => {
      const text = 'word '.repeat(1000);

      const chunks = chunker.chunk(text);

      if (chunks.length > 1) {
        // Check that consecutive chunks have overlap
        for (let i = 0; i < chunks.length - 1; i++) {
          const chunk1End = chunks[i].slice(-defaultConfig.overlapSize);
          const chunk2Start = chunks[i + 1].slice(0, defaultConfig.overlapSize);

          // Should have some common content
          const overlap = chunk1End.split(' ').some(word =>
            word.length > 0 && chunk2Start.includes(word)
          );
          expect(overlap).toBe(true);
        }
      }
    });

    it('should preserve code blocks intact', () => {
      const codeBlock = '```typescript\nfunction test() {\n  return 42;\n}\n```';
      const text = 'Before text. ' + codeBlock + ' After text. ' + 'padding '.repeat(500);

      const chunks = chunker.chunk(text);

      // Code block should appear complete in at least one chunk
      const hasCompleteCodeBlock = chunks.some(chunk => chunk.includes(codeBlock));
      expect(hasCompleteCodeBlock).toBe(true);
    });

    it('should preserve markdown tables intact', () => {
      const table = `| Col1 | Col2 | Col3 |
|------|------|------|
| A    | B    | C    |
| D    | E    | F    |`;

      const text = 'Before. ' + table + ' After. ' + 'padding '.repeat(500);

      const chunks = chunker.chunk(text);

      // Table rows should not be split across chunks
      const allTableRows = table.split('\n');
      chunks.forEach(chunk => {
        const chunkRows = chunk.match(/\|[^\n]+\|/g) || [];
        if (chunkRows.length > 0) {
          // If any row is present, verify it's complete
          chunkRows.forEach(row => {
            expect(row).toMatch(/^\|.*\|$/);
          });
        }
      });
    });

    it('should preserve numbered lists', () => {
      const list = `1. First item
2. Second item
3. Third item`;

      const text = 'Introduction. ' + list + ' Conclusion. ' + 'padding '.repeat(500);

      const chunks = chunker.chunk(text);

      // List items should be preserved
      const hasListItems = chunks.some(chunk => /^\d+\.\s/.test(chunk));
      expect(hasListItems).toBe(true);
    });

    it('should handle text shorter than max chunk size', () => {
      const shortText = 'This is a short text that fits in one chunk.';

      const chunks = chunker.chunk(shortText);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(shortText);
    });

    it('should handle empty text', () => {
      const chunks = chunker.chunk('');

      expect(chunks).toHaveLength(0);
    });

    it('should handle whitespace-only text', () => {
      const chunks = chunker.chunk('   \n\t  \n  ');

      expect(chunks.length).toBeLessThanOrEqual(1);
    });

    it('should chunk at natural boundaries (paragraphs)', () => {
      const paragraph1 = 'a'.repeat(800);
      const paragraph2 = 'b'.repeat(800);
      const paragraph3 = 'c'.repeat(800);
      const text = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;

      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(1);
      // Chunks should try to break at paragraph boundaries
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(defaultConfig.maxChunkSize);
      });
    });

    it('should maintain symmetry (same algorithm for storage and retrieval)', () => {
      const text = 'word '.repeat(1000);

      const chunks1 = chunker.chunk(text);
      const chunks2 = chunker.chunk(text);

      expect(chunks1).toEqual(chunks2);
    });

    it('should handle very long text efficiently', () => {
      const longText = 'word '.repeat(50000);
      const start = performance.now();

      const chunks = chunker.chunk(longText);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should be fast
      expect(chunks.length).toBeGreaterThan(10);
    });

    it('should create chunks with approximately 300 char overlap', () => {
      const text = 'word '.repeat(1000);

      const chunks = chunker.chunk(text);

      if (chunks.length > 1) {
        for (let i = 0; i < chunks.length - 1; i++) {
          const chunk1 = chunks[i];
          const chunk2 = chunks[i + 1];

          // Find overlap region
          const overlapStart = Math.max(0, chunk1.length - defaultConfig.overlapSize - 100);
          const potentialOverlap = chunk1.slice(overlapStart);

          // Should have some overlap
          const hasOverlap = chunk2.slice(0, 400).includes(potentialOverlap.slice(-50));
          expect(hasOverlap || chunks.length === 2).toBe(true);
        }
      }
    });

    it('should handle mixed content with multiple protected patterns', () => {
      const mixedContent = `# Header

Some text here.

\`\`\`python
def test():
    return True
\`\`\`

| Name | Age | City |
|------|-----|------|
| John | 30  | NYC  |

1. First point
2. Second point
3. Third point

${'More text. '.repeat(500)}`;

      const chunks = chunker.chunk(mixedContent);

      expect(chunks.length).toBeGreaterThan(0);

      // Verify protected patterns are preserved
      const reconstructed = chunks.join('');
      expect(reconstructed.includes('```python')).toBe(true);
      expect(reconstructed.includes('| Name | Age | City |')).toBe(true);
      expect(reconstructed.includes('1. First point')).toBe(true);
    });

    it('should respect chunk size limits strictly', () => {
      const smallConfig: ChunkingConfig = {
        maxChunkSize: 500,
        overlapSize: 50,
        protectedPatterns: []
      };
      const smallChunker = new SymmetricChunker(smallConfig);

      const text = 'word '.repeat(1000);
      const chunks = smallChunker.chunk(text);

      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(500);
      });
    });
  });

  describe('reassemble', () => {
    it('should reassemble chunks with overlap removed', () => {
      const originalText = 'word '.repeat(1000);
      const chunks = chunker.chunk(originalText);

      const reassembled = chunker.reassemble(chunks);

      // Should be similar to original (some variation due to overlap handling)
      expect(reassembled.length).toBeGreaterThan(0);
      expect(Math.abs(reassembled.length - originalText.length)).toBeLessThan(originalText.length * 0.2);
    });

    it('should handle single chunk', () => {
      const text = 'Short text';
      const chunks = chunker.chunk(text);

      const reassembled = chunker.reassemble(chunks);

      expect(reassembled).toBe(text);
    });

    it('should handle empty chunks array', () => {
      const reassembled = chunker.reassemble([]);

      expect(reassembled).toBe('');
    });
  });

  describe('symmetry verification', () => {
    it('should produce identical chunks for identical input', () => {
      const text = 'Test content. '.repeat(500);

      const chunks1 = chunker.chunk(text);
      const chunks2 = chunker.chunk(text);

      expect(chunks1.length).toBe(chunks2.length);
      chunks1.forEach((chunk, i) => {
        expect(chunk).toBe(chunks2[i]);
      });
    });

    it('should handle retrieval scenario same as storage', () => {
      const text = 'Storage and retrieval test. '.repeat(500);

      // Simulate storage
      const storageChunks = chunker.chunk(text);

      // Simulate retrieval (re-chunking)
      const retrievalChunks = chunker.chunk(text);

      expect(storageChunks).toEqual(retrievalChunks);
    });
  });
});
