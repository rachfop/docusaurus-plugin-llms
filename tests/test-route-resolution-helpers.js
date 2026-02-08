/**
 * Test route resolution helper functions
 *
 * Tests the extracted helper functions for URL resolution from route maps.
 * These tests verify that the refactored code maintains the same behavior.
 */

const path = require('path');
const fs = require('fs-extra');
const { processFilesWithPatterns } = require('../lib/processor');

// Test data setup
const TEST_DIR = path.join(__dirname, 'route-helpers-test');
const DOCS_DIR = path.join(TEST_DIR, 'docs');

async function setupTestFiles() {
  await fs.ensureDir(DOCS_DIR);

  // Create test files with different naming patterns
  await fs.writeFile(
    path.join(DOCS_DIR, 'simple.md'),
    '# Simple\n\nSimple test file.'
  );

  await fs.writeFile(
    path.join(DOCS_DIR, '01-numbered.md'),
    '# Numbered\n\nNumbered prefix file.'
  );

  await fs.writeFile(
    path.join(DOCS_DIR, '02-another.md'),
    '# Another\n\nAnother numbered file.'
  );

  // Nested folder with numbered prefix
  await fs.ensureDir(path.join(DOCS_DIR, '01-category'));
  await fs.writeFile(
    path.join(DOCS_DIR, '01-category', 'nested.md'),
    '# Nested\n\nNested file in numbered category.'
  );

  await fs.writeFile(
    path.join(DOCS_DIR, '01-category', '01-double.md'),
    '# Double\n\nDouble numbered file.'
  );
}

async function cleanupTestFiles() {
  await fs.remove(TEST_DIR);
}

async function runTests() {
  console.log('Testing route resolution helper functions...\n');

  try {
    await setupTestFiles();

    // Test 1: Exact route match
    console.log('Test 1: Exact route match');
    {
      const routeMap = new Map([
        ['/docs/simple', '/simple'],
        ['/docs/01-numbered', '/numbered'],
      ]);

      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routeMap,
      };

      const allFiles = [
        path.join(DOCS_DIR, 'simple.md'),
        path.join(DOCS_DIR, '01-numbered.md'),
      ];

      const results = await processFilesWithPatterns(context, allFiles);

      // Verify that exact matches are found
      const simpleDoc = results.find(doc => doc.path === 'docs/simple.md');
      const numberedDoc = results.find(doc => doc.path === 'docs/01-numbered.md');

      if (simpleDoc && simpleDoc.url === 'https://example.com/simple') {
        console.log('  ✓ PASS: Exact match for simple.md');
      } else {
        console.log('  ✗ FAIL: Expected simple.md to resolve to /simple');
        console.log(`    Got: ${simpleDoc?.url}`);
      }

      if (numberedDoc && numberedDoc.url === 'https://example.com/numbered') {
        console.log('  ✓ PASS: Exact match for numbered file');
      } else {
        console.log('  ✗ FAIL: Expected 01-numbered.md to resolve to /numbered');
        console.log(`    Got: ${numberedDoc?.url}`);
      }
    }

    // Test 2: Cleaned path match (numbered prefix removal)
    console.log('\nTest 2: Cleaned path match (numbered prefix removal)');
    {
      const routeMap = new Map([
        ['/docs/another', '/another'],  // No numbered prefix in route
      ]);

      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routeMap,
      };

      const allFiles = [
        path.join(DOCS_DIR, '02-another.md'),  // Has numbered prefix in filename
      ];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/another') {
        console.log('  ✓ PASS: Cleaned path match removes numbered prefix');
      } else {
        console.log('  ✗ FAIL: Expected 02-another.md to resolve to /another');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 3: Segment-wise match (nested folders with numbered prefixes)
    console.log('\nTest 3: Segment-wise match (nested folders)');
    {
      const routeMap = new Map([
        ['/docs/category/nested', '/category/nested'],  // Category without number
      ]);

      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routeMap,
      };

      const allFiles = [
        path.join(DOCS_DIR, '01-category', 'nested.md'),  // Folder has numbered prefix
      ];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/category/nested') {
        console.log('  ✓ PASS: Segment-wise match removes folder prefix');
      } else {
        console.log('  ✗ FAIL: Expected nested file to resolve to /category/nested');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 4: Double numbered prefixes
    console.log('\nTest 4: Double numbered prefixes');
    {
      const routeMap = new Map([
        ['/docs/category/double', '/category/double'],
      ]);

      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routeMap,
      };

      const allFiles = [
        path.join(DOCS_DIR, '01-category', '01-double.md'),
      ];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/category/double') {
        console.log('  ✓ PASS: Double numbered prefixes handled correctly');
      } else {
        console.log('  ✗ FAIL: Expected double numbered file to resolve correctly');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 5: Fallback when no route map exists
    console.log('\nTest 5: Fallback when no route map exists');
    {
      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        // No routeMap provided
      };

      const allFiles = [
        path.join(DOCS_DIR, 'simple.md'),
      ];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      // Should fall back to path-based URL construction
      if (doc && doc.url === 'https://example.com/docs/simple') {
        console.log('  ✓ PASS: Fallback URL construction works');
      } else {
        console.log('  ✗ FAIL: Expected fallback URL to be /docs/simple');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 6: Best route match with routesPaths
    console.log('\nTest 6: Best route match with routesPaths');
    {
      const routeMap = new Map();  // Empty route map
      const routesPaths = [
        '/docs/another',
        '/docs/category/nested',
        '/docs/simple',
      ];

      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routeMap,
        routesPaths,
      };

      const allFiles = [
        path.join(DOCS_DIR, '02-another.md'),
      ];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      // Should find best match from routesPaths
      if (doc && doc.url === 'https://example.com/docs/another') {
        console.log('  ✓ PASS: Best route match from routesPaths works');
      } else {
        console.log('  ✗ FAIL: Expected best match to find /docs/another');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    console.log('\n✓ All route resolution helper tests completed');

  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await cleanupTestFiles();
  }
}

runTests().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
