#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { marked } from 'marked';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Derive project root from script location
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Default file - can be overridden by first argument
const inputFile = process.argv[2] || join(PROJECT_ROOT, 'docs/market-research/socialism-race-phd/FINAL-PHD-DISSERTATION.md');
const outputFile = inputFile.replace('.md', '.html');

const markdown = readFileSync(inputFile, 'utf-8');
const htmlContent = marked.parse(markdown);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PhD Dissertation: Socialist Economic Policies and Racial Outcomes</title>
  <style>
    @media print {
      body { font-size: 11pt; }
      h1 { page-break-before: always; }
      h1:first-of-type { page-break-before: avoid; }
      table { page-break-inside: avoid; }
      .no-print { display: none; }
    }
    body {
      font-family: 'Times New Roman', Georgia, serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 60px;
      line-height: 1.8;
      color: #222;
      background: #fff;
    }
    h1 { font-size: 24pt; margin-top: 2em; border-bottom: 2px solid #333; padding-bottom: 0.3em; }
    h2 { font-size: 18pt; margin-top: 1.5em; color: #444; }
    h3 { font-size: 14pt; margin-top: 1.2em; color: #555; }
    h4 { font-size: 12pt; font-style: italic; }
    p { text-align: justify; margin: 1em 0; }
    blockquote {
      border-left: 4px solid #666;
      margin: 1.5em 0;
      padding: 0.5em 1em;
      background: #f9f9f9;
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5em 0;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #f0f0f0; font-weight: bold; }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 10pt;
    }
    pre {
      background: #f4f4f4;
      padding: 1em;
      overflow-x: auto;
      border-radius: 4px;
    }
    hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
    strong { color: #000; }
    a { color: #0066cc; }
    ul, ol { margin: 1em 0; padding-left: 2em; }
    li { margin: 0.3em 0; }
    .title-page {
      text-align: center;
      padding: 100px 0;
    }
    .abstract { font-style: italic; background: #fafafa; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="no-print" style="background:#ffc;padding:10px;margin-bottom:20px;border-radius:4px;">
    <strong>📄 To save as PDF:</strong> Press <kbd>Ctrl+P</kbd> (or <kbd>Cmd+P</kbd> on Mac) → Select "Save as PDF" → Click Save
  </div>
  ${htmlContent}
</body>
</html>`;

writeFileSync(outputFile, fullHtml);
console.log('HTML created:', outputFile);
