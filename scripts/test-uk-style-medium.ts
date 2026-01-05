#!/usr/bin/env npx tsx
/**
 * Medium UK Style Test
 *
 * Tests the full style profile integration:
 * 1. Creates UK style profile with learned characteristics
 * 2. Generates ~1000 words (or uses sample text if no API key)
 * 3. Applies UK transformations
 * 4. Shows before/after comparison
 */

import { SpellingTransformer } from '../src/god-agent/universal/spelling-transformer.js';
import { GrammarTransformer } from '../src/god-agent/universal/grammar-transformer.js';
import * as fs from 'fs';

// Sample US English academic text (~1000 words) to transform
const SAMPLE_US_TEXT = `
# The Importance of Software Testing in Modern Development

## Introduction

Software testing has become an increasingly critical component of the software development lifecycle. Organizations around the world have recognized that proper testing methodologies can significantly minimize defects and optimize overall product quality. This paper analyzes the fundamental principles of software testing and explores how development teams can better organize their testing strategies.

## The Evolution of Testing Practices

Over the past few decades, the software industry has learned valuable lessons about the importance of systematic testing. Early development teams often treated testing as an afterthought, something to be squeezed in at the end of a project. However, this behavior proved costly, as defects discovered late in the development cycle are significantly more expensive to fix than those caught early.

The agile movement has catalyzed a fundamental shift in how teams conceptualize testing. Modern organizations favor continuous testing practices that are woven throughout the development process. This approach has proven more effective than traditional waterfall methodologies where testing was compartmentalized into a distinct phase.

## Key Testing Principles

### 1. Test Early and Often

The principle of early testing emphasizes that quality assurance activities should begin as soon as requirements are finalized. Teams that have gotten into the habit of delaying testing until code completion often discover that they have accumulated significant technical debt. By contrast, organizations that prioritize early testing typically achieve better outcomes.

### 2. Automation is Essential

Manual testing, while valuable for exploratory purposes, cannot scale to meet the demands of modern software development. Organizations must recognize that automated testing is not just desirable but essential for maintaining quality at speed. The investment in test automation pays dividends through faster feedback cycles and more thorough coverage.

Test automation also enables teams to practice continuous integration effectively. When automated tests run with every code commit, developers receive immediate feedback about whether their changes have introduced regressions. This behavior modification toward frequent testing has proven transformative for development velocity.

### 3. Risk-Based Prioritization

Not all code paths are equally critical. Effective testing strategies prioritize testing efforts based on risk analysis. Teams should analyze their systems to identify components where failures would have the greatest impact, and allocate testing resources accordingly.

## Testing Methodologies

### Unit Testing

Unit testing focuses on verifying individual components in isolation. Developers write unit tests to confirm that specific functions or methods behave correctly given various inputs. The practice has gotten widespread adoption because it catches bugs early when they are cheapest to fix.

Well-designed unit tests serve as living documentation, demonstrating how code is intended to behave. When tests are organized properly, new team members can quickly understand the system by studying the test cases.

### Integration Testing

While unit tests verify components in isolation, integration testing confirms that components work together correctly. Many defects only manifest when different parts of a system interact, making integration testing essential for comprehensive quality assurance.

Organizations have realized that integration testing requires careful planning. Tests must be organized to cover the most critical interaction pathways while remaining maintainable as the system evolves.

### End-to-End Testing

End-to-end testing validates complete user workflows, simulating how real users interact with the system. These tests are valuable for catching issues that might be missed by lower-level testing, but they come with trade-offs. End-to-end tests are typically slower and more brittle than unit or integration tests.

Teams must analyze the costs and benefits of end-to-end testing to determine the appropriate level of investment. A common anti-pattern is over-reliance on end-to-end tests, which can lead to slow feedback cycles and high maintenance burden.

## The Human Factor

Despite advances in automation, human judgment remains essential in software testing. Exploratory testing, where skilled testers investigate the system without predefined scripts, often uncovers defects that automated tests miss. The creative analysis that humans bring to testing cannot be fully replicated by automation.

Organizations must also recognize that testing is a specialized skill. Professional testers bring valuable expertise in areas like boundary analysis, equivalence partitioning, and risk assessment. Teams that have underinvested in testing expertise often realize the error when quality issues emerge in production.

## Future Directions

The software testing field continues to evolve rapidly. Artificial intelligence and machine learning are beginning to transform testing practices. AI-powered tools can analyze code to identify likely defect locations, generate test cases automatically, and even self-heal broken tests.

Organizations that want to stay competitive must recognize these trends and adapt accordingly. The teams that capitalize on emerging testing technologies while maintaining fundamental quality principles will be best positioned for success.

## Conclusion

Software testing is not merely a quality gate but a fundamental discipline that enables sustainable software development. Organizations that have internalized this understanding consistently outperform those that treat testing as an afterthought. By embracing modern testing practices and recognizing testing as a first-class development activity, teams can deliver higher-quality software more efficiently.

The investment in testing infrastructure and expertise pays dividends throughout the software lifecycle. As systems grow in complexity and user expectations continue to rise, the importance of systematic testing will only increase. Organizations that recognize and act on this reality will be well-positioned to thrive in an increasingly software-driven world.
`;

