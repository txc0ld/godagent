import { describe, it, expect, beforeEach } from 'vitest';
import {
  WordCounter,
  ContentClassifier,
  TokenEstimationService,
  TOKEN_RATIOS
} from '@god-agent/core/ucm/index.js';

describe('WordCounter', () => {
  let counter: WordCounter;

  beforeEach(() => {
    counter = new WordCounter();
  });

  describe('count', () => {
    it('should count words accurately in prose', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const result = counter.count(text);

      expect(result.wordCount).toBe(9);
      expect(result.charCount).toBe(text.length);
    });

    it('should count words in code correctly', () => {
      const code = `function test() {\n  return 42;\n}`;
      const result = counter.count(code);

      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.charCount).toBe(code.length);
    });

    it('should handle empty text', () => {
      const result = counter.count('');

      expect(result.wordCount).toBe(0);
      expect(result.charCount).toBe(0);
    });

    it('should handle whitespace-only text', () => {
      const result = counter.count('   \n\t  \n  ');

      expect(result.wordCount).toBe(0);
    });

    it('should count hyphenated words correctly', () => {
      const text = 'state-of-the-art machine-learning algorithms';
      const result = counter.count(text);

      expect(result.wordCount).toBe(3);
    });

    it('should count contractions as one word', () => {
      const text = "don't can't won't shouldn't";
      const result = counter.count(text);

      expect(result.wordCount).toBe(4);
    });

    it('should handle numbers and punctuation', () => {
      const text = 'The year 2024 has 365 days.';
      const result = counter.count(text);

      expect(result.wordCount).toBe(6);
    });

    it('should handle unicode characters', () => {
      const text = 'Hello 世界 مرحبا дума';
      const result = counter.count(text);

      expect(result.wordCount).toBe(4);
    });

    it('should process 10K words in under 10ms', () => {
      const largeText = 'word '.repeat(10000);
      const start = performance.now();

      counter.count(largeText);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(10);
    });
  });
});

