/**
 * Integration tests for multi-version support (the `versions` option).
 *
 * Covers explicit version arrays, `versions: 'auto'` detection, version-scoped
 * output paths and links, backward compatibility, and validation.
 *
 * Run with: node tests/test-multi-version.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const pluginModule = require('../lib/index');
const plugin = pluginModule.default;

console.log('Testing multi-version support...\n');

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

function makeMockContext(tmpDir, outDir, siteConfig = {}) {
  return {
    siteDir: tmpDir,
    siteConfig: {
      title: 'Test Site',
      tagline: 'Testing versions',
      url: 'https://example.com',
      baseUrl: '/',
      ...siteConfig,
    },
    outDir,
  };
}

function makeSite() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-ver-'));
  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  return { tmpDir, outDir };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Routes for a site whose single "get-started" page exists in both the current
// and the stable version.
const ROUTES = ['/', '/get-started', '/stable', '/stable/get-started'];

// Test 1: Explicit versions array writes to per-version subdirs with scoped links
async function testExplicitVersions() {
  const name = 'Explicit versions write scoped files and links';
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'stable-docs'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'get-started.md'), page('Get Started', 'Nightly body.'));
    fs.writeFileSync(path.join(tmpDir, 'stable-docs', 'get-started.md'), page('Get Started', 'Stable body.'));

    const p = plugin(makeMockContext(tmpDir, outDir), {
      generateLLMsFullTxt: false,
      customLLMFiles: [
        { filename: 'llms-guide.txt', title: 'Guide', description: 'Guide.', includePatterns: ['get-started.md'], fullContent: false },
      ],
      versions: [
        { name: 'nightly', label: 'Nightly', docsDir: 'docs', path: '' },
        { name: 'v26.4', label: 'v26.4', docsDir: 'stable-docs', path: 'stable' },
      ],
    });
    await p.postBuild({ routesPaths: ROUTES });

    const root = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    const stable = fs.readFileSync(path.join(outDir, 'stable', 'llms.txt'), 'utf8');

    assert.ok(root.includes('Version: Nightly'), 'root file should carry the Nightly label');
    assert.ok(stable.includes('Version: v26.4'), 'stable file should carry the v26.4 label');

    // Each version generates its custom files too, labeled with the version.
    const rootGuide = fs.readFileSync(path.join(outDir, 'llms-guide.txt'), 'utf8');
    const stableGuide = fs.readFileSync(path.join(outDir, 'stable', 'llms-guide.txt'), 'utf8');
    assert.ok(rootGuide.includes('Version: Nightly'), 'root custom file should inherit the Nightly label');
    assert.ok(stableGuide.includes('Version: v26.4'), 'stable custom file should inherit the v26.4 label');

    // Links are version-scoped: root -> /get-started, stable -> /stable/get-started.
    // (No .md suffix by default, since generateMarkdownFiles is off — issue #41.)
    assert.ok(root.includes('/get-started'), 'root should link to /get-started');
    assert.ok(!root.includes('/stable/'), 'root links should not leak into /stable/');
    assert.ok(stable.includes('/stable/get-started'), 'stable should link to /stable/get-started');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 2: versions: 'auto' detects current + versioned docs from Docusaurus
async function testAutoDetection() {
  const name = "versions: 'auto' detects current + versioned docs";
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'versioned_docs', 'version-1'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'get-started.md'), page('Get Started', 'Nightly body.'));
    fs.writeFileSync(
      path.join(tmpDir, 'versioned_docs', 'version-1', 'get-started.md'),
      page('Get Started', 'Stable body.')
    );
    fs.writeFileSync(path.join(tmpDir, 'versions.json'), JSON.stringify(['1']));

    const siteConfig = {
      presets: [
        [
          'classic',
          {
            docs: {
              versions: {
                current: { label: 'Nightly', path: '/' },
                1: { label: 'v26.4', path: '/stable' },
              },
            },
          },
        ],
      ],
    };

    const p = plugin(makeMockContext(tmpDir, outDir, siteConfig), {
      generateLLMsFullTxt: false,
      versions: 'auto',
    });
    await p.postBuild({ routesPaths: ROUTES });

    const root = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    const stable = fs.readFileSync(path.join(outDir, 'stable', 'llms.txt'), 'utf8');

    assert.ok(root.includes('Version: Nightly'), 'auto: root should use the Nightly label from config');
    assert.ok(stable.includes('Version: v26.4'), 'auto: stable should use the v26.4 label from config');
    assert.ok(stable.includes('/stable/get-started'), 'auto: stable should link into /stable/');
    assert.ok(!root.includes('/stable/'), 'auto: root links should not leak into /stable/');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 3: omitting `versions` reproduces single-root behavior (no subdirs)
async function testBackwardCompat() {
  const name = 'Omitting versions keeps single-root behavior';
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'get-started.md'), page('Get Started', 'Body.'));

    const p = plugin(makeMockContext(tmpDir, outDir), {
      generateLLMsFullTxt: false,
      docsDir: 'docs',
    });
    await p.postBuild({ routesPaths: ['/get-started'] });

    assert.ok(fs.existsSync(path.join(outDir, 'llms.txt')), 'root llms.txt should exist');
    assert.ok(!fs.existsSync(path.join(outDir, 'stable')), 'no version subdir should be created');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 4: validation rejects malformed versions options
async function testValidation() {
  const name = 'Validation rejects malformed versions';
  try {
    const ctx = () => makeMockContext('/tmp', '/tmp/out');

    assert.throws(
      () => plugin(ctx(), { versions: 123 }),
      /versions must be an array of version objects or 'auto'/,
      'non-array, non-auto value should throw'
    );
    assert.throws(
      () => plugin(ctx(), { versions: [] }),
      /versions must contain at least one version object/,
      'empty array should throw'
    );
    assert.throws(
      () => plugin(ctx(), { versions: [{ path: 'x' }] }),
      /versions\[0\]\.name must be a non-empty string/,
      'missing name should throw'
    );
    assert.throws(
      () => plugin(ctx(), { versions: [{ name: 'a' }, { name: 'a' }] }),
      /versions\[1\]\.name 'a' is duplicated/,
      'duplicate name should throw'
    );
    assert.throws(
      () => plugin(ctx(), { versions: [{ name: 'a', path: 'x' }, { name: 'b', path: 'x' }] }),
      /collides with another version/,
      'colliding paths should throw'
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  }
}

// Test 5: versions: 'auto' reads version metadata from a standalone
// plugin-content-docs entry (as opposed to a preset), the shape used when docs
// are configured via `plugins` with `docs: false` in the preset.
async function testAutoDetectionFromPlugins() {
  const name = "versions: 'auto' reads metadata from a plugins content-docs entry";
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'versioned_docs', 'version-1'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'get-started.md'), page('Get Started', 'Nightly body.'));
    fs.writeFileSync(
      path.join(tmpDir, 'versioned_docs', 'version-1', 'get-started.md'),
      page('Get Started', 'Stable body.')
    );
    fs.writeFileSync(path.join(tmpDir, 'versions.json'), JSON.stringify(['1']));

    // docs configured as a standalone plugin (preset has docs: false).
    const siteConfig = {
      presets: [['classic', { docs: false }]],
      plugins: [
        [
          '@docusaurus/plugin-content-docs',
          {
            versions: {
              current: { label: 'Nightly', path: '/' },
              1: { label: 'v26.4', path: '/stable' },
            },
          },
        ],
      ],
    };

    const p = plugin(makeMockContext(tmpDir, outDir, siteConfig), {
      generateLLMsFullTxt: false,
      versions: 'auto',
    });
    await p.postBuild({ routesPaths: ROUTES });

    const root = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    const stable = fs.readFileSync(path.join(outDir, 'stable', 'llms.txt'), 'utf8');
    assert.ok(root.includes('Version: Nightly'), 'plugins auto: root uses Nightly label');
    assert.ok(stable.includes('Version: v26.4'), 'plugins auto: stable uses v26.4 label');
    assert.ok(stable.includes('/stable/get-started'), 'plugins auto: stable links into /stable/');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

async function main() {
  await testExplicitVersions();
  await testAutoDetection();
  await testAutoDetectionFromPlugins();
  await testBackwardCompat();
  await testValidation();

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
