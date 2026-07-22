/**
 * Integration tests: explicit frontmatter slug/id must win over the
 * filename-tail heuristic in resolveDocumentUrl.
 *
 * A document declaring `slug: "/"` marks a section's root page. Its bare
 * filename tail (e.g. "intro" from intro.md) can coincidentally end with the
 * same segment as an unrelated nested route (e.g. /some-section/intro). When
 * the filename heuristic ran first, the root document silently stole that
 * unrelated route: it never got its `/` (index.md) output or its llms.txt
 * entry, and the unrelated document was pushed to a suffixed path.
 *
 * These tests drive the plugin end-to-end (postBuild) and assert the root
 * document resolves to `/` while the unrelated document keeps its own route.
 *
 * Run with: node tests/test-frontmatter-slug-priority.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const plugin = require('../lib/index').default;

console.log('Testing frontmatter slug/id priority over filename heuristic...\n');

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
      tagline: 'Testing slug priority',
      url: 'https://example.com',
      baseUrl: '/',
    },
    outDir,
  };
}

function makeSite() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-slug-'));
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

// Test 1: slug: "/" root page resolves to `/` instead of stealing /some-section/intro
async function testRootSlugWins() {
  const name = 'slug: "/" resolves to root, not a coincidental /intro route';
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'some-section'), { recursive: true });
    // Root page: bare filename tail "intro", but declares slug: "/".
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'intro.md'),
      page('Home', 'Root body.', { slug: '"/"' })
    );
    // Unrelated nested page whose real route ends with /intro.
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'some-section', 'intro.md'),
      page('Section Intro', 'Section body.')
    );

    const p = plugin(makeMockContext(tmpDir, outDir), {
      generateLLMsFullTxt: false,
      generateMarkdownFiles: true,
      // Docs served at the site root (routeBasePath '/'), so slug: "/" means the
      // literal site root.
      docsDir: [{ path: 'docs', routeBasePath: '/' }],
    });
    // Real Docusaurus routes: root page at "/", nested page at "/some-section/intro".
    await p.postBuild({ routesPaths: ['/', '/some-section/intro'] });

    const llms = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    const files = walk(outDir).map(f => path.relative(outDir, f).split(path.sep).join('/'));

    // Root page got its index.md and the nested page kept its own path — no
    // suffixed duplicate (e.g. some-section/intro-2.md) was needed.
    assert.ok(files.includes('index.md'), `root page should produce index.md; got ${files.join(', ')}`);
    assert.ok(
      files.includes('some-section/intro.md'),
      `nested page should keep some-section/intro.md; got ${files.join(', ')}`
    );
    assert.ok(
      !files.some(f => /intro-\d+\.md$/.test(f)),
      `no suffixed duplicate should exist; got ${files.join(', ')}`
    );

    // Both documents are linked, each to its own route.
    assert.ok(
      llms.includes('https://example.com/index.md'),
      'root page should be linked at the site root (index.md)'
    );
    assert.ok(
      llms.includes('https://example.com/some-section/intro.md'),
      'nested page should be linked at /some-section/intro.md'
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 2: explicit non-root slug wins over a coincidental filename match
async function testExplicitSlugWins() {
  const name = 'explicit slug resolves directly, not via filename suffix guess';
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'guide'), { recursive: true });
    // File named legacy-name.md but routed at /guide/real-name via slug.
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'guide', 'legacy-name.md'),
      page('Real Name', 'Body.', { slug: 'real-name' })
    );

    const p = plugin(makeMockContext(tmpDir, outDir), {
      generateLLMsFullTxt: false,
      generateMarkdownFiles: true,
      docsDir: 'docs',
    });
    await p.postBuild({ routesPaths: ['/guide/real-name'] });

    const llms = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    assert.ok(
      llms.includes('https://example.com/guide/real-name.md'),
      'document should resolve to its slug-declared route /guide/real-name'
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 3: documents without slug/id still resolve via the filename heuristic
async function testNoOverrideUnaffected() {
  const name = 'documents without slug/id still resolve via filename heuristic';
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'get-started.md'),
      page('Get Started', 'Body.')
    );

    const p = plugin(makeMockContext(tmpDir, outDir), {
      generateLLMsFullTxt: false,
      generateMarkdownFiles: true,
      docsDir: 'docs',
    });
    await p.postBuild({ routesPaths: ['/get-started'] });

    const llms = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    assert.ok(
      llms.includes('https://example.com/get-started.md'),
      'plain document should still resolve via its filename tail'
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

async function main() {
  await testRootSlugWins();
  await testExplicitSlugWins();
  await testNoOverrideUnaffected();

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