describe('ContentClassifier', () => {
  let classifier: ContentClassifier;

  beforeEach(() => {
    classifier = new ContentClassifier();
  });

  describe('classify', () => {
    it('should detect prose content', () => {
      const prose = `This is a paragraph of regular text. It contains multiple sentences
        with normal punctuation and spacing. The content flows naturally like
        an essay or article would.`;

      const result = classifier.classify(prose);

      expect(result.type).toBe('prose');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect code content with high confidence', () => {
      const code = `function calculateSum(a: number, b: number): number {
  const result = a + b;
  return result;
}

export default calculateSum;`;

      const result = classifier.classify(code);

      expect(result.type).toBe('code');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect markdown tables', () => {
      const table = `| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Value A  | Value B  | Value C  |`;

      const result = classifier.classify(table);

      expect(result.type).toBe('table');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect HTML tables', () => {
      const htmlTable = `<table>
  <tr>
    <th>Header 1</th>
    <th>Header 2</th>
  </tr>
  <tr>
    <td>Data 1</td>
    <td>Data 2</td>
  </tr>
</table>`;

      const result = classifier.classify(htmlTable);

      expect(result.type).toBe('table');
    });

    it('should detect academic citations (APA)', () => {
      const citations = `Smith, J., & Johnson, M. (2024). Advanced AI Systems.
        Journal of Machine Learning, 15(3), 123-145.
        https://doi.org/10.1234/jml.2024.123

        Brown, A. (2023). Neural networks and cognition. MIT Press.`;

      const result = classifier.classify(citations);

      expect(result.type).toBe('citation');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect mixed content with partial confidence', () => {
      const mixed = `Here is some text explaining the code:

        function example() {
          return true;
        }

        And here is more explanation.`;

      const result = classifier.classify(mixed);

      expect(['prose', 'code']).toContain(result.type);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('should handle empty content', () => {
      const result = classifier.classify('');

      expect(result.type).toBe('prose');
      expect(result.confidence).toBe(0);
    });

    it('should detect JSON/structured data as code', () => {
      const json = `{
  "name": "test",
  "version": "1.0.0",
  "dependencies": {
    "vitest": "^1.0.0"
  }
}`;

      const result = classifier.classify(json);

      expect(result.type).toBe('code');
    });

    it('should detect YAML as code', () => {
      const yaml = `name: test
version: 1.0.0
dependencies:
  vitest: ^1.0.0`;

      const result = classifier.classify(yaml);

      expect(result.type).toBe('code');
    });
  });
});

describe('TokenEstimationService', () => {
  let service: TokenEstimationService;

  beforeEach(() => {
    service = new TokenEstimationService();
  });

  describe('estimate', () => {
    it('should estimate tokens for prose using correct ratio', () => {
      const prose = 'The quick brown fox jumps over the lazy dog. This is a test sentence.';

      const result = service.estimate(prose);

      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.contentType).toBe('prose');
      expect(result.confidence).toBeGreaterThan(0);

      // Verify ratio application
      const wordCount = prose.split(/\s+/).length;
      const expectedTokens = Math.ceil(wordCount * TOKEN_RATIOS.prose);
      expect(result.estimatedTokens).toBe(expectedTokens);
    });

    it('should estimate tokens for code using correct ratio', () => {
      const code = `function test() {
  const x = 42;
  return x * 2;
}`;

      const result = service.estimate(code);

      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.contentType).toBe('code');

      // Code typically has more tokens per word
      const wordCount = code.split(/\s+/).filter(w => w.length > 0).length;
      const expectedTokens = Math.ceil(wordCount * TOKEN_RATIOS.code);
      expect(result.estimatedTokens).toBe(expectedTokens);
    });

    it('should estimate tokens for tables using correct ratio', () => {
      const table = `| Col1 | Col2 | Col3 |
|------|------|------|
| A    | B    | C    |`;

      const result = service.estimate(table);

      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.contentType).toBe('table');
    });

    it('should estimate tokens for citations using correct ratio', () => {
      const citation = 'Smith, J. (2024). Title. Journal, 10(2), 123-145. https://doi.org/10.1234/j.2024';

      const result = service.estimate(citation);

      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.contentType).toBe('citation');
    });

    it('should handle empty content', () => {
      const result = service.estimate('');

      expect(result.estimatedTokens).toBe(0);
      expect(result.wordCount).toBe(0);
    });

    it('should include word and character counts', () => {
      const text = 'Hello world test';

      const result = service.estimate(text);

      expect(result.wordCount).toBe(3);
      expect(result.charCount).toBe(text.length);
    });

    it('should perform estimation in under 10ms for 10K words', () => {
      const largeText = 'word '.repeat(10000);
      const start = performance.now();

      service.estimate(largeText);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(10);
    });

    it('should apply different ratios for different content types', () => {
      const prose = 'This is a simple sentence with ten words in it now.';
      const code = 'const x = function() { return 42; }';

      const proseResult = service.estimate(prose);
      const codeResult = service.estimate(code);

      // Code should have higher token-to-word ratio
      const proseRatio = proseResult.estimatedTokens / proseResult.wordCount;
      const codeRatio = codeResult.estimatedTokens / codeResult.wordCount;

      expect(codeRatio).toBeGreaterThan(proseRatio);
    });

    it('should handle very long content', () => {
      const longText = 'word '.repeat(100000);

      const result = service.estimate(longText);

      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.wordCount).toBe(100000);
    });

    it('should return consistent results for same input', () => {
      const text = 'Consistent test input for verification';

      const result1 = service.estimate(text);
      const result2 = service.estimate(text);

      expect(result1.estimatedTokens).toBe(result2.estimatedTokens);
      expect(result1.contentType).toBe(result2.contentType);
      expect(result1.confidence).toBe(result2.confidence);
    });
  });

  describe('TOKEN_RATIOS', () => {
    it('should have all required content type ratios', () => {
      expect(TOKEN_RATIOS).toHaveProperty('prose');
      expect(TOKEN_RATIOS).toHaveProperty('code');
      expect(TOKEN_RATIOS).toHaveProperty('table');
      expect(TOKEN_RATIOS).toHaveProperty('citation');
    });

    it('should have reasonable ratio values', () => {
      expect(TOKEN_RATIOS.prose).toBeGreaterThan(0);
      expect(TOKEN_RATIOS.prose).toBeLessThan(5);

      expect(TOKEN_RATIOS.code).toBeGreaterThan(TOKEN_RATIOS.prose);
      expect(TOKEN_RATIOS.table).toBeGreaterThan(0);
      expect(TOKEN_RATIOS.citation).toBeGreaterThan(0);
    });
  });
});
