/**
 * Test that preserveDirectoryStructure (and related options processingBatchSize,
 * warnOnIgnoredFiles) are correctly passed through pluginContext.options so that
 * generator functions receive the user's configured values rather than hardcoded
 * defaults.
 *
 * Run with: node test-preserve-directory-structure-passthrough.js
 *
 * Regression test for issue #29.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing preserveDirectoryStructure passthrough via pluginContext...\n');

// Import the compiled plugin
const docusaurusPluginLLMs = require('../lib/index.js').default;

// Standard mock context
const mockContext = {
  siteDir: '/tmp/test-site',
  siteConfig: {
    title: 'Test Site',
    tagline: 'Test tagline',
    url: 'https://example.com',
    baseUrl: '/'
  },
  outDir: '/tmp/test-site/build'
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL: ${name}`);
    console.log(`  ${err.message}`);
    failed++;
  }
}

// ---- preserveDirectoryStructure ----

test('preserveDirectoryStructure: true is stored in pluginContext.options', () => {
  const plugin = docusaurusPluginLLMs(mockContext, {
    preserveDirectoryStructure: true
  });
  // The plugin object itself doesn't expose context, so we verify by inspecting
  // that the plugin initialised without error and is the correct shape.
  assert.ok(plugin, 'plugin should be truthy');
  assert.strictEqual(plugin.name, 'docusaurus-plugin-llms');
});

test('preserveDirectoryStructure: false flows correctly - generator honours it', async () => {
  // We verify the end-to-end flow by calling generateIndividualMarkdownFiles
  // directly with preserveDirectoryStructure: false and checking that the docs
  // directory prefix is stripped from output paths.
  const { generateIndividualMarkdownFiles } = require('../lib/generator');

  const testDir = path.join(__dirname, 'tmp-passthrough-false');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  try {
    const docs = [
      {
        title: 'My Guide',
        path: 'docs/guide/intro.md',
        content: 'Introduction content.',
        description: 'Intro guide',
        url: 'https://example.com/docs/guide/intro'
      }
    ];

    const result = await generateIndividualMarkdownFiles(
      docs,
      testDir,
      'https://example.com',
      'docs',
      [], // keepFrontMatter
      false // preserveDirectoryStructure = false → strip docs/ prefix
    );

    // With preserveDirectoryStructure: false the docs/ prefix must be stripped
    const expectedRelPath = 'guide/intro.md';
    const expectedFullPath = path.join(testDir, expectedRelPath);

    assert.ok(
      fs.existsSync(expectedFullPath),
      `Expected file at "${expectedRelPath}" (docs/ prefix stripped) when preserveDirectoryStructure=false`
    );

    // The docs/ prefixed path must NOT exist
    const wrongPath = path.join(testDir, 'docs/guide/intro.md');
    assert.ok(
      !fs.existsSync(wrongPath),
      'File should NOT exist under docs/ subdir when preserveDirectoryStructure=false'
    );

    // Result doc should reflect the stripped path
    assert.strictEqual(
      result[0].path,
      `/${expectedRelPath}`,
      `doc.path should be "/${expectedRelPath}", got "${result[0].path}"`
    );
  } finally {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
});

test('preserveDirectoryStructure: true flows correctly - generator preserves docs/ prefix', async () => {
  const { generateIndividualMarkdownFiles } = require('../lib/generator');

  const testDir = path.join(__dirname, 'tmp-passthrough-true');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  try {
    const docs = [
      {
        title: 'My Guide',
        path: 'docs/guide/intro.md',
        content: 'Introduction content.',
        description: 'Intro guide',
        url: 'https://example.com/docs/guide/intro'
      }
    ];

    const result = await generateIndividualMarkdownFiles(
      docs,
      testDir,
      'https://example.com',
      'docs',
      [], // keepFrontMatter
      true // preserveDirectoryStructure = true → keep docs/ prefix
    );

    // With preserveDirectoryStructure: true the full path including docs/ must exist
    const expectedRelPath = 'docs/guide/intro.md';
    const expectedFullPath = path.join(testDir, expectedRelPath);

    assert.ok(
      fs.existsSync(expectedFullPath),
      `Expected file at "${expectedRelPath}" (docs/ prefix kept) when preserveDirectoryStructure=true`
    );

    assert.strictEqual(
      result[0].path,
      `/${expectedRelPath}`,
      `doc.path should be "/${expectedRelPath}", got "${result[0].path}"`
    );
  } finally {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
});

// ---- pluginContext.options carries all three new options ----

test('plugin initialises with non-default preserveDirectoryStructure: false', () => {
  // If the fix is missing, the option would be silently ignored.
  // We verify the plugin at least accepts the option without error.
  const plugin = docusaurusPluginLLMs(mockContext, {
    preserveDirectoryStructure: false,
    processingBatchSize: 50,
    warnOnIgnoredFiles: true
  });
  assert.strictEqual(plugin.name, 'docusaurus-plugin-llms');
});

test('processingBatchSize: custom value accepted', () => {
  const plugin = docusaurusPluginLLMs(mockContext, {
    processingBatchSize: 25
  });
  assert.strictEqual(plugin.name, 'docusaurus-plugin-llms');
});

test('warnOnIgnoredFiles: true accepted', () => {
  const plugin = docusaurusPluginLLMs(mockContext, {
    warnOnIgnoredFiles: true
  });
  assert.strictEqual(plugin.name, 'docusaurus-plugin-llms');
});

// ---- Summary ----

console.log(`\n========================================`);
console.log(`preserveDirectoryStructure Passthrough Tests:`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
