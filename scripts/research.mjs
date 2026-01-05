#!/usr/bin/env node

/**
 * God Agent Research Runner (ESM)
 */

import { createRequire } from 'module';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Run via vitest's esbuild which handles the compilation correctly
const topic = process.argv[2] || 'What is the relationship between socialist economic policies and racial outcomes?';

const testCode = `
import { describe, it, expect } from 'vitest';
import { UniversalAgent } from '../src/god-agent/universal/universal-agent.js';

describe('Research Runner', () => {
  it('runs research', async () => {
    const agent = new UniversalAgent({
      verbose: true,
      enablePersistence: true,
      storageDir: '.agentdb/research'
    });

    await agent.initialize();
    console.log('\\n✓ God Agent initialized\\n');

    // Store topic
    const id = await agent.storeKnowledge({
      content: '${topic.replace(/'/g, "\\'")}',
      type: 'fact',
      domain: 'research-topic',
      tags: ['socialism', 'race', 'economics', 'phd']
    });
    console.log('✓ Topic stored:', id);

    // Research
    console.log('\\nRunning deep research...\\n');
    const result = await agent.research('${topic.replace(/'/g, "\\'")}', { depth: 'deep' });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('RESEARCH SYNTHESIS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(result.synthesis);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Findings:', result.findings.length);
    console.log('Knowledge stored:', result.knowledgeStored);

    const stats = agent.getStats();
    console.log('\\nLearning Stats:');
    console.log('  Domain expertise:', JSON.stringify(stats.domainExpertise));
    console.log('  Knowledge entries:', stats.knowledgeEntries);

    await agent.shutdown();
    console.log('\\n✓ Research complete');

    expect(result.synthesis).toBeDefined();
  }, 60000);
});
`;

import { writeFileSync, unlinkSync } from 'fs';
const testFile = join(projectRoot, 'tests', '_temp_research.test.ts');
writeFileSync(testFile, testCode);

const child = spawn('npx', ['vitest', 'run', testFile, '--reporter=verbose'], {
  cwd: projectRoot,
  stdio: 'inherit'
});

child.on('close', (code) => {
  try { unlinkSync(testFile); } catch {}
  process.exit(code);
});
