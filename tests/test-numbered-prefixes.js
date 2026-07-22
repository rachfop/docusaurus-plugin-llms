/**
 * Unit tests for numbered prefix route resolution
 *
 * Tests that the suffix-based matching correctly handles files and folders
 * with numbered prefixes (e.g. "01-intro.md", "02-guide/").
 *
 * Run with: node tests/test-numbered-prefixes.js
 */

console.log('Running numbered prefix route resolution tests...\n');

// Re-implement the core helpers locally for isolated unit testing
function findMatchingRoute(routesPaths, tail) {
  const normalized = tail.toLowerCase().replace(/\/+$/, '');
  if (!normalized) return undefined;
  const matches = routesPaths.filter(route => {
    const r = route.toLowerCase().replace(/\/+$/, '');
    return r === `/${normalized}` || r.endsWith(`/${normalized}`);
  });
  if (matches.length <= 1) return matches[0];
  return matches.sort((a, b) => a.length - b.length)[0];
}

// Mirrors src/processor.ts — Docusaurus's DefaultNumberPrefixParser semantics:
// separator is one-or-more of [-_.], and version/date-like remainders are left
// intact (so "03--1.6.X" → "1.6.X" but "7.0-foo" stays "7.0-foo").
const IGNORED_NUMBER_PREFIX_PATTERN = /^\d+[-_.]\d+/;
const NUMBER_PREFIX_PATTERN = /^(\d+)\s*[-_.]+\s*([^-_.\s].*)$/;

function stripNumberPrefix(segment) {
  if (IGNORED_NUMBER_PREFIX_PATTERN.test(segment)) {
    return segment;
  }
  const match = NUMBER_PREFIX_PATTERN.exec(segment);
  return match ? match[2] : segment;
}

function removeNumberedPrefixes(pathStr) {
  return pathStr.split('/').map(stripNumberPrefix).join('/');
}

function resolveWithCandidates(routesPaths, tail) {
  const tails = new Set([tail]);
  const stripped = removeNumberedPrefixes(tail);
  if (stripped !== tail) tails.add(stripped);

  for (const t of tails) {
    const match = findMatchingRoute(routesPaths, t);
    if (match) return match;
  }
  return undefined;
}

// Test 1: Exact match with numbered prefix in routesPaths
function testExactMatchWithNumberedPrefix() {
  console.log('Test 1: Exact match when route retains numbered prefix');

  const routesPaths = ['/docs/01-intro', '/docs/guide/01-start'];

  const resolved1 = findMatchingRoute(routesPaths, '01-intro');
  console.log(resolved1 === '/docs/01-intro'
    ? '  ✅ PASS: Matched "01-intro" to "/docs/01-intro"'
    : `  ❌ FAIL: Expected "/docs/01-intro", got "${resolved1}"`);

  const resolved2 = findMatchingRoute(routesPaths, 'guide/01-start');
  console.log(resolved2 === '/docs/guide/01-start'
    ? '  ✅ PASS: Matched "guide/01-start" to "/docs/guide/01-start"'
    : `  ❌ FAIL: Expected "/docs/guide/01-start", got "${resolved2}"`);

  console.log('');
}

// Test 2: Fallback to prefix removal when exact match not found
function testFallbackToPrefixRemoval() {
  console.log('Test 2: Fallback to prefix removal when exact match not found');

  const routesPaths = ['/docs/intro', '/docs/guide/start'];

  const resolved1 = resolveWithCandidates(routesPaths, '01-intro');
  console.log(resolved1 === '/docs/intro'
    ? '  ✅ PASS: "01-intro" fell back to "/docs/intro" via prefix removal'
    : `  ❌ FAIL: Expected "/docs/intro", got "${resolved1}"`);

  const resolved2 = resolveWithCandidates(routesPaths, '01-guide/01-start');
  console.log(resolved2 === '/docs/guide/start'
    ? '  ✅ PASS: "01-guide/01-start" fell back to "/docs/guide/start"'
    : `  ❌ FAIL: Expected "/docs/guide/start", got "${resolved2}"`);

  console.log('');
}

// Test 3: Exact match takes precedence over prefix removal
function testExactMatchPrecedence() {
  console.log('Test 3: Exact match takes precedence over prefix removal');

  const routesPaths = ['/docs/01-intro', '/docs/intro'];

  // The original tail "01-intro" matches first, before stripping
  const resolved = resolveWithCandidates(routesPaths, '01-intro');
  console.log(resolved === '/docs/01-intro'
    ? '  ✅ PASS: Exact match "/docs/01-intro" preferred over stripped "/docs/intro"'
    : `  ❌ FAIL: Expected "/docs/01-intro", got "${resolved}"`);

  console.log('');
}

