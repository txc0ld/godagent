/**
 * PaperCombiner - Combines chapters into final paper with ToC and metadata
 *
 * Implements SPEC-FUNC-001 Section 2.6 and SPEC-TECH-001 Section 2.5
 *
 * Addresses:
 * - GAP-H006: Table of Contents generation with anchor links
 * - GAP-H007: Appendices handling (inline < 5000 words, separate files otherwise)
 * - GAP-C007: Output directory structure (final/, chapters/, appendices/)
 *
 * Constitution Rules:
 * - FS-003: Chapter file naming convention ch{NN}-{slug}.md
 * - FS-004: Final paper naming final-paper.md
 * - QA-002: Validate all cross-references
 * - QA-004: Table of Contents required
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  ChapterWriterOutput,
  FinalPaper,
  PaperMetadata
} from './types.js';

/**
 * Appendix definition structure
 */
interface AppendixDefinition {
  letter: string;
  title: string;
  source: string;
  content?: string;
  wordCount?: number;
}

/**
 * Cross-reference validation result
 */
interface CrossRefValidation {
  content: string;
  brokenLinks: string[];
  validLinks: number;
}

/**
 * Appendix handling result
 */
interface AppendixResult {
  mainContent: string;
  appendixFiles: string[];
  inlined: boolean;
}

/**
 * PaperCombiner - Combines all chapter outputs into a final paper
 *
 * @example
 * ```typescript
 * const combiner = new PaperCombiner();
 * const paper = await combiner.combine(chapters, metadata);
 * await combiner.writeOutputFiles(paper, outputDir);
 * ```
 */
export class PaperCombiner {
  /**
   * Maximum appendix word count for inline inclusion (5000 words ~ 5 pages)
   */
  private static readonly INLINE_APPENDIX_THRESHOLD = 5000;

  /**
   * Maximum anchor length per spec
   */
  private static readonly MAX_ANCHOR_LENGTH = 50;

  /**
   * Default appendix structure per SPEC-FUNC-001 Section 2.6.5
   */
  private static readonly DEFAULT_APPENDICES: AppendixDefinition[] = [
    { letter: 'A', title: 'Terminology Glossary', source: '02-terminology.md' },
    { letter: 'B', title: 'Construct Definitions', source: '04-constructs.md' },
    { letter: 'C', title: 'Research Plan Details', source: '03-research-plan.md' },
    { letter: 'D', title: 'Pattern Catalog', source: '15-patterns.md' },
    { letter: 'E', title: 'Benchmark Specifications', source: '24-instruments.md' },
    { letter: 'F', title: 'Implementation Guidelines', source: 'generated' }
  ];

  /**
   * Combine chapters into a final paper
   *
   * @param chapters - Array of chapter outputs from ChapterWriterAgent
   * @param metadata - Paper metadata (title, slug, generatedDate)
   * @returns Complete FinalPaper object
   */
  async combine(
    chapters: ChapterWriterOutput[],
    metadata: PaperMetadata
  ): Promise<FinalPaper> {
    // Sort chapters by number
    const sortedChapters = [...chapters].sort(
      (a, b) => a.chapterNumber - b.chapterNumber
    );

    // Generate title page
    const titlePage = this.generateTitlePage(metadata, sortedChapters);

    // Generate table of contents
    const toc = this.generateTableOfContents(sortedChapters);

    // Build combined content
    let combinedContent = titlePage;
    combinedContent += '\n\n---\n\n';
    combinedContent += toc;
    combinedContent += '\n\n---\n\n';

    // Add each chapter with page breaks
    for (const chapter of sortedChapters) {
      combinedContent += chapter.content;
      combinedContent += '\n\n---\n\n';
    }

    // Validate and fix cross-references
    const validation = this.validateCrossReferences(combinedContent, sortedChapters);
    combinedContent = validation.content;

    return {
      title: metadata.title,
      toc,
      chapters: sortedChapters,
      combinedContent,
      metadata
    };
  }

  /**
   * Generate table of contents with anchor links
   * Implements GAP-H006 and GAP-C016 anchor generation
   *
   * @param chapters - Sorted array of chapter outputs
   * @returns Markdown table of contents string
   */
  generateTableOfContents(chapters: ChapterWriterOutput[]): string {
    let toc = '# Table of Contents\n\n';

    for (const chapter of chapters) {
      // Chapter entry (H1)
      const chapterAnchor = this.generateAnchor(chapter.title);
      toc += `${chapter.chapterNumber}. [${chapter.title}](#${chapterAnchor})\n`;

      // Section entries (H2)
      for (const section of chapter.sections) {
        const sectionAnchor = this.generateAnchor(section.title);
        toc += `   ${section.id}. [${section.title}](#${sectionAnchor})\n`;
      }
    }

    return toc;
  }

