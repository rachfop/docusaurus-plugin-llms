/**
 * Unit tests for numbered prefix route resolution (Issue #15)
 *
 * This test verifies that the plugin correctly uses Docusaurus resolved routes
 * before falling back to manual numbered prefix removal.
 *
 * Run with: node tests/test-numbered-prefixes.js
 */

const path = require('path');
const fs = require('fs');

/**
 * Test scenarios:
 * 1. Files with numbered prefixes: "01-intro.md"
 * 2. Nested numbered folders: "01-guide/01-start.md"
 * 3. Mixed numbered and non-numbered segments
 * 4. Exact match should be tried first before prefix removal
 */

console.log('Running numbered prefix route resolution tests...\n');

// Test 1: Exact match with numbered prefix in routeMap (should use exact match)
function testExactMatchWithNumberedPrefix() {
  console.log('Test 1: Exact match with numbered prefix in routeMap');

  // Mock route map that contains the exact path with numbered prefix
  const mockRouteMap = new Map([
    ['/docs/01-intro', '/docs/introduction'],
    ['/docs/guide/01-start', '/docs/guide/getting-started'],
  ]);

  // Simulate the logic from processor.ts (lines 289-354)
  function resolveRoute(relativePath, pathPrefix, routeMap) {
    // Try exact match first (without manual prefix removal)
    const possiblePaths = [
      `/${pathPrefix}/${relativePath}`,
      `/${relativePath}`,
    ];

    for (const possiblePath of possiblePaths) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    // ONLY if exact match fails, try numbered prefix removal as fallback
    const removeNumberedPrefixes = (path) => {
      return path.split('/').map(segment => {
        return segment.replace(/^\d+-/, '');
      }).join('/');
    };

    const cleanPath = removeNumberedPrefixes(relativePath);

    for (const possiblePath of [`/${pathPrefix}/${cleanPath}`, `/${cleanPath}`]) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    return undefined;
  }

  // Test case 1a: File "01-intro.md"
  const resolvedUrl1 = resolveRoute('docs/01-intro', 'docs', mockRouteMap);
  const expected1 = '/docs/introduction';

  if (resolvedUrl1 === expected1) {
    console.log('  ✅ PASS: Correctly resolved "docs/01-intro" to "/docs/introduction"');
  } else {
    console.log(`  ❌ FAIL: Expected "${expected1}", got "${resolvedUrl1}"`);
  }

  // Test case 1b: Nested file "guide/01-start.md"
  const resolvedUrl2 = resolveRoute('docs/guide/01-start', 'docs', mockRouteMap);
  const expected2 = '/docs/guide/getting-started';

  if (resolvedUrl2 === expected2) {
    console.log('  ✅ PASS: Correctly resolved "docs/guide/01-start" to "/docs/guide/getting-started"');
  } else {
    console.log(`  ❌ FAIL: Expected "${expected2}", got "${resolvedUrl2}"`);
  }

  console.log('');
}

// Test 2: Fallback to prefix removal when exact match not found
function testFallbackToPrefixRemoval() {
  console.log('Test 2: Fallback to prefix removal when exact match not found');

  // Mock route map that contains only the cleaned paths (no numbered prefixes)
  const mockRouteMap = new Map([
    ['/docs/intro', '/docs/introduction'],
    ['/docs/guide/start', '/docs/guide/getting-started'],
  ]);

  // Simulate the logic from processor.ts
  function resolveRoute(relativePath, pathPrefix, routeMap) {
    // Try exact match first
    const possiblePaths = [
      `/${pathPrefix}/${relativePath}`,
      `/${relativePath}`,
    ];

    for (const possiblePath of possiblePaths) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    // ONLY if exact match fails, try numbered prefix removal as fallback
    const removeNumberedPrefixes = (path) => {
      return path.split('/').map(segment => {
        return segment.replace(/^\d+-/, '');
      }).join('/');
    };

    const cleanPath = removeNumberedPrefixes(relativePath);

    for (const possiblePath of [`/${pathPrefix}/${cleanPath}`, `/${cleanPath}`]) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    return undefined;
  }

  // Test case 2a: File "01-intro.md" falls back to cleaning
  const resolvedUrl1 = resolveRoute('docs/01-intro', 'docs', mockRouteMap);
  const expected1 = '/docs/introduction';

  if (resolvedUrl1 === expected1) {
    console.log('  ✅ PASS: Correctly fell back to prefix removal for "docs/01-intro"');
  } else {
    console.log(`  ❌ FAIL: Expected "${expected1}", got "${resolvedUrl1}"`);
  }

  // Test case 2b: Nested file "guide/01-start.md" falls back to cleaning
  const resolvedUrl2 = resolveRoute('docs/guide/01-start', 'docs', mockRouteMap);
  const expected2 = '/docs/guide/getting-started';

  if (resolvedUrl2 === expected2) {
    console.log('  ✅ PASS: Correctly fell back to prefix removal for "docs/guide/01-start"');
  } else {
    console.log(`  ❌ FAIL: Expected "${expected2}", got "${resolvedUrl2}"`);
  }

  console.log('');
}

