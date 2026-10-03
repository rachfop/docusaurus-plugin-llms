/**
 * Test script for path transformation ignore functionality
 *
 * Run with: node tests/test-path-transformation-ignore.js
 */

const fs = require('fs');
const path = require('path');
const { processMarkdownFile } = require('../lib/processor');
const { applyPathTransformations } = require('../lib/utils');

// Test the applyPathTransformations function directly
async function testPathTransformations() {
  console.log('=== Testing Path Transformations ===\n');

  const testCases = [
    {
      name: 'Ignore "docs" from path',
      input: 'docs/tutorials/getting-started',
      config: { ignorePaths: ['docs'] },
      expected: 'tutorials/getting-started',
    },
    {
      name: 'Ignore "tutorials" from path',
      input: 'docs/tutorials/getting-started',
      config: { ignorePaths: ['tutorials'] },
      expected: 'docs/getting-started',
    },
    {
      name: 'Ignore multiple segments',
      input: 'docs/tutorials/advanced/concepts',
      config: { ignorePaths: ['docs', 'tutorials'] },
      expected: 'advanced/concepts',
    },
    {
      name: 'Ignore non-existent segment',
      input: 'docs/tutorials/getting-started',
      config: { ignorePaths: ['blog'] },
      expected: 'docs/tutorials/getting-started',
    },
    {
      name: 'Add path prefix',
      input: 'tutorials/getting-started',
      config: { addPaths: ['reference'] },
      expected: 'reference/tutorials/getting-started',
    },
    {
      name: 'Both ignore and add',
      input: 'docs/tutorials/getting-started',
      config: {
        ignorePaths: ['docs'],
        addPaths: ['reference'],
      },
      expected: 'reference/tutorials/getting-started',
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    const result = applyPathTransformations(test.input, test.config);
    if (result === test.expected) {
      console.log(`✅ ${test.name}`);
      console.log(`   Input: "${test.input}" → Output: "${result}"`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Input: "${test.input}"`);
      console.log(`   Expected: "${test.expected}"`);
      console.log(`   Got: "${result}"`);
      failed++;
    }
  }

  console.log(`\nPath Transformation Tests: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Test processMarkdownFile with path transformations
async function testProcessMarkdownFileWithTransformations() {
  console.log('\n=== Testing processMarkdownFile with Path Transformations ===\n');

  const TEST_DIR = path.join(__dirname, '..', 'test-path-transform');

  // Setup
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, 'docs', 'tutorials'), { recursive: true });

  // Create test file
  const testFile = path.join(TEST_DIR, 'docs', 'tutorials', 'draft.md');
  fs.writeFileSync(
    testFile,
    `---
title: Test Tutorial
description: A test tutorial
---

# Test Tutorial

This is a test tutorial.`,
  );

  // A single options argument is ProcessFileOptions, so the transformation
  // goes under `pathTransformation`.
  let allCorrect = true;
  const report = (url, expected) => {
    const correct = url === expected;
    if (!correct) allCorrect = false;
    console.log(`URL: ${url}`);
    console.log(`Expected: ${expected}`);
    console.log(`${correct ? '✅' : '❌'} Correct: ${correct}\n`);
  };

  // Test 1: Default URL generation
  console.log('Test 1: Default URL generation');
  const result1 = await processMarkdownFile(
    testFile,
    path.join(TEST_DIR, 'docs'),
    'https://example.com',
    'docs',
  );
  report(result1.url, 'https://example.com/docs/tutorials/draft');

  // Test 2: With ignorePaths
  console.log('Test 2: With ignorePaths ["tutorials"]');
  const result2 = await processMarkdownFile(
    testFile,
    path.join(TEST_DIR, 'docs'),
    'https://example.com',
    'docs',
    { pathTransformation: { ignorePaths: ['tutorials'] } },
  );
  report(result2.url, 'https://example.com/docs/draft');

  // Test 3: Ignore the path prefix itself
  console.log('Test 3: With ignorePaths ["docs"]');
  const result3 = await processMarkdownFile(
    testFile,
    path.join(TEST_DIR, 'docs'),
    'https://example.com',
    'docs',
    { pathTransformation: { ignorePaths: ['docs'] } },
  );
  report(result3.url, 'https://example.com/tutorials/draft');

  // Test 4: Add paths
  console.log('Test 4: With addPaths ["reference"]');
  const result4 = await processMarkdownFile(
    testFile,
    path.join(TEST_DIR, 'docs'),
    'https://example.com',
    'docs',
    { pathTransformation: { addPaths: ['reference'] } },
  );
  report(result4.url, 'https://example.com/docs/reference/tutorials/draft');

  // Test 5: Combined transformations
  console.log('Test 5: With ignorePaths ["tutorials"] and addPaths ["api"]');
  const result5 = await processMarkdownFile(
    testFile,
    path.join(TEST_DIR, 'docs'),
    'https://example.com',
    'docs',
    {
      pathTransformation: {
        ignorePaths: ['tutorials'],
        addPaths: ['api'],
      },
    },
  );
  report(result5.url, 'https://example.com/docs/api/draft');

  // Cleanup
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }

  return allCorrect;
}

// Run all tests
async function main() {
  try {
    const test1Success = await testPathTransformations();
    const test2Success = await testProcessMarkdownFileWithTransformations();

    console.log('\n========================================');
    console.log('Path Transformation Ignore Test Summary:');
    console.log(`Direct transformation tests: ${test1Success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`File processing tests: ${test2Success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('========================================');

    const allPassed = test1Success && test2Success;
    if (!allPassed) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