  /**
   * Write output files to the final directory
   * Implements GAP-C007 output directory structure
   *
   * @param paper - Combined FinalPaper object
   * @param outputDir - Path to final/ output directory
   */
  async writeOutputFiles(paper: FinalPaper, outputDir: string): Promise<void> {
    // Ensure directories exist
    const chaptersDir = path.join(outputDir, 'chapters');
    await fs.mkdir(chaptersDir, { recursive: true });

    // Write individual chapter files
    for (const chapter of paper.chapters) {
      const chapterSlug = this.slugify(chapter.title);
      const paddedNum = String(chapter.chapterNumber).padStart(2, '0');
      const fileName = `ch${paddedNum}-${chapterSlug}.md`;
      const filePath = path.join(chaptersDir, fileName);

      await fs.writeFile(filePath, chapter.content, 'utf-8');
    }

    // Write combined final paper
    const finalPaperPath = path.join(outputDir, 'final-paper.md');
    await fs.writeFile(finalPaperPath, paper.combinedContent, 'utf-8');

    // Write metadata.json
    const metadataPath = path.join(outputDir, 'metadata.json');
    const fullMetadata = this.buildFullMetadata(paper);
    await fs.writeFile(
      metadataPath,
      JSON.stringify(fullMetadata, null, 2),
      'utf-8'
    );
  }

  /**
   * Generate paper metadata from slug and chapters
   *
   * @param slug - Research slug identifier
   * @param chapters - Array of chapter outputs
   * @returns PaperMetadata object
   */
  generateMetadata(slug: string, chapters: ChapterWriterOutput[]): PaperMetadata {
    // Extract title from first chapter or use slug
    const title = chapters.length > 0
      ? this.inferTitleFromChapters(chapters)
      : this.formatSlugAsTitle(slug);

    return {
      title,
      slug,
      generatedDate: new Date().toISOString()
    };
  }

  /**
   * Handle appendices based on total word count
   * Implements GAP-H007
   *
   * @param referencesChapterContent - Content of final chapter (references)
   * @param appendices - Array of appendix definitions with content
   * @param outputDir - Path to output directory
   * @returns AppendixResult with main content and file list
   */
  async handleAppendices(
    referencesChapterContent: string,
    appendices: AppendixDefinition[],
    outputDir: string
  ): Promise<AppendixResult> {
    // Calculate total appendix words
    const totalWords = appendices.reduce(
      (sum, app) => sum + (app.wordCount || this.countWords(app.content || '')),
      0
    );

    let mainContent = referencesChapterContent;
    const appendixFiles: string[] = [];

    if (totalWords < PaperCombiner.INLINE_APPENDIX_THRESHOLD) {
      // Include inline in references chapter
      for (const appendix of appendices) {
        if (appendix.content) {
          mainContent += `\n\n## Appendix ${appendix.letter}: ${appendix.title}\n\n`;
          mainContent += appendix.content;
        }
      }

      return {
        mainContent,
        appendixFiles: [],
        inlined: true
      };
    }

    // Create separate appendix files
    const appendicesDir = path.join(outputDir, 'appendices');
    await fs.mkdir(appendicesDir, { recursive: true });

    for (const appendix of appendices) {
      if (appendix.content) {
        const slug = this.slugify(appendix.title);
        const fileName = `appendix-${appendix.letter.toLowerCase()}-${slug}.md`;
        const filePath = path.join(appendicesDir, fileName);

        // Write appendix file
        const appendixContent = `# Appendix ${appendix.letter}: ${appendix.title}\n\n${appendix.content}`;
        await fs.writeFile(filePath, appendixContent, 'utf-8');

        appendixFiles.push(fileName);

        // Add reference in main content
        mainContent += `\n\n## Appendix ${appendix.letter}: ${appendix.title}\n\n`;
        mainContent += `See [Appendix ${appendix.letter}](./appendices/${fileName})\n`;
      }
    }

    return {
      mainContent,
      appendixFiles,
      inlined: false
    };
  }

  // ============================================
  // Private: Title Page Generation
  // ============================================

  /**
   * Generate title page with metadata
   */
  private generateTitlePage(
    metadata: PaperMetadata,
    chapters: ChapterWriterOutput[]
  ): string {
    const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);
    const totalCitations = this.countUniqueCitations(chapters);

