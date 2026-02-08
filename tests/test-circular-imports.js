const fs = require('fs').promises;
const path = require('path');
const { processMarkdownFile } = require('../lib/processor');

async function setupTestFiles() {
  const testDir = path.join(__dirname, 'test-circular-imports-temp');

  // Clean up if exists
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (err) {
    // Ignore if doesn't exist
  }

  await fs.mkdir(testDir, { recursive: true });

  // Create partial A that imports partial B
  const partialAContent = `---
title: Partial A
---

## Content from Partial A

This is content from partial A.

import PartialB from './_partial-b.mdx';

<PartialB />

More content after importing B.`;

  await fs.writeFile(
    path.join(testDir, '_partial-a.mdx'),
    partialAContent
  );

  // Create partial B that imports partial A (circular!)
  const partialBContent = `---
title: Partial B
---

## Content from Partial B

This is content from partial B.

import PartialA from './_partial-a.mdx';

<PartialA />

More content after importing A.`;

  await fs.writeFile(
    path.join(testDir, '_partial-b.mdx'),
    partialBContent
  );

  // Create a main document that imports partial A
  const mainContent = `---
title: Main Document
description: Tests circular import detection
---

# Main Document

This document imports a partial with circular dependencies.

import PartialA from './_partial-a.mdx';

## Section

<PartialA />

## End`;

  await fs.writeFile(
    path.join(testDir, 'main.md'),
    mainContent
  );

  // Create another test case with self-import
  const selfImportContent = `---
title: Self Import
---

## Self Importing Partial

import SelfImport from './_self-import.mdx';

<SelfImport />

This should not cause infinite recursion.`;

  await fs.writeFile(
    path.join(testDir, '_self-import.mdx'),
    selfImportContent
  );

  const mainSelfContent = `---
title: Main with Self Import
---

# Testing Self Import

import SelfImport from './_self-import.mdx';

<SelfImport />`;

  await fs.writeFile(
    path.join(testDir, 'main-self.md'),
    mainSelfContent
  );

  return testDir;
}

async function runTests() {
  console.log('Running circular import detection tests...\n');

  const testDir = await setupTestFiles();
  let allTestsPassed = true;

  try {
    // Test 1: Circular import between two partials should be detected
    console.log('Test 1: Circular import between two partials is detected');
    const mainDoc = await processMarkdownFile(
      path.join(testDir, 'main.md'),
      testDir,
      'https://example.com',
      'docs'
    );

    // The document should still be processed (not crash)
    if (mainDoc && mainDoc.content) {
      console.log('  ✅ PASS: Document processed without crashing');
    } else {
      console.log('  ❌ FAIL: Document processing failed');
      allTestsPassed = false;
    }

    // Import statements should be removed
    const hasImportA = mainDoc.content.includes('import PartialA');
    if (!hasImportA) {
      console.log('  ✅ PASS: Import statement removed from main document');
    } else {
      console.log('  ❌ FAIL: Import statement still present');
      allTestsPassed = false;
    }

    // Should contain content from Partial A
    const hasPartialAContent = mainDoc.content.includes('Content from Partial A');
    if (hasPartialAContent) {
      console.log('  ✅ PASS: Partial A content was included');
    } else {
      console.log('  ❌ FAIL: Partial A content missing');
      allTestsPassed = false;
    }

    // Should contain content from Partial B
    const hasPartialBContent = mainDoc.content.includes('Content from Partial B');
    if (hasPartialBContent) {
      console.log('  ✅ PASS: Partial B content was included');
    } else {
      console.log('  ❌ FAIL: Partial B content missing');
      allTestsPassed = false;
    }

    // The circular reference back to A from B should be removed
    // We shouldn't see duplicate "Content from Partial A"
    const partialAMatches = mainDoc.content.match(/Content from Partial A/g);
    if (partialAMatches && partialAMatches.length === 1) {
      console.log('  ✅ PASS: Circular import was prevented (no duplicate content)');
    } else if (partialAMatches && partialAMatches.length > 1) {
      console.log('  ❌ FAIL: Circular import caused duplicate content');
      allTestsPassed = false;
    } else {
      console.log('  ❌ FAIL: Partial A content not found');
      allTestsPassed = false;
    }

    console.log('');

    // Test 2: Self-import should be detected
    console.log('Test 2: Self-import is detected and handled');
    const selfDoc = await processMarkdownFile(
      path.join(testDir, 'main-self.md'),
      testDir,
      'https://example.com',
      'docs'
    );

    // The document should still be processed (not crash)
    if (selfDoc && selfDoc.content) {
      console.log('  ✅ PASS: Document with self-import processed without crashing');
    } else {
      console.log('  ❌ FAIL: Document with self-import processing failed');
      allTestsPassed = false;
    }

    // Should contain the self-importing partial content once
    const selfImportMatches = selfDoc.content.match(/Self Importing Partial/g);
    if (selfImportMatches && selfImportMatches.length === 1) {
      console.log('  ✅ PASS: Self-import was prevented (content appears once)');
    } else if (selfImportMatches && selfImportMatches.length > 1) {
      console.log('  ❌ FAIL: Self-import caused duplicate content');
      allTestsPassed = false;
    } else {
      console.log('  ❌ FAIL: Self-import partial content not found');
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
    console.log('Results: All circular import tests passed.');
    console.log('🎉 Circular import detection is working correctly!');
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
