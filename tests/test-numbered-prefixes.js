/**
 * Unit tests for numbered prefix route resolution
 *
 * Tests that the suffix-based matching correctly handles files and folders
 * with numbered prefixes (e.g. "01-intro.md", "02-guide/"), through the real
 * processFilesWithPatterns route resolution.
 *
 * Run with: node tests/test-numbered-prefixes.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { processFilesWithPatterns } = require('../lib/processor');

let passed = 0;
let failed = 0;
const tempDirs = [];

/**
 * Write `files` (paths relative to docs/) into a temp site, resolve them
 * against `routesPaths`, and return each file's URL path keyed by its
 * docs-relative path.
 */
async function resolveUrls(files, routesPaths) {
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-numbered-prefixes-'));
  tempDirs.push(siteDir);
  const filePaths = files.map((rel) => {
    const file = path.join(siteDir, 'docs', rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `---\ntitle: ${rel}\n---\n\nBody of ${rel}.\n`);
    return file;
  });
  const context = {
    siteDir,
    siteUrl: 'https://example.com',
    docsDir: 'docs',
    options: {},
    routesPaths,
  };
  const docs = await processFilesWithPatterns(context, filePaths);
  return Object.fromEntries(
    docs.map((doc) => [doc.title, doc.url.replace('https://example.com', '')]),
  );
}

async function check(name, files, routesPaths, expected) {
  const actual = await resolveUrls(files, routesPaths);
  const ok = Object.entries(expected).every(([file, url]) => actual[file] === url);
  if (ok) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${name}`);
    console.log(`     expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('Running numbered prefix route resolution tests...\n');

  await check(
    'Route that keeps the numbered prefix matches it',
    ['01-intro.md', 'guide/01-start.md'],
    ['/docs/01-intro', '/docs/guide/01-start'],
    { '01-intro.md': '/docs/01-intro', 'guide/01-start.md': '/docs/guide/01-start' },
  );

  await check(
    'Numbered prefixes are stripped when no route keeps them',
    ['01-intro.md', '01-guide/01-start.md'],
    ['/docs/intro', '/docs/guide/start'],
    { '01-intro.md': '/docs/intro', '01-guide/01-start.md': '/docs/guide/start' },
  );

  await check(
    'The unstripped tail is matched before the stripped one',
    ['01-intro.md'],
    ['/docs/01-intro', '/docs/intro'],
    { '01-intro.md': '/docs/01-intro' },
  );

  await check(
    'Nested numbered folders resolve',
    ['01-guide/02-tutorials/03-advanced.md', '01-guide/02-tutorials/index.md'],
    ['/docs/guide/tutorials/advanced', '/docs/guide/tutorials'],
    {
      '01-guide/02-tutorials/03-advanced.md': '/docs/guide/tutorials/advanced',
      '01-guide/02-tutorials/index.md': '/docs/guide/tutorials',
    },
  );

  await check(
    'Mixed numbered and plain segments resolve',
    ['api/01-getting-started.md', '01-guide/reference.md'],
    ['/docs/api/getting-started', '/docs/guide/reference'],
    {
      'api/01-getting-started.md': '/docs/api/getting-started',
      '01-guide/reference.md': '/docs/guide/reference',
    },
  );

  await check(
    'Routes with a trailing slash match',
    ['01-intro.md'],
    ['/docs/intro/', '/docs/guide/'],
    { '01-intro.md': '/docs/intro/' },
  );

  await check(
    'The shortest matching route is preferred',
    ['intro.md'],
    ['/docs/intro', '/docs/nightly/intro', '/docs/v2/intro'],
    { 'intro.md': '/docs/intro' },
  );

  // "03--1.6.X" is ordering prefix "03-" plus "-1.6.X"; Docusaurus's
  // DefaultNumberPrefixParser treats both dashes as the separator.
  await check(
    'Compound ordering prefixes on version-like folders resolve',
    ['03--1.6.X/intro.md', '01--1.6.2/notes.md', '7.0-foo/page.md'],
    ['/docs/1.6.X/intro', '/docs/1.6.2/notes', '/docs/7.0-foo/page'],
    {
      '03--1.6.X/intro.md': '/docs/1.6.X/intro',
      '01--1.6.2/notes.md': '/docs/1.6.2/notes',
      '7.0-foo/page.md': '/docs/7.0-foo/page',
    },
  );

  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runAllTests().catch((err) => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
