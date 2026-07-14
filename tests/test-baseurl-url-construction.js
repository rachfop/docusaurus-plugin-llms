/**
 * Tests for full URL construction in processMarkdownFile, focused on baseUrl
 * handling (issue #43): the site's baseUrl pathname must survive both the
 * resolved-route path and the fallback path, and a trailing slash on the
 * docsDir/pathPrefix must not produce doubled slashes or a dropped prefix.
 *
 * Run with: node test-baseurl-url-construction.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { processMarkdownFile } = require('../lib/processor');

let passed = 0;
let failed = 0;

function makeDoc(dir, relPath, body = '# Title\n\nSome content.\n') {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
  return full;
}

async function check(name, { relPath, siteUrl, pathPrefix, resolvedUrl }, expectedUrl) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-baseurl-'));
  try {
    const filePath = makeDoc(tmpDir, relPath);
    const doc = await processMarkdownFile(
      filePath,
      tmpDir,
      siteUrl,
      pathPrefix,
      undefined,   // pathTransformation
      false,       // excludeImports
      false,       // removeDuplicateHeadings
      resolvedUrl
    );
    assert.strictEqual(doc.url, expectedUrl);
    assert.ok(!/([^:])\/\//.test(doc.url), `URL should not contain doubled slashes: ${doc.url}`);
    console.log(`✅ PASS: ${name}\n   ${doc.url}`);
    passed++;
  } catch (err) {
    console.log(`❌ FAIL: ${name}\n   ${err.message}`);
    failed++;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function run() {
  console.log('Testing baseUrl-aware URL construction...\n');

  // --- Resolved-route path (Docusaurus routesPaths available) ---

  // Subpath baseUrl, route is baseUrl-relative → baseUrl must be prepended (#43.3)
  await check('resolved route, subpath baseUrl, route without prefix', {
    relPath: 'docs/explainers/foo.md',
    siteUrl: 'https://noir-lang.org/docs',
    pathPrefix: 'docs',
    resolvedUrl: '/explainers/foo',
  }, 'https://noir-lang.org/docs/explainers/foo');

  // Same, but route already carries baseUrl → must NOT be duplicated
  await check('resolved route, subpath baseUrl, route already prefixed', {
    relPath: 'docs/explainers/foo.md',
    siteUrl: 'https://noir-lang.org/docs',
    pathPrefix: 'docs',
    resolvedUrl: '/docs/explainers/foo',
  }, 'https://noir-lang.org/docs/explainers/foo');

  // Root baseUrl → unchanged behaviour
  await check('resolved route, root baseUrl', {
    relPath: 'docs/intro.md',
    siteUrl: 'https://tunit.dev/',
    pathPrefix: 'docs',
    resolvedUrl: '/docs/intro',
  }, 'https://tunit.dev/docs/intro');

  // --- Fallback path (no resolvedUrl) ---

  // Subpath baseUrl must be preserved (#43.2 — previously dropped by .origin)
  await check('fallback, subpath baseUrl preserved', {
    relPath: 'docs/guide.md',
    siteUrl: 'https://example.com/base',
    pathPrefix: 'docs',
    resolvedUrl: undefined,
  }, 'https://example.com/base/docs/guide');

  // Trailing slash on pathPrefix must not break stripping or double the slash (#43.1)
  await check('fallback, trailing-slash pathPrefix', {
    relPath: 'docs/guide.md',
    siteUrl: 'https://example.com/base',
    pathPrefix: 'docs/',
    resolvedUrl: undefined,
  }, 'https://example.com/base/docs/guide');

  // Root baseUrl fallback → unchanged behaviour
  await check('fallback, root baseUrl', {
    relPath: 'docs/guide.md',
    siteUrl: 'https://example.com/',
    pathPrefix: 'docs',
    resolvedUrl: undefined,
  }, 'https://example.com/docs/guide');

  console.log(`\n========================================`);
  console.log(`baseUrl URL Construction Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);
  return failed === 0;
}

run()
  .then(ok => {
    console.log(ok ? '🎉 All baseUrl URL construction tests passed!' : '❌ Some tests failed.');
    process.exit(ok ? 0 : 1);
  })
  .catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
