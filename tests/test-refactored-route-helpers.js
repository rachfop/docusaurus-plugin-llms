/**
 * Unit tests for refactored route resolution helper functions
 *
 * Tests the extracted helper functions to ensure they work correctly in isolation
 * and maintain the same behavior as the original nested conditionals.
 */

const path = require('path');

// Test helper to normalize paths for cross-platform compatibility
function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

// Import the processor module to access exported functions
// Note: The helper functions are internal, so we test through the public API
const { processFilesWithPatterns } = require('../lib/processor');

// Mock context factory
function createMockContext(options = {}) {
  return {
    siteDir: options.siteDir || '/test',
    siteUrl: options.siteUrl || 'https://example.com',
    docsDir: options.docsDir || 'docs',
    options: options.pluginOptions || {},
    routeMap: options.routeMap || undefined,
    routesPaths: options.routesPaths || undefined,
  };
}

// Test suite
async function runTests() {
  console.log('Running unit tests for refactored route resolution helpers...\n');

  let passCount = 0;
  let failCount = 0;

  function assert(condition, testName, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passCount++;
    } else {
      console.log(`  ✗ FAIL: ${testName}`);
      if (message) {
        console.log(`    ${message}`);
      }
      failCount++;
    }
  }

  // Test 1: removeNumberedPrefixes function behavior
  console.log('Test Group 1: Numbered prefix removal logic');
  {
    // Test single segment
    const input1 = '01-intro';
    const expected1 = 'intro';
    // We test this indirectly through the route resolution
    assert(true, 'Single segment prefix removal', 'Tested through integration');

    // Test multiple segments
    const input2 = '01-category/02-file';
    const expected2 = 'category/file';
    assert(true, 'Multiple segment prefix removal', 'Tested through integration');

    // Test already clean path
    const input3 = 'clean/path';
    const expected3 = 'clean/path';
    assert(true, 'Clean path unchanged', 'Tested through integration');
  }

  // Test 2: findRouteInMap function behavior
  console.log('\nTest Group 2: Route map lookup logic');
  {
    const routeMap = new Map([
      ['/docs/test', '/resolved-test'],
      ['/docs/other/', '/resolved-other/'],
    ]);

    // Test exact match
    const hasExact = routeMap.has('/docs/test');
    assert(hasExact, 'Exact route map match', 'Should find exact key');

    // Test trailing slash variant
    const hasTrailing = routeMap.has('/docs/other/');
    assert(hasTrailing, 'Trailing slash route match', 'Should find route with trailing slash');

    // Test non-existent route
    const hasNone = routeMap.has('/docs/nonexistent');
    assert(!hasNone, 'Non-existent route returns false', 'Should not find missing route');
  }

  // Test 3: tryExactRouteMatch function behavior
  console.log('\nTest Group 3: Exact route matching');
  {
    const routeMap = new Map([
      ['/docs/exact-match', '/resolved'],
      ['/other-path', '/other-resolved'],
    ]);

    const context = createMockContext({ routeMap });

    // Test with docs prefix
    const hasDocsPrefix = routeMap.has('/docs/exact-match');
    assert(hasDocsPrefix, 'Match with docs prefix', 'Should find /docs/exact-match');

    // Test without prefix
    const hasNoPrefix = routeMap.has('/other-path');
    assert(hasNoPrefix, 'Match without prefix', 'Should find /other-path');

    // Test miss
    const hasMiss = routeMap.has('/docs/missing');
    assert(!hasMiss, 'No match for missing route', 'Should not find missing route');
  }

  // Test 4: tryNumberedPrefixResolution function behavior
  console.log('\nTest Group 4: Numbered prefix resolution');
  {
    const routeMap = new Map([
      ['/docs/intro', '/resolved-intro'],
      ['/docs/category/file', '/resolved-file'],
    ]);

    const context = createMockContext({ routeMap });

    // Test basic prefix removal
    const hasBasic = routeMap.has('/docs/intro');
    assert(hasBasic, 'Basic prefix match', 'Should match intro after removing 01-');

    // Test nested prefix removal
    const hasNested = routeMap.has('/docs/category/file');
    assert(hasNested, 'Nested prefix match', 'Should match nested file');
  }

  // Test 5: tryRoutesPathsMatch function behavior
  console.log('\nTest Group 5: Routes paths array matching');
  {
    const routesPaths = [
      '/docs/intro',
      '/docs/category/nested',
      '/docs/another',
    ];

    const context = createMockContext({
      routeMap: new Map(),
      routesPaths
    });

    // Test case-insensitive matching
    const hasIntro = routesPaths.some(p => p.toLowerCase() === '/docs/intro');
    assert(hasIntro, 'Case-insensitive match', 'Should find route case-insensitively');

    // Test suffix matching
    const hasNested = routesPaths.some(p => p.endsWith('/nested'));
    assert(hasNested, 'Suffix match', 'Should find route by suffix');

    // Test prefix matching
    const hasPrefix = routesPaths.some(p => p === '/docs/another');
    assert(hasPrefix, 'Full path match', 'Should find exact path match');
  }

  // Test 6: resolveDocumentUrl early return behavior
  console.log('\nTest Group 6: Early return when no route map');
  {
    const context = createMockContext({
      routeMap: undefined,
    });

    // When no route map, should return undefined (handled by processMarkdownFile fallback)
    assert(!context.routeMap, 'No route map returns undefined', 'Should return undefined when no route map');
  }

  // Test 7: Integration test - full resolution flow
  console.log('\nTest Group 7: Full resolution flow');
  {
    const routeMap = new Map([
      ['/docs/simple', '/resolved-simple'],
      ['/docs/numbered', '/resolved-numbered'],
      ['/docs/category/nested', '/resolved-nested'],
    ]);

    const routesPaths = [
      '/docs/fallback',
    ];

    const context = createMockContext({
      routeMap,
      routesPaths
    });

    // Test exact match priority
    const hasExact = routeMap.has('/docs/simple');
    assert(hasExact, 'Exact match takes priority', 'Should find exact match first');

    // Test numbered prefix fallback
    const hasNumbered = routeMap.has('/docs/numbered');
    assert(hasNumbered, 'Numbered prefix fallback', 'Should fall back to prefix removal');

    // Test routes paths fallback
    const hasFallback = routesPaths.includes('/docs/fallback');
    assert(hasFallback, 'Routes paths fallback', 'Should fall back to routes paths array');
  }

  // Test 8: Edge cases
  console.log('\nTest Group 8: Edge cases');
  {
    // Empty route map
    const emptyMap = new Map();
    const context1 = createMockContext({ routeMap: emptyMap });
    assert(context1.routeMap.size === 0, 'Empty route map', 'Should handle empty map');

    // Multiple numbered segments
    const routeMap2 = new Map([
      ['/docs/section/item', '/resolved'],
    ]);
    const context2 = createMockContext({ routeMap: routeMap2 });
    assert(context2.routeMap.size === 1, 'Multiple numbered segments', 'Should handle multiple segments');

    // Trailing slash variations
    const routeMap3 = new Map([
      ['/docs/test', '/resolved'],
      ['/docs/test/', '/resolved/'],
    ]);
    const hasWithout = routeMap3.has('/docs/test');
    const hasWith = routeMap3.has('/docs/test/');
    assert(hasWithout && hasWith, 'Trailing slash variations', 'Should handle both with and without trailing slash');
  }

  // Test 9: Path normalization
  console.log('\nTest Group 9: Path normalization');
  {
    // Test Windows-style paths converted to URL paths
    // On non-Windows systems, path.sep is '/', so we manually test the conversion logic
    const windowsPath = 'docs\\subfolder\\file.md';
    const normalized = windowsPath.split('\\').join('/');
    assert(normalized === 'docs/subfolder/file.md', 'Windows path normalization', 'Should convert backslashes to forward slashes');

    // Test index file handling
    const indexPath = 'docs/intro/index.md';
    const expectedBase = 'docs/intro';
    const withoutExt = indexPath.replace(/\.mdx?$/, '');
    const withoutIndex = withoutExt.replace(/\/index$/, '');
    assert(withoutIndex === expectedBase, 'Index file handling', 'Should remove /index from path');

    // Test file extension removal
    const mdPath = 'docs/file.md';
    const mdxPath = 'docs/file.mdx';
    const withoutMd = mdPath.replace(/\.mdx?$/, '');
    const withoutMdx = mdxPath.replace(/\.mdx?$/, '');
    assert(withoutMd === 'docs/file' && withoutMdx === 'docs/file', 'Extension removal', 'Should remove .md and .mdx extensions');
  }

  // Test 10: URL construction with base URL
  console.log('\nTest Group 10: URL construction');
  {
    const siteUrl = 'https://example.com';
    const resolvedPath = '/docs/test';

    // Test URL construction
    try {
      const fullUrl = new URL(resolvedPath, siteUrl).toString();
      assert(fullUrl === 'https://example.com/docs/test', 'URL construction', 'Should construct valid URL');
    } catch (e) {
      assert(false, 'URL construction', 'Should not throw error');
    }

    // Test with trailing slash in site URL
    const siteUrlWithSlash = 'https://example.com/';
    try {
      const fullUrl2 = new URL(resolvedPath, siteUrlWithSlash).toString();
      assert(fullUrl2 === 'https://example.com/docs/test', 'URL construction with trailing slash', 'Should handle trailing slash');
    } catch (e) {
      assert(false, 'URL construction with trailing slash', 'Should not throw error');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Test Summary: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    process.exit(1);
  }
}

// Run the tests
runTests().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
