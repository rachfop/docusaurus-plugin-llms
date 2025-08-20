const fs = require('fs').promises;
const path = require('path');
const { processMarkdownFile } = require('../lib/processor');

async function setupTestFiles() {
  const testDir = path.join(__dirname, 'test-partials-temp');
  
  // Clean up if exists
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (err) {
    // Ignore if doesn't exist
  }
  
  await fs.mkdir(testDir, { recursive: true });
  
  // Create a partial file
  const partialContent = `---
title: Shared Component
---

## Common Configuration

This is shared configuration that appears in multiple documents.

\`\`\`javascript
const config = {
  api: 'https://api.example.com',
  timeout: 5000
};
\`\`\`

Remember to update these settings in production.`;
  
  await fs.writeFile(
    path.join(testDir, '_shared-config.mdx'),
    partialContent
  );
  
  // Create a main document that imports the partial
  const mainContent = `---
title: API Documentation
description: Learn how to use our API
---

# API Documentation

Welcome to our API documentation.

import SharedConfig from './_shared-config.mdx';

## Getting Started

Before you begin, review the configuration:

<SharedConfig />

## Making Requests

After configuring your client, you can make requests...`;
  
  await fs.writeFile(
    path.join(testDir, 'api-guide.md'),
    mainContent
  );
  
  // Create another document without partials
  const normalContent = `---
title: Quick Start
---

# Quick Start Guide

This is a normal document without any partials.`;
  
  await fs.writeFile(
    path.join(testDir, 'quick-start.md'),
    normalContent
  );
  
  return testDir;
}

async function runTests() {
  console.log('Running partial handling tests...\n');
  
  const testDir = await setupTestFiles();
  let allTestsPassed = true;
  
  try {
    // Test 1: Partial file should be excluded from file listing
    console.log('Test 1: Partial files are excluded from processing');
    const { readMarkdownFiles } = require('../lib/utils');
    const files = await readMarkdownFiles(testDir, testDir, []);
    const hasPartial = files.some(f => f.includes('_shared-config'));
    
    if (!hasPartial) {
      console.log('  ✅ PASS: Partial file was excluded from file listing\n');
    } else {
      console.log('  ❌ FAIL: Partial file was included in file listing\n');
      allTestsPassed = false;
    }
    
    // Test 2: Document with partial import should have content resolved
    console.log('Test 2: Partial content is resolved in importing document');
    const apiDoc = await processMarkdownFile(
      path.join(testDir, 'api-guide.md'),
      testDir,
      'https://example.com',
      'docs'
    );
    
    // Check that import statement was removed
    const hasImport = apiDoc.content.includes('import SharedConfig');
    if (hasImport) {
      console.log('  ❌ FAIL: Import statement was not removed');
      allTestsPassed = false;
    } else {
      console.log('  ✅ PASS: Import statement was removed');
    }
    
    // Check that JSX tag was replaced
    const hasJSX = apiDoc.content.includes('<SharedConfig');
    if (hasJSX) {
      console.log('  ❌ FAIL: JSX tag was not replaced');
      allTestsPassed = false;
    } else {
      console.log('  ✅ PASS: JSX tag was replaced');
    }
    
    // Check that partial content is present
    const hasPartialContent = apiDoc.content.includes('Common Configuration') && 
                              apiDoc.content.includes('api: \'https://api.example.com\'');
    if (hasPartialContent) {
      console.log('  ✅ PASS: Partial content was inlined');
    } else {
      console.log('  ❌ FAIL: Partial content was not inlined');
      allTestsPassed = false;
    }
    
    console.log('');
    
    // Test 3: Normal document without partials works as before
    console.log('Test 3: Normal documents work without changes');
    const normalDoc = await processMarkdownFile(
      path.join(testDir, 'quick-start.md'),
      testDir,
      'https://example.com',
      'docs'
    );
    
    if (normalDoc && normalDoc.content.includes('Quick Start Guide')) {
      console.log('  ✅ PASS: Normal document processed correctly\n');
    } else {
      console.log('  ❌ FAIL: Normal document not processed correctly\n');
      allTestsPassed = false;
    }
    
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
    console.log('Results: All partial handling tests passed.');
    console.log('🎉 Partial support is working correctly!');
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