const fs = require('fs').promises;
const path = require('path');
const { processMarkdownFile } = require('../lib/processor');

async function setupTestFiles() {
  const testDir = path.join(__dirname, 'test-missing-partials-temp');

  // Clean up if exists
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (err) {
    // Ignore if doesn't exist
  }

  await fs.mkdir(testDir, { recursive: true });

  // Create a main document that imports a missing partial
  const mainContent = `---
title: API Documentation
description: Learn how to use our API
---

# API Documentation

Welcome to our API documentation.

import MissingPartial from './_missing-config.mdx';

## Getting Started

Before you begin, review the configuration:

<MissingPartial />

## Making Requests

After configuring your client, you can make requests...`;

  await fs.writeFile(
    path.join(testDir, 'api-guide.md'),
    mainContent
  );

  // Create a document with named import for missing partial
  const namedImportContent = `---
title: Installation Guide
---

# Installation Guide

import { InstallSteps } from './_install-steps.mdx';

Follow these steps:

<InstallSteps />

Done!`;

  await fs.writeFile(
    path.join(testDir, 'install-guide.md'),
    namedImportContent
  );

  // Create a document with multiple missing partials
  const multipleContent = `---
title: Configuration
---

# Configuration

import FirstPartial from './_first.mdx';
import SecondPartial from './_second.mdx';

## Section 1

<FirstPartial />

## Section 2

<SecondPartial />

## Summary

All done.`;

  await fs.writeFile(
    path.join(testDir, 'config-guide.md'),
    multipleContent
  );

  return testDir;
}

async function runTests() {
  console.log('Running missing partial handling tests...\n');

  const testDir = await setupTestFiles();
  let allTestsPassed = true;

  try {
    // Test 1: Document with missing partial should have import and JSX removed
    console.log('Test 1: Missing partial import and JSX usage are removed');
    const apiDoc = await processMarkdownFile(
      path.join(testDir, 'api-guide.md'),
      testDir,
      'https://example.com',
      'docs'
    );

    // Check that import statement was removed
    const hasImport = apiDoc.content.includes('import MissingPartial');
    if (hasImport) {
      console.log('  ❌ FAIL: Import statement was not removed');
      console.log('  Content:', apiDoc.content);
      allTestsPassed = false;
    } else {
      console.log('  ✅ PASS: Import statement was removed');
    }

    // Check that JSX tag was removed
    const hasJSX = apiDoc.content.includes('<MissingPartial');
    if (hasJSX) {
      console.log('  ❌ FAIL: JSX tag was not removed');
      console.log('  Content:', apiDoc.content);
      allTestsPassed = false;
    } else {
      console.log('  ✅ PASS: JSX tag was removed');
    }

    // Check that surrounding content is still intact
    const hasMainContent = apiDoc.content.includes('Getting Started') &&
                           apiDoc.content.includes('Making Requests');
    if (hasMainContent) {
      console.log('  ✅ PASS: Surrounding content is intact');
    } else {
      console.log('  ❌ FAIL: Surrounding content was affected');
      allTestsPassed = false;
    }

    console.log('');

    // Test 2: Named import for missing partial should be handled
    console.log('Test 2: Named import for missing partial is handled');
    const installDoc = await processMarkdownFile(
      path.join(testDir, 'install-guide.md'),
      testDir,
      'https://example.com',
      'docs'
    );

    const hasNamedImport = installDoc.content.includes('import { InstallSteps }');
    const hasNamedJSX = installDoc.content.includes('<InstallSteps');

    if (!hasNamedImport && !hasNamedJSX) {
      console.log('  ✅ PASS: Named import and JSX removed');
    } else {
      console.log('  ❌ FAIL: Named import or JSX still present');
      if (hasNamedImport) console.log('    - Import still present');
      if (hasNamedJSX) console.log('    - JSX still present');
      console.log('  Content:', installDoc.content);
      allTestsPassed = false;
    }

    console.log('');

    // Test 3: Multiple missing partials should all be handled
    console.log('Test 3: Multiple missing partials are all removed');
    const configDoc = await processMarkdownFile(
      path.join(testDir, 'config-guide.md'),
      testDir,
      'https://example.com',
      'docs'
    );

    const hasFirstImport = configDoc.content.includes('import FirstPartial');
    const hasSecondImport = configDoc.content.includes('import SecondPartial');
    const hasFirstJSX = configDoc.content.includes('<FirstPartial');
    const hasSecondJSX = configDoc.content.includes('<SecondPartial');

    if (!hasFirstImport && !hasSecondImport && !hasFirstJSX && !hasSecondJSX) {
      console.log('  ✅ PASS: All imports and JSX removed');
    } else {
      console.log('  ❌ FAIL: Some imports or JSX still present');
      if (hasFirstImport) console.log('    - FirstPartial import still present');
      if (hasSecondImport) console.log('    - SecondPartial import still present');
      if (hasFirstJSX) console.log('    - FirstPartial JSX still present');
      if (hasSecondJSX) console.log('    - SecondPartial JSX still present');
      console.log('  Content:', configDoc.content);
      allTestsPassed = false;
    }

    // Check section headers are still present
    const hasSections = configDoc.content.includes('Section 1') &&
                        configDoc.content.includes('Section 2') &&
                        configDoc.content.includes('Summary');
    if (hasSections) {
      console.log('  ✅ PASS: Section structure is intact');
    } else {
      console.log('  ❌ FAIL: Section structure was affected');
      allTestsPassed = false;
    }

    console.log('');

  } catch (error) {
    console.error('Test error:', error);
    allTestsPassed = false;
  } finally {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  // Summary
  if (allTestsPassed) {
    console.log('Results: All missing partial handling tests passed.');
    console.log('🎉 Error recovery is working correctly!');
  } else {
    console.log('Results: Some tests failed.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