// Test 4: Complex nested numbered folders
function testComplexNestedNumberedFolders() {
  console.log('Test 4: Complex nested numbered folders');

  const routesPaths = [
    '/docs/guide/tutorials/advanced',
    '/docs/guide/tutorials',
  ];

  const resolved1 = resolveWithCandidates(routesPaths, '01-guide/02-tutorials/03-advanced');
  console.log(resolved1 === '/docs/guide/tutorials/advanced'
    ? '  ✅ PASS: Three-level nested numbered folders resolved'
    : `  ❌ FAIL: Expected "/docs/guide/tutorials/advanced", got "${resolved1}"`);

  const resolved2 = resolveWithCandidates(routesPaths, '01-guide/02-tutorials');
  console.log(resolved2 === '/docs/guide/tutorials'
    ? '  ✅ PASS: Two-level nested numbered folders resolved'
    : `  ❌ FAIL: Expected "/docs/guide/tutorials", got "${resolved2}"`);

  console.log('');
}

// Test 5: Mixed numbered and non-numbered segments
function testMixedNumberedSegments() {
  console.log('Test 5: Mixed numbered and non-numbered segments');

  const routesPaths = ['/docs/api/getting-started', '/docs/guide/reference'];

  const resolved1 = resolveWithCandidates(routesPaths, 'api/01-getting-started');
  console.log(resolved1 === '/docs/api/getting-started'
    ? '  ✅ PASS: Non-numbered folder with numbered file resolved'
    : `  ❌ FAIL: Expected "/docs/api/getting-started", got "${resolved1}"`);

  const resolved2 = resolveWithCandidates(routesPaths, '01-guide/reference');
  console.log(resolved2 === '/docs/guide/reference'
    ? '  ✅ PASS: Numbered folder with non-numbered file resolved'
    : `  ❌ FAIL: Expected "/docs/guide/reference", got "${resolved2}"`);

  console.log('');
}

// Test 6: Trailing slash handling
function testTrailingSlashHandling() {
  console.log('Test 6: Trailing slash handling');

  const routesPaths = ['/docs/intro/', '/docs/guide/'];

  const resolved1 = findMatchingRoute(routesPaths, 'intro');
  console.log(resolved1 === '/docs/intro/'
    ? '  ✅ PASS: Matched route with trailing slash'
    : `  ❌ FAIL: Expected "/docs/intro/", got "${resolved1}"`);

  const resolved2 = findMatchingRoute(routesPaths, 'guide/');
  console.log(resolved2 === '/docs/guide/'
    ? '  ✅ PASS: Matched tail with trailing slash to route with trailing slash'
    : `  ❌ FAIL: Expected "/docs/guide/", got "${resolved2}"`);

  console.log('');
}

// Test 7: Shortest match when multiple routes exist (versioned docs)
function testShortestMatchPreference() {
  console.log('Test 7: Shortest match preferred (stable over versioned)');

  const routesPaths = ['/intro', '/nightly/intro', '/v2/intro'];

  const resolved = findMatchingRoute(routesPaths, 'intro');
  console.log(resolved === '/intro'
    ? '  ✅ PASS: Shortest route "/intro" preferred over versioned'
    : `  ❌ FAIL: Expected "/intro", got "${resolved}"`);

  console.log('');
}

// Test 8: Compound ordering prefix on version-like folder names
function testCompoundNumberPrefix() {
  console.log('Test 8: Compound ordering prefix on version-like folder names');

  const routesPaths = ['/docs/1.6.X/intro', '/docs/1.6.2/notes'];

  // "03--1.6.X" = ordering prefix "03-" + literal "-1.6.X"; both dashes are the
  // separator, so the clean name is "1.6.X" (matching Docusaurus's route).
  const resolved1 = resolveWithCandidates(routesPaths, '03--1.6.X/intro');
  console.log(resolved1 === '/docs/1.6.X/intro'
    ? '  ✅ PASS: "03--1.6.X/intro" resolved to "/docs/1.6.X/intro"'
    : `  ❌ FAIL: Expected "/docs/1.6.X/intro", got "${resolved1}"`);

  const resolved2 = resolveWithCandidates(routesPaths, '01--1.6.2/notes');
  console.log(resolved2 === '/docs/1.6.2/notes'
    ? '  ✅ PASS: "01--1.6.2/notes" resolved to "/docs/1.6.2/notes"'
    : `  ❌ FAIL: Expected "/docs/1.6.2/notes", got "${resolved2}"`);

  // "7.0-foo" is a version-like name with no separate ordering prefix, so the
  // ignored-prefix rule keeps it intact.
  const kept = stripNumberPrefix('7.0-foo');
  console.log(kept === '7.0-foo'
    ? '  ✅ PASS: version-like "7.0-foo" preserved (not stripped)'
    : `  ❌ FAIL: Expected "7.0-foo", got "${kept}"`);

  console.log('');
}

function runAllTests() {
  console.log('='.repeat(70));
  console.log('Testing suffix-based numbered prefix route resolution');
  console.log('='.repeat(70));
  console.log('');

  testExactMatchWithNumberedPrefix();
  testFallbackToPrefixRemoval();
  testExactMatchPrecedence();
  testComplexNestedNumberedFolders();
  testMixedNumberedSegments();
  testTrailingSlashHandling();
  testShortestMatchPreference();
  testCompoundNumberPrefix();

  console.log('='.repeat(70));
  console.log('All numbered prefix tests completed!');
  console.log('='.repeat(70));
}

runAllTests();
