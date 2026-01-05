#!/usr/bin/env node
import PDFDocument from 'pdfkit';
import { createWriteStream, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESEARCH_DIR = join(__dirname, '../docs/research/online-communities-adolescent-identity');
const OUTPUT_FILE = join(RESEARCH_DIR, 'output/dissertation-final.pdf');

console.log('=== Dissertation PDF Generator ===\n');

// Create PDF document with Harvard GSAS formatting
const doc = new PDFDocument({
  size: 'LETTER',
  margins: {
    top: 72,    // 1 inch
    bottom: 72,
    left: 72,
    right: 72
  },
  info: {
    Title: 'How Do Online Communities Support or Harm Adolescent Identity Formation?',
    Author: '[Author Name]',
    Subject: 'PhD Dissertation',
    Keywords: 'adolescent identity, online communities, social media, LGBTQ+, cyberbullying'
  }
});

// Pipe to file
const stream = createWriteStream(OUTPUT_FILE);
doc.pipe(stream);

// Helper functions
function addTitle(text, size = 24) {
  doc.fontSize(size).font('Helvetica-Bold').text(text, { align: 'center' });
  doc.moveDown(0.5);
}

function addHeading(text, level = 1) {
  const sizes = { 1: 18, 2: 14, 3: 12 };
  const cleanedText = cleanText(text);
  doc.moveDown(1);
  doc.fontSize(sizes[level] || 12).font('Helvetica-Bold').text(cleanedText);
  doc.moveDown(0.3);
}

function cleanText(text) {
  // Replace Unicode GRADE symbols with text equivalents
  return text
    .replace(/⊕⊕⊕⊕/g, '[HIGH]')
    .replace(/⊕⊕⊕◯/g, '[MODERATE]')
    .replace(/⊕⊕◯◯/g, '[LOW]')
    .replace(/⊕◯◯◯/g, '[VERY LOW]')
    .replace(/⊕/g, '+')
    .replace(/◯/g, 'o')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↔/g, '<->')
    .replace(/✅/g, '[OK]')
    .replace(/✓/g, '[OK]')
    .replace(/❌/g, '[X]')
    .replace(/⚠️/g, '[!]')
    .replace(/🎯/g, '')
    .replace(/📊/g, '')
    .replace(/📈/g, '')
    .replace(/🔬/g, '')
    .replace(/💡/g, '')
    .replace(/[^\x00-\x7F]/g, (char) => {
      // Replace any remaining non-ASCII with space or remove
      return ' ';
    });
}

function addParagraph(text) {
  const cleanedText = cleanText(text);
  doc.fontSize(12).font('Times-Roman').text(cleanedText, {
    align: 'justify',
    lineGap: 6
  });
  doc.moveDown(0.5);
}

function addPageNumber() {
  const pageNum = doc.bufferedPageRange().count;
  doc.fontSize(10).text(
    String(pageNum),
    0, doc.page.height - 50,
    { align: 'center' }
  );
}

// Process markdown file to extract sections
function processMarkdown(content) {
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    // Skip code blocks
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Skip metadata/frontmatter
    if (line.startsWith('---')) continue;
    if (line.startsWith('**Status**:')) continue;
    if (line.startsWith('**Date**:')) continue;
    if (line.startsWith('**Word Count**:')) continue;

    // Headers
    if (line.startsWith('# ')) {
      addHeading(line.replace('# ', ''), 1);
    } else if (line.startsWith('## ')) {
      addHeading(line.replace('## ', ''), 2);
    } else if (line.startsWith('### ')) {
      addHeading(line.replace('### ', ''), 3);
    } else if (line.trim() && !line.startsWith('|') && !line.startsWith('<')) {
      // Regular paragraph (skip tables and HTML)
      const cleanText = line
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
        .replace(/\*(.*?)\*/g, '$1')       // Remove italic
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
        .replace(/`(.*?)`/g, '$1');         // Remove code formatting

      if (cleanText.trim()) {
        addParagraph(cleanText);
      }
    }
  }
}

// === Generate PDF ===