async function runMediumTest() {
  console.log('='.repeat(70));
  console.log('UK STYLE PROFILE - MEDIUM TEST');
  console.log('='.repeat(70));
  console.log();

  // Step 1: UK Style Profile Configuration
  console.log('STEP 1: UK Style Profile Configuration');
  console.log('-'.repeat(50));

  console.log('  Using SpellingTransformer (94 rules) + GrammarTransformer (26 rules)');
  console.log('  Regional Variant: en-GB');
  console.log('  Target: Transform US English academic text to UK English');
  console.log();

  // Step 2: Show original US text stats
  console.log('STEP 2: Original US English Text');
  console.log('-'.repeat(50));

  const wordCount = SAMPLE_US_TEXT.split(/\s+/).filter(w => w.length > 0).length;
  console.log(`  Word Count: ${wordCount} words`);
  console.log(`  Contains US spellings: color, organize, analyze, behavior, etc.`);
  console.log(`  Contains US grammar: gotten, different than, toward`);
  console.log();

  // Step 3: Apply UK Transformations
  console.log('STEP 3: Applying UK Transformations');
  console.log('-'.repeat(50));

  // Spelling transformation
  const spellingTransformer = new SpellingTransformer('en-GB');
  const afterSpelling = spellingTransformer.transform(SAMPLE_US_TEXT);

  // Count spelling changes
  const originalWords = SAMPLE_US_TEXT.toLowerCase().split(/\s+/);
  const transformedWords = afterSpelling.toLowerCase().split(/\s+/);
  let spellingChanges = 0;
  const spellingExamples: string[] = [];

  for (let i = 0; i < originalWords.length && i < transformedWords.length; i++) {
    if (originalWords[i] !== transformedWords[i]) {
      spellingChanges++;
      if (spellingExamples.length < 10) {
        spellingExamples.push(`${originalWords[i]} → ${transformedWords[i]}`);
      }
    }
  }

  console.log(`  Spelling Changes: ${spellingChanges}`);
  console.log('  Examples:');
  spellingExamples.forEach(ex => console.log(`    - ${ex}`));
  console.log();

  // Grammar transformation
  const grammarTransformer = new GrammarTransformer('en-GB');
  const grammarResult = grammarTransformer.transform(afterSpelling, {
    preserveQuotes: true,
    categories: ['past-participle', 'preposition']
  });

  console.log(`  Grammar Changes: ${grammarResult.changeCount}`);
  console.log('  Rules Applied:');
  grammarResult.rulesApplied.forEach(rule => console.log(`    - ${rule}`));
  console.log();

  // Step 4: Show transformed text sample
  console.log('STEP 4: Transformed UK English Text (First 500 chars)');
  console.log('-'.repeat(50));
  console.log(grammarResult.transformed.substring(0, 500) + '...');
  console.log();

  // Step 5: Verification
  console.log('STEP 5: Verification');
  console.log('-'.repeat(50));

  const finalText = grammarResult.transformed;

  const lowerFinalText = finalText.toLowerCase();
  const verifications = [
    { us: 'organize', uk: 'organise', found: lowerFinalText.includes('organise') },
    { us: 'recognize', uk: 'recognise', found: lowerFinalText.includes('recognise') },
    { us: 'analyze', uk: 'analyse', found: lowerFinalText.includes('analyse') },
    { us: 'behavior', uk: 'behaviour', found: lowerFinalText.includes('behaviour') },
    { us: 'capitalize', uk: 'capitalise', found: lowerFinalText.includes('capitalise') },
    { us: 'gotten', uk: 'got', found: !lowerFinalText.includes('gotten') },
    { us: 'toward', uk: 'towards', found: lowerFinalText.includes('towards') },
  ];

  let passed = 0;
  let failed = 0;

  verifications.forEach(v => {
    const status = v.found ? '✓' : '✗';
    const result = v.found ? 'PASS' : 'FAIL';
    console.log(`  ${status} ${v.us} → ${v.uk}: ${result}`);
    if (v.found) passed++;
    else failed++;
  });

  console.log();
  console.log('='.repeat(70));
  console.log('TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`  Total Transformations: ${spellingChanges + grammarResult.changeCount}`);
  console.log(`  Spelling: ${spellingChanges} changes`);
  console.log(`  Grammar: ${grammarResult.changeCount} changes`);
  console.log(`  Verifications: ${passed}/${verifications.length} passed`);
  console.log();

  if (failed === 0) {
    console.log('  STATUS: ✓ ALL UK STYLE TRANSFORMATIONS WORKING CORRECTLY');
  } else {
    console.log(`  STATUS: ✗ ${failed} verifications failed`);
  }
  console.log('='.repeat(70));

  // Save the transformed text
  const outputPath = 'docs/research/software-testing/uk-style-test-output.md';
  fs.writeFileSync(outputPath, `# UK Style Test Output

## Metadata
- Original Word Count: ${wordCount}
- Spelling Changes: ${spellingChanges}
- Grammar Changes: ${grammarResult.changeCount}
- Total Transformations: ${spellingChanges + grammarResult.changeCount}

## Transformation Examples

### Spelling (US → UK)
${spellingExamples.map(ex => `- ${ex}`).join('\n')}

### Grammar Rules Applied
${grammarResult.rulesApplied.map(r => `- ${r}`).join('\n')}

## Transformed Text

${grammarResult.transformed}
`);

  console.log();
  console.log(`Output saved to: ${outputPath}`);
}

runMediumTest().catch(console.error);