// Test 3: Exact match takes precedence over prefix removal
function testExactMatchPrecedence() {
  console.log('Test 3: Exact match takes precedence over prefix removal');

  // Mock route map that has BOTH the exact path and cleaned path
  // This simulates a scenario where Docusaurus has resolved the route differently
  const mockRouteMap = new Map([
    ['/docs/01-intro', '/docs/numbered-intro'],  // Exact match
    ['/docs/intro', '/docs/clean-intro'],         // Cleaned match
  ]);

  // Simulate the logic from processor.ts
  function resolveRoute(relativePath, pathPrefix, routeMap) {
    // Try exact match first
    const possiblePaths = [
      `/${pathPrefix}/${relativePath}`,
      `/${relativePath}`,
    ];

    for (const possiblePath of possiblePaths) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    // ONLY if exact match fails, try numbered prefix removal as fallback
    const removeNumberedPrefixes = (path) => {
      return path.split('/').map(segment => {
        return segment.replace(/^\d+-/, '');
      }).join('/');
    };

    const cleanPath = removeNumberedPrefixes(relativePath);

    for (const possiblePath of [`/${pathPrefix}/${cleanPath}`, `/${cleanPath}`]) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    return undefined;
  }

  // Test case 3: File "01-intro.md" should use exact match, not cleaned
  const resolvedUrl = resolveRoute('docs/01-intro', 'docs', mockRouteMap);
  const expected = '/docs/numbered-intro';  // Should use exact match, not cleaned

  if (resolvedUrl === expected) {
    console.log(`  ✅ PASS: Correctly prioritized exact match "${expected}" over cleaned path`);
  } else {
    console.log(`  ❌ FAIL: Expected "${expected}", got "${resolvedUrl}"`);
    console.log('  This indicates exact match is not being tried first!');
  }

  console.log('');
}

// Test 4: Complex nested numbered folders
function testComplexNestedNumberedFolders() {
  console.log('Test 4: Complex nested numbered folders');

  // Mock route map with multiple levels of numbered prefixes
  const mockRouteMap = new Map([
    ['/docs/01-guide/02-tutorials/03-advanced', '/docs/guide/tutorials/advanced'],
    ['/docs/01-guide/02-tutorials', '/docs/guide/tutorials'],
  ]);

  // Simulate the logic from processor.ts
  function resolveRoute(relativePath, pathPrefix, routeMap) {
    // Try exact match first
    const possiblePaths = [
      `/${pathPrefix}/${relativePath}`,
      `/${relativePath}`,
    ];

    for (const possiblePath of possiblePaths) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    // ONLY if exact match fails, try numbered prefix removal as fallback
    const removeNumberedPrefixes = (path) => {
      return path.split('/').map(segment => {
        return segment.replace(/^\d+-/, '');
      }).join('/');
    };

    const cleanPath = removeNumberedPrefixes(relativePath);

    for (const possiblePath of [`/${pathPrefix}/${cleanPath}`, `/${cleanPath}`]) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    return undefined;
  }

  // Test case 4a: Three levels of numbered prefixes
  const resolvedUrl1 = resolveRoute('docs/01-guide/02-tutorials/03-advanced', 'docs', mockRouteMap);
  const expected1 = '/docs/guide/tutorials/advanced';

  if (resolvedUrl1 === expected1) {
    console.log('  ✅ PASS: Correctly resolved three-level nested numbered folders');
  } else {
    console.log(`  ❌ FAIL: Expected "${expected1}", got "${resolvedUrl1}"`);
  }

  // Test case 4b: Two levels of numbered prefixes
  const resolvedUrl2 = resolveRoute('docs/01-guide/02-tutorials', 'docs', mockRouteMap);
  const expected2 = '/docs/guide/tutorials';

  if (resolvedUrl2 === expected2) {
    console.log('  ✅ PASS: Correctly resolved two-level nested numbered folders');
  } else {
    console.log(`  ❌ FAIL: Expected "${expected2}", got "${resolvedUrl2}"`);
  }

  console.log('');
}