    const formattedDate = new Date(metadata.generatedDate).toLocaleDateString(
      'en-GB',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }
    );

    return `# ${metadata.title}

**Research Query**: ${metadata.slug}

**Generated**: ${formattedDate}

**Total Words**: ${totalWords.toLocaleString()}

**Total Citations**: ${totalCitations}

**Chapters**: ${chapters.length}`;
  }

  // ============================================
  // Private: Anchor Generation (GAP-C016)
  // ============================================

  /**
   * Generate markdown anchor from heading text
   * Per SPEC-FUNC-001 Section 2.6.4
   */
  private generateAnchor(heading: string): string {
    return heading
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Spaces to dashes
      .replace(/-+/g, '-') // Collapse multiple dashes
      .replace(/^-|-$/g, '') // Trim leading/trailing dashes
      .substring(0, PaperCombiner.MAX_ANCHOR_LENGTH);
  }

  // ============================================
  // Private: Cross-Reference Validation (QA-002)
  // ============================================

  /**
   * Validate and fix cross-references in combined content
   */
  private validateCrossReferences(
    content: string,
    chapters: ChapterWriterOutput[]
  ): CrossRefValidation {
    let validated = content;
    const brokenLinks: string[] = [];
    let validLinks = 0;

    // Build set of valid anchors
    const validAnchors = new Set<string>();

    for (const chapter of chapters) {
      // Add chapter anchor
      const chapterAnchor = this.generateAnchor(chapter.title);
      validAnchors.add(chapterAnchor);

      // Add legacy format anchors for backward compatibility
      validAnchors.add(`chapter-${chapter.chapterNumber}`);

      // Add section anchors
      for (const section of chapter.sections) {
        const sectionAnchor = this.generateAnchor(section.title);
        validAnchors.add(sectionAnchor);

        // Add legacy format
        validAnchors.add(`section-${section.id.replace('.', '-')}`);
      }
    }

    // Find and validate all internal links
    const linkPattern = /\[([^\]]+)\]\(#([^)]+)\)/g;
    let match;

    // Use a copy for iteration to avoid issues with replacement
    const originalContent = content;
    const replacements: Array<{ original: string; replacement: string }> = [];

    while ((match = linkPattern.exec(originalContent)) !== null) {
      const [fullMatch, linkText, anchor] = match;

      if (validAnchors.has(anchor)) {
        validLinks++;
      } else {
        brokenLinks.push(anchor);
        // Mark broken link
        replacements.push({
          original: fullMatch,
          replacement: `${linkText} [broken link: ${anchor}]`
        });
      }
    }

    // Apply replacements
    for (const { original, replacement } of replacements) {
      validated = validated.replace(original, replacement);
    }

    return {
      content: validated,
      brokenLinks,
      validLinks
    };
  }

  // ============================================
  // Private: Metadata Building
  // ============================================

  /**
   * Build full metadata object for JSON output
   */
  private buildFullMetadata(paper: FinalPaper): Record<string, unknown> {
    const chapters = paper.chapters.map((c) => ({
      number: c.chapterNumber,
      title: c.title,
      words: c.wordCount,
      citations: c.citations.length,
      wordCountCompliance: c.qualityMetrics.wordCountCompliance
    }));

    return {
      execution: {
        timestamp: paper.metadata.generatedDate,
        phases: {
          paperCombination: {
            status: 'success',
            chaptersProcessed: paper.chapters.length
          }
        }
      },
      document: {
        title: paper.metadata.title,
        researchQuery: paper.metadata.slug,
        totalWords: paper.chapters.reduce((sum, c) => sum + c.wordCount, 0),
        totalCitations: this.countUniqueCitations(paper.chapters),
        chapters
      },
      quality: {
        crossReferencesValidated: true,
        tocGenerated: true
      }
    };
  }

  // ============================================
  // Private: Utility Methods
  // ============================================

  /**
   * Count unique citations across all chapters
   */
  private countUniqueCitations(chapters: ChapterWriterOutput[]): number {
    const seen = new Set<string>();

    for (const chapter of chapters) {
      for (const citation of chapter.citations) {
        seen.add(citation.raw);
      }
    }

    return seen.size;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
  }

  /**
   * Slugify a title for filename use
   */
  private slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  /**
   * Infer paper title from chapters
   */
  private inferTitleFromChapters(chapters: ChapterWriterOutput[]): string {
    // Look for introduction chapter
    const intro = chapters.find((c) => c.chapterNumber === 1);
    if (intro) {
      // Try to extract title from chapter content first line
      const firstLine = intro.content.split('\n')[0];
      if (firstLine.startsWith('# ')) {
        const title = firstLine.replace(/^#\s*/, '').replace(/^Chapter\s*\d+:\s*/i, '');
        if (title.length > 10) {
          return title;
        }
      }
    }

    // Fallback: use first chapter title
    if (chapters.length > 0) {
      return chapters[0].title;
    }

    return 'Research Paper';
  }

  /**
   * Format slug as readable title
   */
  private formatSlugAsTitle(slug: string): string {
    return slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get default appendix definitions
   */
  static getDefaultAppendices(): AppendixDefinition[] {
    return [...PaperCombiner.DEFAULT_APPENDICES];
  }
}
