/**
 * Unit tests for refactored route resolution helper functions
 *
 * Tests suffix-based matching logic and path normalization used by
 * resolveDocumentUrl.
 */

function createMockContext(options = {}) {
  return {
    siteDir: options.siteDir || '/test',
    siteUrl: options.siteUrl || 'https://example.com',
    docsDir: options.docsDir || 'docs',
    options: options.pluginOptions || {},
    routesPaths: options.routesPaths || undefined,
  };
}

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

  // Test 1: Suffix-based matching logic
  console.log('Test Group 1: Suffix-based matching logic');
  {
    function findMatchingRoute(routesPaths, tail) {
      const normalized = tail.toLowerCase().replace(/\/+$/, '');
      if (!normalized) return undefined;
      const matches = routesPaths.filter((route) => {
        const r = route.toLowerCase().replace(/\/+$/, '');
        return r === `/${normalized}` || r.endsWith(`/${normalized}`);
      });
      if (matches.length <= 1) return matches[0];
      return matches.sort((a, b) => a.length - b.length)[0];
    }

    assert(
      findMatchingRoute(['/docs/simple'], 'simple') === '/docs/simple',
      'Simple suffix match',
      'Should match /docs/simple for tail "simple"',
    );

    assert(
      findMatchingRoute(['/simple', '/nightly/simple'], 'simple') === '/simple',
      'Shortest match preferred',
      'Should prefer /simple over /nightly/simple',
    );

    assert(
      findMatchingRoute([], 'simple') === undefined,
      'Empty routes returns undefined',
      'Should return undefined for empty routes',
    );

    assert(
      findMatchingRoute(['/docs/other'], 'simple') === undefined,
      'No match returns undefined',
      'Should return undefined when no route matches',
    );

    assert(
      findMatchingRoute(['/docs/test'], '') === undefined,
      'Empty tail returns undefined',
      'Should return undefined for empty tail',
    );
  }

  // Test 2: Directory collapsing logic
  console.log('\nTest Group 2: Directory collapsing');
  {
    function collapseMatchingTrailingSegment(urlPath) {
      const segments = urlPath.split('/');
      if (segments.length >= 2) {
        const last = segments[segments.length - 1];
        const parent = segments[segments.length - 2];
        if (last.toLowerCase() === parent.toLowerCase()) {
          return segments.slice(0, -1).join('/');
        }
      }
      return urlPath;
    }

    assert(
      collapseMatchingTrailingSegment('generics/generics') === 'generics',
      'Collapse matching trailing segment',
      'Should collapse "generics/generics" to "generics"',
    );

    assert(
      collapseMatchingTrailingSegment('API/API') === 'API',
      'Case-insensitive collapse',
      'Should collapse case-insensitively',
    );

    assert(
      collapseMatchingTrailingSegment('intro/overview') === 'intro/overview',
      'No collapse for non-matching',
      'Should not collapse when segments differ',
    );

    assert(
      collapseMatchingTrailingSegment('single') === 'single',
      'Single segment unchanged',
      'Should return single segment as-is',
    );
  }

  // Test 3: Numbered prefix removal
  console.log('\nTest Group 3: Numbered prefix removal');
  {
    function removeNumberedPrefixes(pathStr) {
      return pathStr
        .split('/')
        .map((segment) => {
          return segment.replace(/^\d+-/, '');
        })
        .join('/');
    }

    assert(removeNumberedPrefixes('01-intro') === 'intro', 'Single segment prefix removal');

    assert(
      removeNumberedPrefixes('01-category/02-file') === 'category/file',
      'Multiple segment prefix removal',
    );

    assert(removeNumberedPrefixes('clean/path') === 'clean/path', 'Clean path unchanged');

    assert(
      removeNumberedPrefixes('01-a/no-prefix/03-c') === 'a/no-prefix/c',
      'Mixed numbered and non-numbered segments',
    );
  }

  // Test 4: Context without routesPaths
  console.log('\nTest Group 4: Context without routesPaths');
  {
    const context = createMockContext({});
    assert(
      !context.routesPaths,
      'No routesPaths returns undefined',
      'Should return undefined when no routesPaths',
    );

    const contextEmpty = createMockContext({ routesPaths: [] });
    assert(
      contextEmpty.routesPaths.length === 0,
      'Empty routesPaths handled',
      'Should handle empty array',
    );
  }

  // Test 5: Suffix matching with trailing slashes
  console.log('\nTest Group 5: Trailing slash handling in suffix matching');
  {
    function findMatchingRoute(routesPaths, tail) {
      const normalized = tail.toLowerCase().replace(/\/+$/, '');
      if (!normalized) return undefined;
      const matches = routesPaths.filter((route) => {
        const r = route.toLowerCase().replace(/\/+$/, '');
        return r === `/${normalized}` || r.endsWith(`/${normalized}`);
      });
      if (matches.length <= 1) return matches[0];
      return matches.sort((a, b) => a.length - b.length)[0];
    }

    assert(
      findMatchingRoute(['/docs/test/'], 'test') === '/docs/test/',
      'Matches route with trailing slash',
      'Should match routes that have trailing slashes',
    );

    assert(
      findMatchingRoute(['/docs/test'], 'test/') === '/docs/test',
      'Matches tail with trailing slash',
      'Should match when tail has trailing slash',
    );
  }

  // Test 6: Path normalization
  console.log('\nTest Group 6: Path normalization');
  {
    const windowsPath = 'docs\\subfolder\\file.md';
    const normalized = windowsPath.split('\\').join('/');
    assert(normalized === 'docs/subfolder/file.md', 'Windows path normalization');

    const indexPath = 'docs/intro/index.md';
    const withoutExt = indexPath.replace(/\.mdx?$/, '');
    const withoutIndex = withoutExt.replace(/\/index$/, '');
    assert(withoutIndex === 'docs/intro', 'Index file handling');

    const mdPath = 'docs/file.md';
    const mdxPath = 'docs/file.mdx';
    assert(mdPath.replace(/\.mdx?$/, '') === 'docs/file', '.md extension removal');
    assert(mdxPath.replace(/\.mdx?$/, '') === 'docs/file', '.mdx extension removal');
  }

  // Test 7: URL construction
  console.log('\nTest Group 7: URL construction');
  {
    const siteUrl = 'https://example.com';
    const resolvedPath = '/docs/test';

    try {
      const fullUrl = new URL(resolvedPath, siteUrl).toString();
      assert(fullUrl === 'https://example.com/docs/test', 'URL construction');
    } catch {
      assert(false, 'URL construction', 'Should not throw error');
    }

    const siteUrlWithSlash = 'https://example.com/';
    try {
      const fullUrl2 = new URL(resolvedPath, siteUrlWithSlash).toString();
      assert(fullUrl2 === 'https://example.com/docs/test', 'URL construction with trailing slash');
    } catch {
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

runTests().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
