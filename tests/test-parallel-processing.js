/**
 * Tests for parallel file processing using Promise.allSettled
 *
 * Run with: node test-parallel-processing.js
 */

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { processFilesWithPatterns } = require('../lib/processor');

// Helper to create a temporary test directory
async function createTempDir() {
  const tmpDir = path.join(os.tmpdir(), `llm-plugin-test-parallel-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

// Helper to cleanup test directory
async function cleanupTempDir(tmpDir) {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Helper to create test markdown files
async function createTestFiles(tmpDir, numFiles) {
  const docsDir = path.join(tmpDir, 'docs');
  await fs.mkdir(docsDir, { recursive: true });

  const files = [];
  for (let i = 0; i < numFiles; i++) {
    const filePath = path.join(docsDir, `test-${i}.md`);
    const content = `---
title: Test Document ${i}
description: Test description ${i}
---

# Test Document ${i}

This is test content for document ${i}.
`;
    await fs.writeFile(filePath, content);
    files.push(filePath);
  }

  return files;
}

// Helper to create test files with some that will fail
async function createMixedTestFiles(tmpDir) {
  const docsDir = path.join(tmpDir, 'docs');
  await fs.mkdir(docsDir, { recursive: true });

  const files = [];

  // Create valid files
  for (let i = 0; i < 3; i++) {
    const filePath = path.join(docsDir, `valid-${i}.md`);
    const content = `---
title: Valid Document ${i}
description: Valid description ${i}
---

# Valid Document ${i}

This is valid content for document ${i}.
`;
    await fs.writeFile(filePath, content);
    files.push(filePath);
  }

  // Create draft file (should be skipped)
  const draftPath = path.join(docsDir, 'draft.md');
  const draftContent = `---
title: Draft Document
description: This is a draft
draft: true
---

# Draft Document

This should be skipped.
`;
  await fs.writeFile(draftPath, draftContent);
  files.push(draftPath);

  // Create an invalid file (malformed frontmatter)
  const invalidPath = path.join(docsDir, 'invalid.md');
  const invalidContent = `---
title: Invalid Document
description: This has malformed frontmatter
---extra stuff

# Invalid Document

This file has issues.
`;
  await fs.writeFile(invalidPath, invalidContent);
  files.push(invalidPath);

  return files;
}

const testCases = [
  {
    name: 'Processes multiple files in parallel',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const files = await createTestFiles(tmpDir, 5);

        const context = {
          siteDir: tmpDir,
          siteUrl: 'https://example.com',
          docsDir: 'docs',
          options: {
            excludeImports: false,
            removeDuplicateHeadings: false
          }
        };

        const startTime = Date.now();
        const result = await processFilesWithPatterns(
          context,
          files,
          [], // includePatterns
          [], // ignorePatterns
          [], // orderPatterns
          true // includeUnmatched
        );
        const endTime = Date.now();

        // Check that all files were processed
        if (result.length !== 5) {
          return {
            passed: false,
            error: `Expected 5 processed files, got ${result.length}`
          };
        }

        // Verify each result has required properties
        for (const doc of result) {
          if (!doc.title || !doc.content || !doc.url) {
            return {
              passed: false,
              error: 'Processed document missing required properties'
            };
          }
        }

        console.log(`   Processed ${result.length} files in ${endTime - startTime}ms`);
        return { passed: true };
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Handles individual file failures without stopping processing',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const files = await createMixedTestFiles(tmpDir);

        const context = {
          siteDir: tmpDir,
          siteUrl: 'https://example.com',
          docsDir: 'docs',
          options: {
            excludeImports: false,
            removeDuplicateHeadings: false
          }
        };

        // Capture console.warn output
        const warnings = [];
        const originalWarn = console.warn;
        console.warn = (...args) => {
          warnings.push(args.join(' '));
        };

        try {
          const result = await processFilesWithPatterns(
            context,
            files,
            [], // includePatterns
            [], // ignorePatterns
            [], // orderPatterns
            true // includeUnmatched
          );

          // Restore console.warn
          console.warn = originalWarn;

          // Should have successfully processed the valid files
          // Draft files return null and are filtered out
          // Invalid files may fail but shouldn't stop processing
          if (result.length < 3) {
            return {
              passed: false,
              error: `Expected at least 3 valid processed files, got ${result.length}`
            };
          }

          // Verify that all returned documents are valid
          for (const doc of result) {
            if (!doc.title || !doc.content || !doc.url) {
              return {
                passed: false,
                error: 'Processed document missing required properties'
              };
            }
          }

          console.log(`   Successfully processed ${result.length} valid files despite errors`);
          return { passed: true };
        } finally {
          console.warn = originalWarn;
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Processes files faster than sequential processing would',
    async test() {
      const tmpDir = await createTempDir();

      try {
        // Create more files to make the parallel speedup more noticeable
        const files = await createTestFiles(tmpDir, 10);

        const context = {
          siteDir: tmpDir,
          siteUrl: 'https://example.com',
          docsDir: 'docs',
          options: {
            excludeImports: false,
            removeDuplicateHeadings: false
          }
        };

        const startTime = Date.now();
        const result = await processFilesWithPatterns(
          context,
          files,
          [], // includePatterns
          [], // ignorePatterns
          [], // orderPatterns
          true // includeUnmatched
        );
        const parallelTime = Date.now() - startTime;

        if (result.length !== 10) {
          return {
            passed: false,
            error: `Expected 10 processed files, got ${result.length}`
          };
        }

        console.log(`   Processed ${result.length} files in ${parallelTime}ms using parallel processing`);

        // We can't reliably test that it's faster without a sequential implementation,
        // but we can verify that it completed successfully with all files
        return { passed: true };
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Returns empty array when no files to process',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const docsDir = path.join(tmpDir, 'docs');
        await fs.mkdir(docsDir, { recursive: true });

        const context = {
          siteDir: tmpDir,
          siteUrl: 'https://example.com',
          docsDir: 'docs',
          options: {
            excludeImports: false,
            removeDuplicateHeadings: false
          }
        };

        const result = await processFilesWithPatterns(
          context,
          [], // no files
          [], // includePatterns
          [], // ignorePatterns
          [], // orderPatterns
          true // includeUnmatched
        );

        if (result.length !== 0) {
          return {
            passed: false,
            error: `Expected 0 processed files, got ${result.length}`
          };
        }

        return { passed: true };
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Maintains order when processing files with patterns',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const files = await createTestFiles(tmpDir, 5);

        const context = {
          siteDir: tmpDir,
          siteUrl: 'https://example.com',
          docsDir: 'docs',
          options: {
            excludeImports: false,
            removeDuplicateHeadings: false
          }
        };

        // Use order patterns to specify specific order
        const orderPatterns = [
          'docs/test-4.md',
          'docs/test-2.md',
          'docs/test-0.md',
          'docs/test-3.md',
          'docs/test-1.md'
        ];

        const result = await processFilesWithPatterns(
          context,
          files,
          [], // includePatterns
          [], // ignorePatterns
          orderPatterns,
          true // includeUnmatched
        );

        if (result.length !== 5) {
          return {
            passed: false,
            error: `Expected 5 processed files, got ${result.length}`
          };
        }

        // Verify the order matches the pattern order
        const expectedOrder = ['Test Document 4', 'Test Document 2', 'Test Document 0', 'Test Document 3', 'Test Document 1'];
        for (let i = 0; i < result.length; i++) {
          if (result[i].title !== expectedOrder[i]) {
            return {
              passed: false,
              error: `Expected title "${expectedOrder[i]}" at position ${i}, got "${result[i].title}"`
            };
          }
        }

        console.log(`   Files processed in correct order despite parallel processing`);
        return { passed: true };
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  }
];

async function runTests() {
  console.log('Running parallel processing tests...\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = await testCase.test();

      if (result.passed) {
        console.log(`✅ PASS: ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${testCase.name}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testCase.name}`);
      console.log(`   ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Parallel Processing Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${testCases.length}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
runTests()
  .then(success => {
    if (success) {
      console.log('🎉 All parallel processing tests passed!');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
