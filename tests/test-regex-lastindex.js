const fs = require('fs').promises;
const path = require('path');
const { resolvePartialImports } = require('../lib/utils');

async function setupTestFiles() {
  const testDir = path.join(__dirname, 'test-regex-lastindex-temp');

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

## Shared Content

This is the shared content.`;

  await fs.writeFile(
    path.join(testDir, '_shared.mdx'),
    partialContent
  );

  return testDir;
}

async function runTests() {
  console.log('Running regex lastIndex state leakage tests...\n');

  const testDir = await setupTestFiles();
  let allTestsPassed = true;

  try {
    // Test 1: Sequential calls should not have state leakage
    console.log('Test 1: Multiple sequential calls without state leakage');

    const content1 = `import Shared from './_shared.mdx';

# Document 1

<Shared />`;

    const content2 = `import Shared from './_shared.mdx';

# Document 2

<Shared />`;

    const testFilePath = path.join(testDir, 'test.md');

    // First call
    const result1 = await resolvePartialImports(content1, testFilePath);

    // Second call - this should work correctly without state leakage
    const result2 = await resolvePartialImports(content2, testFilePath);

    // Both should have resolved the import
    const hasPartialContent1 = result1.includes('Shared Content');
    const hasPartialContent2 = result2.includes('Shared Content');
    const noImportStatement1 = !result1.includes('import Shared');
    const noImportStatement2 = !result2.includes('import Shared');

    if (hasPartialContent1 && hasPartialContent2 && noImportStatement1 && noImportStatement2) {
      console.log('  ✅ PASS: Both calls resolved imports correctly\n');
    } else {
      console.log('  ❌ FAIL: State leakage detected');
      console.log(`    First call - has content: ${hasPartialContent1}, no import: ${noImportStatement1}`);
      console.log(`    Second call - has content: ${hasPartialContent2}, no import: ${noImportStatement2}\n`);
      allTestsPassed = false;
    }

    // Test 2: Multiple imports in same file (using the same component multiple times)
    console.log('Test 2: Multiple imports in single file');

    const multiImportContent = `import Shared from './_shared.mdx';

# Document with Multiple Imports

First usage: <Shared />

Second usage: <Shared />`;

    const result3 = await resolvePartialImports(multiImportContent, testFilePath);

    // Should have resolved the import and replaced both JSX usages
    const hasMultipleResolvedContent = result3.split('Shared Content').length - 1 === 2;
    const noMultipleImports = !result3.includes('import');

    if (hasMultipleResolvedContent && noMultipleImports) {
      console.log('  ✅ PASS: Multiple usages resolved correctly\n');
    } else {
      console.log('  ❌ FAIL: Multiple usages not resolved correctly');
      console.log(`    Content appears ${result3.split('Shared Content').length - 1} times (expected 2)`);
      console.log(`    Contains import: ${result3.includes('import')}\n`);
      allTestsPassed = false;
    }

    // Test 3: Rapid successive calls (simulate high load)
    console.log('Test 3: Rapid successive calls');

    const promises = [];
    for (let i = 0; i < 10; i++) {
      const content = `import Shared from './_shared.mdx';

# Document ${i}

<Shared />`;
      promises.push(resolvePartialImports(content, testFilePath));
    }

    const results = await Promise.all(promises);

    // All results should have resolved the import correctly
    const allResolved = results.every(result =>
      result.includes('Shared Content') && !result.includes('import Shared')
    );

    if (allResolved) {
      console.log('  ✅ PASS: All 10 rapid calls resolved correctly\n');
    } else {
      console.log('  ❌ FAIL: Some rapid calls failed');
      const failedCount = results.filter(result =>
        !result.includes('Shared Content') || result.includes('import Shared')
      ).length;
      console.log(`    Failed calls: ${failedCount}/10\n`);
      allTestsPassed = false;
    }

    // Test 4: Empty content after processing
    console.log('Test 4: Regex doesn\'t skip matches');

    const contentWithMultipleImports = `import First from './_shared.mdx';
import Second from './_shared.mdx';
import Third from './_shared.mdx';

# Document

<First />
<Second />
<Third />`;

    const result4 = await resolvePartialImports(contentWithMultipleImports, testFilePath);

    // Should have detected all 3 imports
    const numberOfResolvedContent = result4.split('Shared Content').length - 1;

    if (numberOfResolvedContent === 3) {
      console.log('  ✅ PASS: All 3 imports detected and resolved\n');
    } else {
      console.log(`  ❌ FAIL: Expected 3 imports, but resolved ${numberOfResolvedContent}\n`);
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
    console.log('Results: All regex lastIndex tests passed.');
    console.log('🎉 No state leakage detected!');
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
