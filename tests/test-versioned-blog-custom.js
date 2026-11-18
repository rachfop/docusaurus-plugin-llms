/**
 * Integration tests for blog posts in multi-version sites.
 *
 * Blog posts aren't versioned: their routes carry no version prefix, so every
 * version's custom LLM files can match them, while the standard files and the
 * markdown copies stay at the site root.
 *
 * Run with: node tests/test-versioned-blog-custom.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const pluginModule = require('../lib/index');
const plugin = pluginModule.default;

console.log('Testing blog posts with versions...\n');

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

// Routes for a two-version site with a blog at /releases/.
const ROUTES = [
  '/',
  '/get-started',
  '/stable',
  '/stable/get-started',
  '/releases',
  '/releases/v1',
  '/releases/v2',
];

const VERSIONS = [
  { name: 'nightly', label: 'Nightly', docsDir: 'docs', path: '' },
  { name: 'stable', label: 'Stable', docsDir: 'stable-docs', path: 'stable' },
];

const RELEASES_FILE = {
  filename: 'releases-llms.txt',
  title: 'Releases',
  description: 'Release notes.',
  includePatterns: ['releases/*.md'],
  fullContent: false,
  includeUnmatchedLast: false,
};

function makeSite({ markdownFiles = false } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-blog-'));
  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  for (const dir of ['docs', 'stable-docs', 'releases']) {
    fs.mkdirSync(path.join(tmpDir, dir), { recursive: true });
  }
  fs.writeFileSync(path.join(tmpDir, 'docs', 'get-started.md'), page('Get Started', 'Nightly.'));
  fs.writeFileSync(
    path.join(tmpDir, 'stable-docs', 'get-started.md'),
    page('Get Started', 'Stable.'),
  );
  fs.writeFileSync(path.join(tmpDir, 'releases', 'v1.md'), page('v1 release', 'v1 body.'));
  fs.writeFileSync(path.join(tmpDir, 'releases', 'v2.md'), page('v2 release', 'v2 body.'));

  const p = plugin(
    {
      siteDir: tmpDir,
      siteConfig: {
        title: 'Test Site',
        tagline: 'Testing versions',
        url: 'https://example.com',
        baseUrl: '/',
      },
      outDir,
    },
    {
      generateLLMsFullTxt: false,
      generateMarkdownFiles: markdownFiles,
      includeBlog: true,
      blogDir: 'releases',
      blogRouteBasePath: 'releases',
      customLLMFiles: [RELEASES_FILE],
      versions: VERSIONS,
    },
  );

  return { tmpDir, outDir, p };
}

// Test 1: the blog-backed custom file is written for every version
async function testCustomFileInEveryVersion() {
  const name = 'A blog-backed custom file is written for every version';
  const { tmpDir, outDir, p } = makeSite();
  try {
    await p.postBuild({ routesPaths: ROUTES });

    const rootFile = path.join(outDir, 'releases-llms.txt');
    const stableFile = path.join(outDir, 'stable', 'releases-llms.txt');
    assert.ok(fs.existsSync(rootFile), 'root version should write releases-llms.txt');
    assert.ok(fs.existsSync(stableFile), 'stable version should write releases-llms.txt');

    const root = fs.readFileSync(rootFile, 'utf8');
    const stable = fs.readFileSync(stableFile, 'utf8');
    assert.ok(root.includes('https://example.com/releases/v1'), 'root lists the first post');
    assert.ok(root.includes('https://example.com/releases/v2'), 'root lists the second post');
    assert.ok(stable.includes('https://example.com/releases/v1'), 'stable lists the first post');
    assert.ok(stable.includes('https://example.com/releases/v2'), 'stable lists the second post');
    assert.ok(
      !stable.includes('/stable/releases/'),
      'stable links stay canonical: blog routes carry no version prefix',
    );
    assert.ok(stable.includes('Version: Stable'), 'the custom file keeps the version label');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Test 2: individual markdown for blog posts lands at the site root only
async function testBlogMarkdownAtSiteRoot() {
  const name = 'Blog markdown files are written once, at the site root';
  const { tmpDir, outDir, p } = makeSite({ markdownFiles: true });
  try {
    await p.postBuild({ routesPaths: ROUTES });

    assert.ok(
      fs.existsSync(path.join(outDir, 'releases', 'v1.md')),
      'the root version writes the post markdown file',
    );
    assert.ok(
      !fs.existsSync(path.join(outDir, 'stable', 'releases')),
      'a prefixed version writes no blog markdown inside its own directory',
    );

    const stable = fs.readFileSync(path.join(outDir, 'stable', 'releases-llms.txt'), 'utf8');
    assert.ok(
      stable.includes('https://example.com/releases/v1.md'),
      'stable links the canonical markdown file',
    );
    assert.ok(!stable.includes('/stable/releases/'), 'stable links carry no version prefix');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Test 3: llms.txt keeps the documented link scope per version
async function testStandardFilesKeepVersionScope() {
  const name = "Blog posts stay out of a prefixed version's llms.txt";
  const { tmpDir, outDir, p } = makeSite();
  try {
    await p.postBuild({ routesPaths: ROUTES });

    const root = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    const stable = fs.readFileSync(path.join(outDir, 'stable', 'llms.txt'), 'utf8');
    assert.ok(root.includes('/releases/v1'), 'the root index lists blog posts');
    assert.ok(!stable.includes('/releases/'), 'the stable index links only to /stable/ routes');
    assert.ok(stable.includes('/stable/get-started'), 'the stable index still lists its docs');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  await testCustomFileInEveryVersion();
  await testBlogMarkdownAtSiteRoot();
  await testStandardFilesKeepVersionScope();

  console.log('\n' + '='.repeat(50));
  console.log(
    `Test Results: ${passedTests}/${passedTests + failedTests} passed, ${failedTests} failed`,
  );
  console.log('='.repeat(50));

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
