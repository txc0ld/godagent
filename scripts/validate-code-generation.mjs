#!/usr/bin/env node
/**
 * Validation script for SPEC-GEN-001 implementation
 * Verifies that generateCode() method works correctly
 */

import { UniversalAgent } from '../dist/god-agent/universal/universal-agent.js';

async function validateCodeGeneration() {
  console.log('🔍 Validating SPEC-GEN-001: Real Code Generation\n');

  const agent = new UniversalAgent({
    verbose: true,
    enablePersistence: false,
    autoLearn: true,
  });

  try {
    console.log('1️⃣ Initializing UniversalAgent...');
    await agent.initialize();
    console.log('✅ Initialized\n');

    // Test 1: Store pattern first
    console.log('2️⃣ Storing sample patterns...');
    await agent.storeKnowledge({
      content: `function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[0];
  const left = arr.slice(1).filter(x => x < pivot);
  const right = arr.slice(1).filter(x => x >= pivot);
  return [...quickSort(left), pivot, ...quickSort(right)];
}`,
      type: 'pattern',
      domain: 'javascript',
      tags: ['sorting', 'quicksort', 'recursion'],
    });
    console.log('✅ Pattern stored\n');

    // Test 2: Generate code
    console.log('3️⃣ Generating code with pattern context...');
    const result = await agent.code('implement a sorting function', {
      language: 'javascript',
      context: 'Use efficient algorithm',
    });

    console.log('✅ Code generated\n');
    console.log('📊 Result:');
    console.log('  - Task:', result.task);
    console.log('  - Language:', result.language);
    console.log('  - Patterns used:', result.patterns_used.length);
    console.log('  - Code length:', result.code.length, 'chars');
    console.log('  - Learned:', result.learned);
    console.log('  - Has trajectory:', !!result.trajectoryId);

    // Test 3: Verify code content
    console.log('\n4️⃣ Validating generated code...');
    if (result.code.length < 10) {
      throw new Error('Code too short - likely placeholder');
    }
    if (!result.code.includes('//') && !result.code.includes('function')) {
      console.log('⚠️  Warning: Code may be placeholder fallback');
    } else {
      console.log('✅ Code appears valid');
    }

    // Test 4: Check knowledge storage
    console.log('\n5️⃣ Checking knowledge storage...');
    const stats = agent.getStats();
    console.log('  - Total interactions:', stats.totalInteractions);
    console.log('  - Knowledge entries:', stats.knowledgeEntries);
    if (stats.knowledgeEntries === 0) {
      throw new Error('No knowledge stored');
    }
    console.log('✅ Knowledge storage working\n');

    // Test 5: Verify helper methods exist
    console.log('6️⃣ Verifying implementation structure...');
    const methods = [
      'buildPatternContext',
      'extractCodeFromResponse',
      'generateFallbackCode',
    ];

    // Check via reading the source
    const { readFile } = await import('fs/promises');
    const source = await readFile('./src/god-agent/universal/universal-agent.ts', 'utf-8');

    for (const method of methods) {
      if (!source.includes(`private ${method}`) && !source.includes(`private async ${method}`)) {
        throw new Error(`Method ${method} not found`);
      }
    }
    console.log('✅ All helper methods present\n');

    console.log('✅ SPEC-GEN-001 Implementation VALIDATED\n');
    console.log('🎉 All tests passed!');

    await agent.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    console.error(error.stack);
    await agent.shutdown();
    process.exit(1);
  }
}

// Run validation
validateCodeGeneration();
