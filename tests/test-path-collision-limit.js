/**
 * Tests for path collision detection with iteration limits
 *
 * Run with: node test-path-collision-limit.js
 */

const fs = require('fs');
const path = require('path');
const { generateIndividualMarkdownFiles } = require('../lib/generator');

// Helper function to clean up test directory
async function cleanupTestDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

// Test cases for path collision detection
const testCases = [
  {
    name: 'Multiple path collisions (small number)',
    docs: [
      {
        title: 'Config 1',
        path: 'docs/config.md',
        content: 'Config 1 content',
        description: 'First config',
        url: 'https://example.com/docs/config'
      },
      {
        title: 'Config 2',
        path: 'docs/config.md',
        content: 'Config 2 content',
        description: 'Second config',
        url: 'https://example.com/docs/config'
      },
      {
        title: 'Config 3',
        path: 'docs/config.md',
        content: 'Config 3 content',
        description: 'Third config',
        url: 'https://example.com/docs/config'
      },
      {
        title: 'Config 4',
        path: 'docs/config.md',
        content: 'Config 4 content',
        description: 'Fourth config',
        url: 'https://example.com/docs/config'
      },
      {
        title: 'Config 5',
        path: 'docs/config.md',
        content: 'Config 5 content',
        description: 'Fifth config',
        url: 'https://example.com/docs/config'
      }
    ],
    expectedPaths: ['config.md', 'config-2.md', 'config-3.md', 'config-4.md', 'config-5.md'],
    siteUrl: 'https://example.com',
    description: 'Should handle multiple collisions with counter increments'
  },
  {
    name: 'Large number of collisions (100 files)',
    docs: Array.from({ length: 100 }, (_, i) => ({
      title: `Doc ${i + 1}`,
      path: 'docs/same-path.md',
      content: `Content ${i + 1}`,
      description: `Description ${i + 1}`,
      url: 'https://example.com/docs/same-path'
    })),
    expectedPaths: [
      'same-path.md',
      ...Array.from({ length: 99 }, (_, i) => `same-path-${i + 2}.md`)
    ],
    siteUrl: 'https://example.com',
    description: 'Should handle 100 collisions without hanging'
  },
  {
    name: 'Very large number of collisions (1000 files)',
    docs: Array.from({ length: 1000 }, (_, i) => ({
      title: `Doc ${i + 1}`,
      path: 'docs/collision.md',
      content: `Content ${i + 1}`,
      description: `Description ${i + 1}`,
      url: 'https://example.com/docs/collision'
    })),
    expectedPaths: [
      'collision.md',
      ...Array.from({ length: 999 }, (_, i) => `collision-${i + 2}.md`)
    ],
    siteUrl: 'https://example.com',
    description: 'Should handle 1000 collisions efficiently'
  },
  {
    name: 'Mixed nested paths with collisions',
    docs: [
      {
        title: 'API Ref',
        path: 'docs/api/reference.md',
        content: 'API content 1',
        description: 'API 1',
        url: 'https://example.com/docs/api/reference'
      },
      {
        title: 'API Ref 2',
        path: 'docs/api/reference.md',
        content: 'API content 2',
        description: 'API 2',
        url: 'https://example.com/docs/api/reference'
      },
      {
        title: 'Guide',
        path: 'docs/guide.md',
        content: 'Guide content',
        description: 'Guide',
        url: 'https://example.com/docs/guide'
      },
      {
        title: 'API Ref 3',
        path: 'docs/api/reference.md',
        content: 'API content 3',
        description: 'API 3',
        url: 'https://example.com/docs/api/reference'
      }
    ],
    expectedPaths: ['api/reference.md', 'api/reference-2.md', 'guide.md', 'api/reference-3.md'],
    siteUrl: 'https://example.com',
    description: 'Should handle collisions in nested directories'
  }
];

// Run tests
async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('Starting path collision limit tests...\n');

  for (const testCase of testCases) {
    const testDir = path.join(__dirname, 'output-collision-test');

    try {
      await cleanupTestDirectory(testDir);

      console.log(`Testing: ${testCase.name}`);
      console.log(`  ${testCase.description}`);

      const startTime = Date.now();
      const result = await generateIndividualMarkdownFiles(
        testCase.docs,
        testDir,
        testCase.siteUrl,
        'docs',
        [],
        false // Don't preserve directory structure for easier testing
      );
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`  Completed in ${duration}ms`);

      // Verify all files were created
      if (result.length !== testCase.docs.length) {
        throw new Error(`Expected ${testCase.docs.length} files, got ${result.length}`);
      }

      // Check that all expected files exist
      const generatedPaths = result.map(doc => {
        const urlPath = doc.path.replace(/^\/+/, '');
        return urlPath;
      });

      // For large test cases, just verify count and uniqueness
      if (testCase.docs.length > 100) {
        const uniquePaths = new Set(generatedPaths);
        if (uniquePaths.size !== generatedPaths.length) {
          throw new Error(`Duplicate paths found! Expected ${generatedPaths.length} unique paths, got ${uniquePaths.size}`);
        }
        console.log(`  ✓ All ${generatedPaths.length} files have unique paths`);
      } else {
        // For smaller test cases, check specific paths
        for (let i = 0; i < testCase.expectedPaths.length; i++) {
          const expected = testCase.expectedPaths[i];
          const actual = generatedPaths[i];

          if (actual !== expected) {
            throw new Error(`Path mismatch at index ${i}: expected "${expected}", got "${actual}"`);
          }
        }
        console.log(`  ✓ All paths match expected values`);
      }

      // Verify files exist on disk
      for (const doc of result) {
        const filePath = path.join(testDir, doc.path.replace(/^\/+/, ''));
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
      }
      console.log(`  ✓ All files exist on disk`);

      console.log('  ✓ PASSED\n');
      passed++;

    } catch (error) {
      console.log(`  ✗ FAILED: ${error.message}\n`);
      failed++;
    } finally {
      // Cleanup
      await cleanupTestDirectory(testDir);
    }
  }

  console.log('='.repeat(50));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run the tests
runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
