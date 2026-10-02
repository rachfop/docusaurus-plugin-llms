/**
 * Integration tests: with several docsDir sections, each doc's URL is resolved
 * only against routes under its own section's routeBasePath. The scoping
 * prefix is built from the version prefix (empty on unversioned sites), the
 * section's routeBasePath, and the site's baseUrl, which Docusaurus includes
 * in routesPaths.
 *
 * When no route matches the scope, the doc falls back to a file-name URL, which
 * for README/index files names a page that doesn't exist (/other/README
 * instead of /other/).
 *
 * Run with: node tests/test-multi-section-route-scoping.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const plugin = require('../lib/index').default;

console.log('Testing multi-section route scoping...\n');

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

function page(title, body) {
  return `---\ntitle: ${title}\ndescription: ${title} page.\n---\n\n# ${title}\n\n${body}`;
}

function makeMockContext(tmpDir, outDir, baseUrl) {
  return {
    siteDir: tmpDir,
    siteConfig: {
      title: 'Test Site',
      tagline: 'Testing multi-section route scoping',
      url: 'https://example.com',
      baseUrl,
    },
    outDir,
  };
}

function makeSite() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-section-scope-'));
  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  return { tmpDir, outDir };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function writeDoc(tmpDir, relPath, title) {
  const abs = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, page(title, `${title} body.`));
}

/**
 * Two sections — docs at '/' and other-docs at 'other' — each holding a faq.md,
 * plus README index files in other-docs. `prefix` is the site's baseUrl
 * without its trailing slash ('' for root), which Docusaurus prepends to
 * every route.
 */
async function generateTwoSectionSite(baseUrl, prefix) {
  const { tmpDir, outDir } = makeSite();
  writeDoc(tmpDir, 'docs/intro.md', 'Intro');
  writeDoc(tmpDir, 'docs/faq.md', 'Docs FAQ');
  writeDoc(tmpDir, 'other-docs/README.md', 'Other');
  writeDoc(tmpDir, 'other-docs/guide/README.md', 'Guide');
  writeDoc(tmpDir, 'other-docs/faq.md', 'Other FAQ');

  const p = plugin(makeMockContext(tmpDir, outDir, baseUrl), {
    generateLLMsFullTxt: false,
    docsDir: [
      { path: 'docs', routeBasePath: '/' },
      { path: 'other-docs', routeBasePath: 'other' },
    ],
  });
  await p.postBuild({
    routesPaths: [
      `${prefix}/intro`,
      `${prefix}/faq`,
      `${prefix}/other/`,
      `${prefix}/other/guide/`,
      `${prefix}/other/faq`,
    ],
  });

  return { llms: fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8'), tmpDir };
}

async function testTwoSectionSite(baseUrl, prefix) {
  const name = `unversioned sections resolve to their own routes (baseUrl '${baseUrl}')`;
  let tmpDir;
  try {
    const result = await generateTwoSectionSite(baseUrl, prefix);
    tmpDir = result.tmpDir;
    const { llms } = result;
    const site = `https://example.com${prefix}`;

    assert.ok(llms.includes(`[Other](${site}/other/)`), `expected Other at ${site}/other/; got:\n${llms}`);
    assert.ok(llms.includes(`[Guide](${site}/other/guide/)`), `expected Guide at ${site}/other/guide/; got:\n${llms}`);
    assert.ok(llms.includes(`[Other FAQ](${site}/other/faq)`), `expected Other FAQ at ${site}/other/faq; got:\n${llms}`);
    assert.ok(llms.includes(`[Docs FAQ](${site}/faq)`), `expected Docs FAQ at ${site}/faq; got:\n${llms}`);
    assert.ok(!/README/.test(llms), `no URL should carry a README segment; got:\n${llms}`);

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
}

// Version prefixes are relative to the baseUrl, like routeBasePaths.
async function testVersionedSiteWithBaseUrl() {
  const name = "versioned sections resolve to their own routes (baseUrl '/sub/')";
  const { tmpDir, outDir } = makeSite();
  try {
    writeDoc(tmpDir, 'docs/get-started.md', 'Get Started');
    writeDoc(tmpDir, 'stable-docs/get-started.md', 'Get Started');

    const p = plugin(makeMockContext(tmpDir, outDir, '/sub/'), {
      generateLLMsFullTxt: false,
      versions: [
        { name: 'nightly', label: 'Nightly', docsDir: 'docs', path: '' },
        { name: 'v1', label: 'v1', docsDir: 'stable-docs', path: 'stable' },
      ],
    });
    await p.postBuild({
      routesPaths: ['/sub/', '/sub/get-started', '/sub/stable', '/sub/stable/get-started'],
    });

    const root = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    const stable = fs.readFileSync(path.join(outDir, 'stable', 'llms.txt'), 'utf8');

    assert.ok(
      root.includes('](https://example.com/sub/get-started)'),
      `root should link to /sub/get-started; got:\n${root}`
    );
    assert.ok(!root.includes('/stable/'), `root links should not leak into /stable/; got:\n${root}`);
    assert.ok(
      stable.includes('](https://example.com/sub/stable/get-started)'),
      `stable should link to /sub/stable/get-started; got:\n${stable}`
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// blogRouteBasePath is relative to the baseUrl. The post's slug also names a
// docs route, so only scoping to the blog's routes picks the right one.
async function testBlogWithBaseUrl() {
  const name = "blog posts resolve to blog routes (baseUrl '/sub/')";
  const { tmpDir, outDir } = makeSite();
  try {
    writeDoc(tmpDir, 'docs/welcome.md', 'Docs Welcome');
    const postPath = path.join(tmpDir, 'blog', 'hello.md');
    fs.mkdirSync(path.dirname(postPath), { recursive: true });
    fs.writeFileSync(
      postPath,
      '---\ntitle: Blog Welcome\ndescription: Blog Welcome page.\nslug: welcome\n---\n\n# Blog Welcome\n\nBlog body.'
    );

    const p = plugin(makeMockContext(tmpDir, outDir, '/sub/'), {
      generateLLMsFullTxt: false,
      includeBlog: true,
    });
    await p.postBuild({
      routesPaths: ['/sub/welcome', '/sub/blog/welcome'],
    });

    const llms = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    assert.ok(
      llms.includes('[Blog Welcome](https://example.com/sub/blog/welcome)'),
      `expected Blog Welcome at /sub/blog/welcome; got:\n${llms}`
    );
    assert.ok(
      llms.includes('[Docs Welcome](https://example.com/sub/welcome)'),
      `expected Docs Welcome at /sub/welcome; got:\n${llms}`
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

async function run() {
  await testTwoSectionSite('/', '');
  await testTwoSectionSite('/sub/', '/sub');
  await testVersionedSiteWithBaseUrl();
  await testBlogWithBaseUrl();

  console.log(`\n${passedTests} passed, ${failedTests} failed`);
  if (failedTests > 0) process.exit(1);
}

run();
