#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { marked } from 'marked';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Derive project root from script location
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Default directory - can be overridden by first argument
const dir = process.argv[2] || join(PROJECT_ROOT, 'docs/market-research/socialism-race-phd');

// Read all chapters
const chapters = [
  'CHAPTER-01-INTRODUCTION.md',
  'CHAPTER-02-LITERATURE-REVIEW.md', 
  'CHAPTER-03-RESULTS.md',
  'CHAPTER-04-DISCUSSION.md',
  'CHAPTER-05-CONCLUSION.md'
].map(f => readFileSync(`${dir}/${f}`, 'utf-8'));

// Create combined markdown
const frontMatter = `# The Relationship Between Socialist Economic Policies and Racial Outcomes
## A Comparative Analysis of Economic Systems and Ethnic Inequality

**PhD Dissertation**

**Department**: Political Economy / Sociology  
**Date**: December 2025

---

## Abstract

This dissertation examines the relationship between socialist and social democratic economic policies and racial/ethnic inequality outcomes through comparative analysis of five major cases: the Soviet Union (1917-1991), Cuba (1959-present), Nordic welfare states, China (1949-present), and the United States. Drawing from a systematic review of 382 peer-reviewed studies, this research advances the **dual-pathway framework**: economic redistribution and anti-discrimination operate through independent mechanisms.

**Key Finding**: Economic system type affects class-based inequality more powerfully than racial/ethnic inequality. Both Cuban socialism and Nordic social democracy achieved dramatic reductions in overall income inequality, yet racial and ethnic gaps either persisted or re-emerged when market forces returned.

**Word Count**: ~42,000 words | **Sources**: 382 peer-reviewed studies | **Confidence Rating**: 87%

---

## Table of Contents

1. Introduction
2. Literature Review  
3. Results
4. Discussion
5. Conclusion

---

`;

const fullMarkdown = frontMatter + chapters.join('\n\n---\n\n');
const outputMd = `${dir}/FULL-DISSERTATION.md`;
writeFileSync(outputMd, fullMarkdown);

// Convert to HTML
const htmlContent = marked.parse(fullMarkdown);
const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PhD Dissertation: Socialist Economic Policies and Racial Outcomes</title>
  <style>
    @media print {
      body { font-size: 11pt; }
      h1 { page-break-before: always; }
      h1:first-of-type { page-break-before: avoid; }
    }
    @page { margin: 1in; }
    body {
      font-family: 'Times New Roman', Georgia, serif;
      max-width: 750px;
      margin: 0 auto;
      padding: 40px;
      line-height: 1.8;
      color: #222;
    }
    h1 { font-size: 22pt; margin-top: 1.5em; border-bottom: 2px solid #333; padding-bottom: 0.3em; }
    h2 { font-size: 16pt; margin-top: 1.3em; color: #333; }
    h3 { font-size: 13pt; margin-top: 1em; color: #444; }
    h4 { font-size: 12pt; font-style: italic; }
    p { text-align: justify; margin: 0.8em 0; }
    blockquote { border-left: 3px solid #666; padding-left: 1em; margin: 1em 0; background: #f9f9f9; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 9pt; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
    th { background: #f0f0f0; }
    strong { color: #000; }
    hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
    ul, ol { margin: 0.8em 0; }
    .print-btn { background: #0066cc; color: white; padding: 10px 20px; border: none; cursor: pointer; margin: 20px 0; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="background:#ffe;padding:15px;border-radius:8px;margin-bottom:20px;">
    <button class="print-btn" onclick="window.print()">📄 Save as PDF (Ctrl+P)</button>
    <span style="margin-left:15px;">Press Ctrl+P → "Save as PDF" → Save</span>
  </div>
  ${htmlContent}
</body>
</html>`;

writeFileSync(`${dir}/FULL-DISSERTATION.html`, fullHtml);
console.log('✓ Full dissertation compiled:');
console.log('  - Markdown:', outputMd);
console.log('  - HTML:', `${dir}/FULL-DISSERTATION.html`);
console.log('  - Words:', fullMarkdown.split(/\s+/).length);