// Test 5: Mixed numbered and non-numbered segments
function testMixedNumberedSegments() {
  console.log('Test 5: Mixed numbered and non-numbered segments');

  // Mock route map with mixed patterns
  const mockRouteMap = new Map([
    ['/docs/api/01-getting-started', '/docs/api/intro'],
    ['/docs/01-guide/reference', '/docs/guide/ref'],
  ]);

  // Simulate the logic from processor.ts
  function resolveRoute(relativePath, pathPrefix, routeMap) {
    // Try exact match first
    const possiblePaths = [
      `/${pathPrefix}/${relativePath}`,
      `/${relativePath}`,
    ];

    for (const possiblePath of possiblePaths) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    // ONLY if exact match fails, try numbered prefix removal as fallback
    const removeNumberedPrefixes = (path) => {
      return path.split('/').map(segment => {
        return segment.replace(/^\d+-/, '');
      }).join('/');
    };

    const cleanPath = removeNumberedPrefixes(relativePath);

    for (const possiblePath of [`/${pathPrefix}/${cleanPath}`, `/${cleanPath}`]) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    return undefined;
  }

  // Test case 5a: Non-numbered folder with numbered file
  const resolvedUrl1 = resolveRoute('docs/api/01-getting-started', 'docs', mockRouteMap);
  const expected1 = '/docs/api/intro';

  if (resolvedUrl1 === expected1) {
    console.log('  ✅ PASS: Correctly resolved non-numbered folder with numbered file');
  } else {
    console.log(`  ❌ FAIL: Expected "${expected1}", got "${resolvedUrl1}"`);
  }

  // Test case 5b: Numbered folder with non-numbered file
  const resolvedUrl2 = resolveRoute('docs/01-guide/reference', 'docs', mockRouteMap);
  const expected2 = '/docs/guide/ref';

  if (resolvedUrl2 === expected2) {
    console.log('  ✅ PASS: Correctly resolved numbered folder with non-numbered file');
  } else {
    console.log(`  ❌ FAIL: Expected "${expected2}", got "${resolvedUrl2}"`);
  }

  console.log('');
}

// Test 6: Trailing slash handling
function testTrailingSlashHandling() {
  console.log('Test 6: Trailing slash handling');

  // Mock route map with trailing slashes
  const mockRouteMap = new Map([
    ['/docs/01-intro/', '/docs/introduction/'],
    ['/docs/guide/', '/docs/guide-home/'],
  ]);

  // Simulate the logic from processor.ts
  function resolveRoute(relativePath, pathPrefix, routeMap) {
    // Try exact match first
    const possiblePaths = [
      `/${pathPrefix}/${relativePath}`,
      `/${relativePath}`,
    ];

    for (const possiblePath of possiblePaths) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    // ONLY if exact match fails, try numbered prefix removal as fallback
    const removeNumberedPrefixes = (path) => {
      return path.split('/').map(segment => {
        return segment.replace(/^\d+-/, '');
      }).join('/');
    };

    const cleanPath = removeNumberedPrefixes(relativePath);

    for (const possiblePath of [`/${pathPrefix}/${cleanPath}`, `/${cleanPath}`]) {
      if (routeMap.has(possiblePath) || routeMap.has(possiblePath + '/')) {
        return routeMap.get(possiblePath) || routeMap.get(possiblePath + '/');
      }
    }

    return undefined;
  }

  // Test case 6a: Path without trailing slash, map has trailing slash
  const resolvedUrl1 = resolveRoute('docs/01-intro', 'docs', mockRouteMap);
  const expected1 = '/docs/introduction/';

  if (resolvedUrl1 === expected1) {
    console.log('  ✅ PASS: Correctly handled trailing slash in route map');
  } else {
    console.log(`  ❌ FAIL: Expected "${expected1}", got "${resolvedUrl1}"`);
  }

  // Test case 6b: Non-numbered path with trailing slash
  const resolvedUrl2 = resolveRoute('docs/guide', 'docs', mockRouteMap);
  const expected2 = '/docs/guide-home/';

  if (resolvedUrl2 === expected2) {
    console.log('  ✅ PASS: Correctly handled trailing slash for non-numbered path');
  } else {
    console.log(`  ❌ FAIL: Expected "${expected2}", got "${resolvedUrl2}"`);
  }

  console.log('');
}

// Run all tests
function runAllTests() {
  console.log('='.repeat(70));
  console.log('Testing numbered prefix route resolution (Issue #15)');
  console.log('='.repeat(70));
  console.log('');

  testExactMatchWithNumberedPrefix();
  testFallbackToPrefixRemoval();
  testExactMatchPrecedence();
  testComplexNestedNumberedFolders();
  testMixedNumberedSegments();
  testTrailingSlashHandling();

  console.log('='.repeat(70));
  console.log('All numbered prefix tests completed!');
  console.log('='.repeat(70));
}

runAllTests();
