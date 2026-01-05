#!/usr/bin/env npx tsx
/**
 * Quick script to combine existing chapter markdown files using PaperCombiner
 * Usage: npx tsx scripts/combine-chapters.ts <research-dir>
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { PaperCombiner } from '../src/god-agent/cli/final-stage/paper-combiner.js';
import type {
  ChapterWriterOutput,
  ChapterNumber,
  CitationRef,
  CrossReference,
  SectionInfo,
  QualityMetrics,
  PaperMetadata
} from '../src/god-agent/cli/final-stage/types.js';

/**
 * Parse a markdown chapter file into ChapterWriterOutput
 */
async function parseChapterFile(filePath: string, chapterNumber: number): Promise<ChapterWriterOutput> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Extract title from first H1
  const titleMatch = content.match(/^#\s+(?:Chapter\s+\d+[:\s]*)?(.+?)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `Chapter ${chapterNumber}`;

  // Count words
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

  // Extract sections from H2 headers
  const sections: SectionInfo[] = [];
  const sectionMatches = content.matchAll(/^##\s+(\d+\.\d+)?\s*(.+?)$/gm);
  let sectionIndex = 1;
  for (const match of sectionMatches) {
    const sectionId = match[1] || `${chapterNumber}.${sectionIndex}`;
    const sectionTitle = match[2].trim();
    sections.push({
      id: sectionId,
      title: sectionTitle,
      wordCount: 0, // Not calculated for simplicity
      hasTable: content.includes('|'),
      hasCodeBlock: content.includes('```'),
      hasFigure: content.includes('![')
    });
    sectionIndex++;
  }

  // Extract citations (APA pattern including organization acronyms)
  // Matches: (Author, 2024), (AWS, 2024), (MITRE, 2024), (Smith et al., 2024)
  const citations: CitationRef[] = [];
  const citationMatches = content.matchAll(/\(([A-Z][A-Za-z]+(?:\s+(?:et\s+al\.|&\s+[A-Z][a-z]+|re:Inforce|[A-Z]+))?),?\s*(\d{4}[a-z]?)\)/g);
  const seenCitations = new Set<string>();
  for (const match of citationMatches) {
    const raw = match[0];
    if (!seenCitations.has(raw)) {
      seenCitations.add(raw);
      citations.push({
        raw,
        author: match[1],
        year: parseInt(match[2], 10),
        inText: true
      });
    }
  }

  // Build quality metrics with defaults
  const qualityMetrics: QualityMetrics = {
    wordCountCompliance: wordCount >= 2000 ? 'pass' : 'warning',
    citationDensity: citations.length / (wordCount / 1000),
    crossRefValidity: true,
    sectionBalance: 0.8,
    readabilityScore: 70
  };

  return {
    chapterNumber: chapterNumber as ChapterNumber,
    title,
    content,
    wordCount,
    citations,
    crossReferences: [],
    sections,
    qualityMetrics,
    generationStatus: 'success',
    warnings: [],
    tokensUsed: Math.floor(wordCount * 1.3)
  };
}

/**
 * Main function
 */
async function main() {
  const researchDir = process.argv[2];

  if (!researchDir) {
    console.error('Usage: npx tsx scripts/combine-chapters.ts <research-dir>');
    console.error('Example: npx tsx scripts/combine-chapters.ts docs/research/my-paper');
    process.exit(1);
  }

  const chaptersDir = path.join(researchDir, 'final', 'chapters');
  const outputDir = path.join(researchDir, 'final');

  console.log(`Reading chapters from: ${chaptersDir}`);

  // Find all chapter files
  const files = await fs.readdir(chaptersDir);
  const chapterFiles = files
    .filter(f => f.match(/^chapter-\d+\.md$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

  if (chapterFiles.length === 0) {
    console.error(`No chapter files found in ${chaptersDir}`);
    console.error('Expected files like: chapter-1.md, chapter-2.md, ...');
    process.exit(1);
  }

  console.log(`Found ${chapterFiles.length} chapters: ${chapterFiles.join(', ')}`);

  // Parse all chapters
  const chapters: ChapterWriterOutput[] = [];
  for (const file of chapterFiles) {
    const chapterNum = parseInt(file.match(/\d+/)?.[0] || '1', 10);
    const filePath = path.join(chaptersDir, file);
    console.log(`  Parsing ${file}...`);
    const chapter = await parseChapterFile(filePath, chapterNum);
    console.log(`    Title: ${chapter.title}`);
    console.log(`    Words: ${chapter.wordCount.toLocaleString()}`);
    console.log(`    Sections: ${chapter.sections.length}`);
    console.log(`    Citations: ${chapter.citations.length}`);
    chapters.push(chapter);
  }

  // Build metadata
  const slug = path.basename(researchDir);
  const metadata: PaperMetadata = {
    title: chapters[0]?.title || 'Research Paper',
    slug,
    generatedDate: new Date().toISOString()
  };

  // Try to extract better title from first chapter content
  const introContent = chapters[0]?.content || '';
  const betterTitleMatch = introContent.match(/^#\s+(.+?)$/m);
  if (betterTitleMatch && !betterTitleMatch[1].toLowerCase().includes('chapter')) {
    metadata.title = betterTitleMatch[1].trim();
  }

  console.log(`\nCombining paper: "${metadata.title}"`);

  // Combine using PaperCombiner
  const combiner = new PaperCombiner();
  const paper = await combiner.combine(chapters, metadata);

  // Write output files
  await combiner.writeOutputFiles(paper, outputDir);

  // Summary
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);
  const totalCitations = new Set(chapters.flatMap(c => c.citations.map(ci => ci.raw))).size;

  console.log(`\n${'='.repeat(60)}`);
  console.log('PAPER COMBINED SUCCESSFULLY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Output: ${path.join(outputDir, 'final-paper.md')}`);
  console.log(`Chapters: ${chapters.length}`);
  console.log(`Total Words: ${totalWords.toLocaleString()}`);
  console.log(`Total Citations: ${totalCitations}`);
  console.log(`Metadata: ${path.join(outputDir, 'metadata.json')}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
