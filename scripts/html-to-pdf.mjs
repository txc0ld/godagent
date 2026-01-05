#!/usr/bin/env node
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const inputFile = process.argv[2] || join(__dirname, '../docs/research/online-communities-adolescent-identity/output/dissertation-final.html');
const outputFile = process.argv[3] || inputFile.replace('.html', '.pdf');

console.log('=== HTML to PDF Conversion ===');
console.log(`Input: ${inputFile}`);
console.log(`Output: ${outputFile}`);

async function generatePDF() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  // Load the HTML file
  const htmlContent = readFileSync(inputFile, 'utf-8');
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  // Generate PDF with Harvard GSAS formatting
  await page.pdf({
    path: outputFile,
    format: 'Letter',
    margin: {
      top: '1in',
      bottom: '1in',
      left: '1in',
      right: '1in'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="pageNumber"></span></div>',
  });

  await browser.close();

  console.log(`\nPDF generated successfully: ${outputFile}`);
}

generatePDF().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
