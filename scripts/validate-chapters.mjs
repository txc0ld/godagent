#!/usr/bin/env node

/**
 * Chapter Consistency Validator
 *
 * Runs AFTER documents are produced to:
 * 1. Detect what chapters actually exist
 * 2. Find all chapter references in content
 * 3. Report mismatches (references to non-existent chapters)
 * 4. Optionally auto-fix inconsistencies
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, basename } from 'path';

const args = process.argv.slice(2);
const dir = args[0] || 'docs/market-research/socialism-race-phd';
const autoFix = args.includes('--fix');

console.log(`\n📄 Chapter Consistency Validator`);
console.log(`   Directory: ${dir}`);
console.log(`   Auto-fix: ${autoFix ? 'YES' : 'NO (use --fix to enable)'}\n`);

async function main() {
  try {
    const files = await readdir(dir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    // Step 1: Detect existing chapters
    const existingChapters = new Set();
    const chapterFiles = mdFiles.filter(f => f.match(/CHAPTER-\d+/i));

    for (const file of chapterFiles) {
      const match = file.match(/CHAPTER-(\d+)/i);
      if (match) {
        existingChapters.add(parseInt(match[1], 10));
      }
    }

    // Also scan content for "# Chapter X" headers
    for (const file of mdFiles) {
      const content = await readFile(join(dir, file), 'utf-8');
      const headerMatches = content.matchAll(/^#\s*Chapter\s+(\d+)/gmi);
      for (const match of headerMatches) {
        existingChapters.add(parseInt(match[1], 10));
      }
    }

    const sortedChapters = [...existingChapters].sort((a, b) => a - b);
    const maxChapter = Math.max(...sortedChapters);

    console.log(`✓ Existing chapters detected: ${sortedChapters.join(', ')}`);
    console.log(`  Max chapter: ${maxChapter}\n`);

    // Step 2: Find all chapter references
    const issues = [];
    const fileContents = new Map();

    for (const file of mdFiles) {
      const content = await readFile(join(dir, file), 'utf-8');
      fileContents.set(file, content);

      const lines = content.split('\n');
      let inProposedSection = false;

      lines.forEach((line, idx) => {
        // Detect proposed/historical sections to skip
        if (line.match(/originally proposed|proposed structure|initial proposal|for reference/i)) {
          inProposedSection = true;
        }
        // End proposed section at next major heading or separator
        if (inProposedSection && (line.match(/^##[^#]/) || line.match(/^---\s*$/))) {
          inProposedSection = false;
        }

        // Skip chapter references in proposed sections
        if (inProposedSection) return;

        // Match various chapter reference patterns
        const refs = line.matchAll(/Chapter\s+(\d+)/gi);
        for (const ref of refs) {
          const chapterNum = parseInt(ref[1], 10);
          if (!existingChapters.has(chapterNum)) {
            issues.push({
              file,
              line: idx + 1,
              chapter: chapterNum,
              context: line.trim().slice(0, 80),
              fullLine: line,
            });
          }
        }
      });
    }

    // Step 3: Report issues
    if (issues.length === 0) {
      console.log(`✅ All chapter references are valid!\n`);
      process.exit(0);
    }

    console.log(`❌ Found ${issues.length} invalid chapter reference(s):\n`);

    const groupedByFile = {};
    for (const issue of issues) {
      if (!groupedByFile[issue.file]) groupedByFile[issue.file] = [];
      groupedByFile[issue.file].push(issue);
    }

    for (const [file, fileIssues] of Object.entries(groupedByFile)) {
      console.log(`  📁 ${file}:`);
      for (const issue of fileIssues) {
        console.log(`     Line ${issue.line}: Chapter ${issue.chapter} does not exist`);
        console.log(`     "${issue.context}..."`);
      }
      console.log();
    }

    // Step 4: Suggest or apply fixes
    if (autoFix) {
      console.log(`\n🔧 Applying fixes...\n`);

      for (const [file, content] of fileContents) {
        let newContent = content;
        let modified = false;

        for (const issue of issues.filter(i => i.file === file)) {
          // Determine best fix: map to closest existing chapter or remove reference
          const closestChapter = findClosestChapter(issue.chapter, sortedChapters);

          if (closestChapter) {
            // Replace with closest valid chapter
            const pattern = new RegExp(`Chapter\\s+${issue.chapter}\\b`, 'gi');
            const replacement = `Chapter ${closestChapter}`;
            newContent = newContent.replace(pattern, replacement);
            console.log(`  ${file}: Chapter ${issue.chapter} → Chapter ${closestChapter}`);
            modified = true;
          }
        }

        if (modified) {
          await writeFile(join(dir, file), newContent);
          console.log(`  ✓ Updated ${file}`);
        }
      }

      console.log(`\n✅ Fixes applied. Run again to verify.`);
    } else {
      console.log(`\n💡 Suggested fixes:`);
      for (const issue of issues) {
        const closest = findClosestChapter(issue.chapter, sortedChapters);
        if (closest) {
          console.log(`   Chapter ${issue.chapter} → Chapter ${closest} (in ${issue.file})`);
        } else {
          console.log(`   Remove reference to Chapter ${issue.chapter} (in ${issue.file})`);
        }
      }
      console.log(`\nRun with --fix to auto-apply: node scripts/validate-chapters.mjs "${dir}" --fix`);
    }

    process.exit(autoFix ? 0 : 1);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

function findClosestChapter(target, existing) {
  if (existing.length === 0) return null;

  // If target is beyond max, map to conclusion (last chapter)
  const max = Math.max(...existing);
  if (target > max) {
    return max;
  }

  // Find closest existing chapter
  let closest = existing[0];
  let minDiff = Math.abs(target - closest);

  for (const ch of existing) {
    const diff = Math.abs(target - ch);
    if (diff < minDiff) {
      minDiff = diff;
      closest = ch;
    }
  }

  return closest;
}

main();