// Title Page (page i)
doc.fontSize(24).font('Helvetica-Bold');
doc.moveDown(8);
doc.text('How Do Online Communities Support or Harm', { align: 'center' });
doc.text('Adolescent Identity Formation?', { align: 'center' });
doc.moveDown(1);
doc.fontSize(16).font('Helvetica');
doc.text('A Systematic Review and Theoretical Synthesis', { align: 'center' });
doc.moveDown(4);
doc.fontSize(12);
doc.text('A dissertation presented', { align: 'center' });
doc.text('by', { align: 'center' });
doc.moveDown(0.5);
doc.font('Helvetica-Bold').text('[Author Name]', { align: 'center' });
doc.moveDown(1);
doc.font('Helvetica').text('to', { align: 'center' });
doc.text('The Department of [Department Name]', { align: 'center' });
doc.moveDown(1);
doc.text('in partial fulfillment of the requirements', { align: 'center' });
doc.text('for the degree of', { align: 'center' });
doc.font('Helvetica-Bold').text('Doctor of Philosophy', { align: 'center' });
doc.moveDown(2);
doc.font('Helvetica').text('Harvard University', { align: 'center' });
doc.text('Cambridge, Massachusetts', { align: 'center' });
doc.moveDown(1);
doc.text('December 2025', { align: 'center' });

// Copyright Page (page ii)
doc.addPage();
doc.moveDown(15);
doc.fontSize(12).text('© 2025 [Author Name]', { align: 'center' });
doc.text('All rights reserved.', { align: 'center' });

// Abstract (page iii)
doc.addPage();
console.log('Adding Abstract...');
try {
  const abstract = readFileSync(join(RESEARCH_DIR, '00-abstract.md'), 'utf-8');
  addHeading('Abstract', 1);

  // Extract just the abstract text
  const abstractMatch = abstract.match(/## Abstract\n\n([\s\S]*?)(?=\n---|\n\*Keywords)/);
  if (abstractMatch) {
    const paragraphs = abstractMatch[1].split('\n\n');
    for (const p of paragraphs) {
      if (p.trim() && !p.startsWith('**')) {
        addParagraph(p.replace(/\*\*/g, '').replace(/\*/g, ''));
      } else if (p.startsWith('**')) {
        // Handle labeled sections like **Background:**
        const cleanP = p.replace(/\*\*/g, '');
        addParagraph(cleanP);
      }
    }
  }

  // Add keywords
  const keywordsMatch = abstract.match(/\*Keywords\*: (.*)/);
  if (keywordsMatch) {
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(12).text('Keywords: ', { continued: true });
    doc.font('Times-Roman').text(keywordsMatch[1]);
  }
} catch (e) {
  console.log('  Abstract not found, skipping...');
}

// Table of Contents placeholder
doc.addPage();
addHeading('Table of Contents', 1);
doc.moveDown(1);

const chapters = [
  ['Chapter 1', 'Introduction', '1'],
  ['Chapter 2', 'Theoretical Framework', '30'],
  ['Chapter 3', 'Methodology', '60'],
  ['Chapter 4', 'Supportive Mechanisms', '96'],
  ['Chapter 5', 'Harmful Mechanisms', '145'],
  ['Chapter 6', 'Moderating Factors', '220'],
  ['Chapter 7', 'Causal Mechanisms', '285'],
  ['Chapter 8', 'Implications', '345'],
  ['Chapter 9', 'Conclusion', '455'],
  ['References', '', '525']
];

for (const [num, title, page] of chapters) {
  const fullTitle = title ? `${num}: ${title}` : num;
  doc.fontSize(12).font('Times-Roman');
  doc.text(fullTitle, { continued: true });
  doc.text(page, { align: 'right' });
}

// Process each chapter
const chapterFiles = [
  '01-introduction.md',
  '02-theoretical-framework.md',
  '03-methodology.md',
  '04-supportive-mechanisms.md',
  '05-harmful-mechanisms.md',
  '06-moderating-factors.md',
  '07-causal-mechanisms.md',
  '08-implications.md',
  '09-conclusion.md',
  '10-references.md'
];

let pageNumber = 1;

for (const file of chapterFiles) {
  const chapterPath = join(RESEARCH_DIR, 'chapters', file);
  console.log(`Adding: ${file}`);

  try {
    const content = readFileSync(chapterPath, 'utf-8');
    doc.addPage();
    processMarkdown(content);
  } catch (e) {
    console.log(`  Warning: Could not read ${file}`);
  }
}

// Finalize
doc.end();

stream.on('finish', () => {
  console.log(`\n✅ PDF generated successfully!`);
  console.log(`Output: ${OUTPUT_FILE}`);

  // Get file size
  import('fs').then(fs => {
    const stats = fs.statSync(OUTPUT_FILE);
    console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  });
});

stream.on('error', (err) => {
  console.error('Error writing PDF:', err);
});
