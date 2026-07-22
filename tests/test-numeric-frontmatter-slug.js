/**
 * Integration tests: unquoted numeric frontmatter `slug`/`id` must still drive
 * the generated .md path and route.
 *
 * YAML parses an unquoted `slug: 2025` as the number 2025 (not the string
 * "2025"). Docusaurus coerces it to a string for routing, so the real route is
 * /2025 — but the plugin's string guards used to reject the number, dropping the
 * slug and writing the file under the wrong name (id/filename fallback), so the
 * `.md` 404'd at its actual URL. Numeric values are now coerced to strings
 * before those guards; quoting the value must keep working unchanged.
 *
 * Run with: node tests/test-numeric-frontmatter-slug.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const plugin = require('../lib/index').default;

console.log('Testing numeric frontmatter slug/id coercion...\n');

let passedTests = 0;
let failedTests = 0;

function pass(name) {
  console.log(`  PASS: ${name}`);
  passedTests++;
}

function fail(name, reason) {
  console.log(`  FAIL: ${name}`);
  console.log(`     ${reason}`);
  failedTests++;
}

function page(title, body, frontMatter = {}) {
  const fm = Object.entries(frontMatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const header = fm ? `${fm}\n` : '';
  return `---\ntitle: ${title}\ndescription: ${title} page.\n${header}---\n\n# ${title}\n\n${body}`;
}

function makeMockContext(tmpDir, outDir) {
  return {
    siteDir: tmpDir,
    siteConfig: {
      title: 'Test Site',
      tagline: 'Testing numeric slug',
      url: 'https://example.com',
      baseUrl: '/',
    },
    outDir,
  };
}

function makeSite() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-numslug-'));
  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  return { tmpDir, outDir };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(e => e.isDirectory()
      ? walk(path.join(dir, e.name))
      : [path.join(dir, e.name)]);
}

// Test 1: unquoted numeric slug resolves to its numeric route and file name.
async function testNumericSlug() {
  const name = 'unquoted numeric slug (2025) → 2025.md at /2025';
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    // File named recap.md but routed at /2025 via an unquoted numeric slug.
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'recap.md'),
      page('Year in review', 'Body.', { slug: 2025 })
    );

    const p = plugin(makeMockContext(tmpDir, outDir), {
      generateLLMsFullTxt: false,
      generateMarkdownFiles: true,
      docsDir: 'docs',
    });
    await p.postBuild({ routesPaths: ['/2025'] });

    const files = walk(outDir).map(f => path.relative(outDir, f).split(path.sep).join('/'));
    const llms = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');

    assert.ok(files.includes('2025.md'), `expected 2025.md; got ${files.join(', ')}`);
    assert.ok(
      llms.includes('https://example.com/2025.md'),
      'document should be linked at its numeric-slug route /2025.md'
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 2: unquoted numeric id drives the filename when no slug is present.
async function testNumericId() {
  const name = 'unquoted numeric id (2025) → 2025.md at /2025';
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'legacy.md'),
      page('Legacy', 'Body.', { id: 2025 })
    );

    const p = plugin(makeMockContext(tmpDir, outDir), {
      generateLLMsFullTxt: false,
      generateMarkdownFiles: true,
      docsDir: 'docs',
    });
    await p.postBuild({ routesPaths: ['/2025'] });

    const files = walk(outDir).map(f => path.relative(outDir, f).split(path.sep).join('/'));
    const llms = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');

    assert.ok(files.includes('2025.md'), `expected 2025.md; got ${files.join(', ')}`);
    assert.ok(
      llms.includes('https://example.com/2025.md'),
      'document should be linked at its numeric-id route /2025.md'
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 3: quoting the numeric slug keeps working (no regression).
async function testQuotedNumericSlug() {
  const name = 'quoted numeric slug ("2025") still → 2025.md';
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'recap.md'),
      page('Year in review', 'Body.', { slug: '"2025"' })
    );

    const p = plugin(makeMockContext(tmpDir, outDir), {
      generateLLMsFullTxt: false,
      generateMarkdownFiles: true,
      docsDir: 'docs',
    });
    await p.postBuild({ routesPaths: ['/2025'] });

    const files = walk(outDir).map(f => path.relative(outDir, f).split(path.sep).join('/'));
    assert.ok(files.includes('2025.md'), `expected 2025.md; got ${files.join(', ')}`);

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

async function main() {
  await testNumericSlug();
  await testNumericId();
  await testQuotedNumericSlug();

  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${passedTests}/${passedTests + failedTests} passed, ${failedTests} failed`);
  console.log('='.repeat(50));

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
