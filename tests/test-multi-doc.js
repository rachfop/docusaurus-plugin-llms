/**
 * Integration tests for multi-docs support (docsDir as array of section objects)
 *
 * Run with: node tests/test-multi-doc.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const pluginModule = require('../lib/index');
const plugin = pluginModule.default;

console.log('Testing multi-docs support...\n');

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

/**
 * Create a temp directory with docs/ and api/ subdirectories containing test fixtures
 */
function createTempSite() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-test-'));
  const outDir = path.join(tmpDir, 'out');

  fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'api'), { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(tmpDir, 'docs', 'getting-started.md'),
    '---\ntitle: Getting Started\ndescription: Start here.\n---\n\n# Getting Started\n\nStart here.'
  );

  fs.writeFileSync(
    path.join(tmpDir, 'api', 'authentication.md'),
    '---\ntitle: Authentication\ndescription: API auth docs.\n---\n\n# Authentication\n\nAPI auth docs.'
  );

  return { tmpDir, outDir };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

/**
 * Create a temp site with two sections whose filesystem `path` differs from
 * their `routeBasePath` (e.g. { path: 'team-a/docs', routeBasePath: 'docs/team-a' }).
 */
function createMismatchedPathSite() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-test-'));
  const outDir = path.join(tmpDir, 'out');

  fs.mkdirSync(path.join(tmpDir, 'team-a', 'docs'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'team-b', 'docs'), { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(tmpDir, 'team-a', 'docs', 'getting-started.md'),
    '---\ntitle: Getting Started\ndescription: Start here.\n---\n\n# Getting Started\n\nStart here.'
  );

  fs.writeFileSync(
    path.join(tmpDir, 'team-b', 'docs', 'faq.md'),
    '---\ntitle: FAQ\ndescription: Team B FAQ.\n---\n\n# FAQ\n\nTeam B FAQ.'
  );

  return { tmpDir, outDir };
}

function makeMockContext(tmpDir, outDir) {
  return {
    siteDir: tmpDir,
    siteConfig: {
      title: 'Test Site',
      tagline: 'Testing multi-docs',
      url: 'https://example.com',
      baseUrl: '/',
    },
    outDir,
  };
}

// Test 1: Two labeled sections produce grouped ## Section headings in llms.txt
async function testTwoLabeledSections() {
  const name = 'Two labeled sections produce grouped ## Section headings';
  const { tmpDir, outDir } = createTempSite();
  try {
    const p = plugin(makeMockContext(tmpDir, outDir), {
      docsDir: [
        { path: 'docs', routeBasePath: 'docs', label: 'Documentation' },
        { path: 'api', routeBasePath: 'api', label: 'API Reference' },
      ],
      llmsTxtFilename: 'llms-test1.txt',
      llmsFullTxtFilename: 'llms-full-test1.txt',
    });
    await p.postBuild();

    const content = fs.readFileSync(path.join(outDir, 'llms-test1.txt'), 'utf8');

    assert.ok(content.includes('## Documentation'), 'Expected ## Documentation heading');
    assert.ok(content.includes('## API Reference'), 'Expected ## API Reference heading');
    assert.ok(content.includes('Getting Started'), 'Expected Getting Started link');
    assert.ok(content.includes('Authentication'), 'Expected Authentication link');

    // Documentation heading should appear before API Reference heading
    assert.ok(
      content.indexOf('## Documentation') < content.indexOf('## API Reference'),
      'Expected Documentation section before API Reference section'
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 2: Label fallback to path when no label provided
async function testLabelFallbackToPath() {
  const name = 'Label falls back to path when no label provided';
  const { tmpDir, outDir } = createTempSite();
  try {
    const p = plugin(makeMockContext(tmpDir, outDir), {
      docsDir: [
        { path: 'docs', routeBasePath: 'docs' },
        { path: 'api', routeBasePath: 'api' },
      ],
      llmsTxtFilename: 'llms-test2.txt',
      llmsFullTxtFilename: 'llms-full-test2.txt',
    });
    await p.postBuild();

    const content = fs.readFileSync(path.join(outDir, 'llms-test2.txt'), 'utf8');

    assert.ok(content.includes('## docs'), 'Expected ## docs heading when no label');
    assert.ok(content.includes('## api'), 'Expected ## api heading when no label');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 3: String docsDir still works (backward compatibility)
async function testStringDocsDirBackwardCompat() {
  const name = 'String docsDir remains backward-compatible';
  const { tmpDir, outDir } = createTempSite();
  try {
    const p = plugin(makeMockContext(tmpDir, outDir), {
      docsDir: 'docs',
      llmsTxtFilename: 'llms-test3.txt',
      llmsFullTxtFilename: 'llms-full-test3.txt',
    });
    await p.postBuild();

    const content = fs.readFileSync(path.join(outDir, 'llms-test3.txt'), 'utf8');

    assert.ok(content.includes('Getting Started'), 'Expected docs content in output');
    // Should NOT contain api content since we only specified docs
    assert.ok(!content.includes('Authentication'), 'Should not include api content with string docsDir: docs');
    // Should not contain section headings for single section
    assert.ok(!content.includes('## docs'), 'Should not have section heading for single string docsDir');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 4: Single array entry works correctly (no section headings)
async function testSingleArrayEntry() {
  const name = 'Single array entry works correctly without section headings';
  const { tmpDir, outDir } = createTempSite();
  try {
    const p = plugin(makeMockContext(tmpDir, outDir), {
      docsDir: [
        { path: 'api', routeBasePath: 'api', label: 'API Reference' },
      ],
      llmsTxtFilename: 'llms-test4.txt',
      llmsFullTxtFilename: 'llms-full-test4.txt',
    });
    await p.postBuild();

    const content = fs.readFileSync(path.join(outDir, 'llms-test4.txt'), 'utf8');

    assert.ok(content.includes('Authentication'), 'Expected api content in output');
    // Single section should NOT have section grouping headings
    assert.ok(!content.includes('## API Reference'), 'Should not have section heading for single-entry array');
    // Should not contain docs content
    assert.ok(!content.includes('Getting Started'), 'Should not include docs content when only api section configured');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 5: Validation rejects invalid docsDir array entries
async function testValidationRejectsInvalidArray() {
  const name = 'Validation rejects invalid docsDir array entries';
  try {
    // Missing routeBasePath
    assert.throws(
      () => plugin(makeMockContext('/tmp', '/tmp/out'), {
        docsDir: [{ path: 'docs' }],
      }),
      /docsDir\[0\]\.routeBasePath must be a non-empty string/,
      'Expected error for missing routeBasePath'
    );

    // Missing path
    assert.throws(
      () => plugin(makeMockContext('/tmp', '/tmp/out'), {
        docsDir: [{ routeBasePath: 'docs' }],
      }),
      /docsDir\[0\]\.path must be a non-empty string/,
      'Expected error for missing path'
    );

    // Empty label
    assert.throws(
      () => plugin(makeMockContext('/tmp', '/tmp/out'), {
        docsDir: [{ path: 'docs', routeBasePath: 'docs', label: '   ' }],
      }),
      /docsDir\[0\]\.label must be a non-empty string/,
      'Expected error for whitespace-only label'
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  }
}

// Test 6: llms-full.txt contains content from all sections
async function testFullTxtContainsBothSections() {
  const name = 'llms-full.txt contains content from all sections';
  const { tmpDir, outDir } = createTempSite();
  try {
    const p = plugin(makeMockContext(tmpDir, outDir), {
      docsDir: [
        { path: 'docs', routeBasePath: 'docs', label: 'Documentation' },
        { path: 'api', routeBasePath: 'api', label: 'API Reference' },
      ],
      llmsTxtFilename: 'llms-test6.txt',
      llmsFullTxtFilename: 'llms-full-test6.txt',
    });
    await p.postBuild();

    const content = fs.readFileSync(path.join(outDir, 'llms-full-test6.txt'), 'utf8');

    assert.ok(content.includes('Getting Started'), 'Expected docs content in full output');
    assert.ok(content.includes('Authentication'), 'Expected api content in full output');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 7: Every section's own filesystem path is stripped, not just the first
async function testAllSectionsWithMismatchedPaths() {
  const name = 'All sections with diverging path/routeBasePath get correct URLs';
  const { tmpDir, outDir } = createMismatchedPathSite();
  try {
    const p = plugin(makeMockContext(tmpDir, outDir), {
      docsDir: [
        { path: 'team-a/docs', routeBasePath: 'docs/team-a' },
        { path: 'team-b/docs', routeBasePath: 'docs/team-b' },
      ],
      llmsTxtFilename: 'llms-test7.txt',
      llmsFullTxtFilename: 'llms-full-test7.txt',
    });
    await p.postBuild({ routesPaths: ['/docs/team-a/getting-started', '/docs/team-b/faq'] });

    const content = fs.readFileSync(path.join(outDir, 'llms-test7.txt'), 'utf8');

    assert.ok(
      content.includes('(https://example.com/docs/team-a/getting-started)'),
      `Expected clean URL for first section, got:\n${content}`
    );
    assert.ok(
      content.includes('(https://example.com/docs/team-b/faq)'),
      `Expected clean URL for second section, got:\n${content}`
    );
    // The heading legitimately falls back to the raw path as a label — only
    // the URL itself must never contain it.
    assert.ok(
      !content.includes('docs/team-b/team-b'),
      `URL must not leak the second section's filesystem path, got:\n${content}`
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 8: generateMarkdownFiles flattens every section, not just the first
async function testFlattenedMarkdownFilesForAllSections() {
  const name = 'generateMarkdownFiles flattens every section, not just the first';
  const { tmpDir, outDir } = createMismatchedPathSite();
  try {
    const p = plugin(makeMockContext(tmpDir, outDir), {
      docsDir: [
        { path: 'team-a/docs', routeBasePath: 'docs/team-a' },
        { path: 'team-b/docs', routeBasePath: 'docs/team-b' },
      ],
      generateMarkdownFiles: true,
      preserveDirectoryStructure: false,
      llmsTxtFilename: 'llms-test8.txt',
      llmsFullTxtFilename: 'llms-full-test8.txt',
    });
    await p.postBuild({ routesPaths: ['/docs/team-a/getting-started', '/docs/team-b/faq'] });

    assert.ok(fs.existsSync(path.join(outDir, 'getting-started.md')), 'Expected first section file flattened to getting-started.md');
    assert.ok(fs.existsSync(path.join(outDir, 'faq.md')), 'Expected second section file flattened to faq.md');
    assert.ok(!fs.existsSync(path.join(outDir, 'team-b')), 'Second section filesystem directory must not leak into the flattened output');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 9: docs-relative include patterns match files in every section, not just the first
async function testDocsRelativePatternMatchesAllSections() {
  const name = 'docs-relative include patterns match files in every section';
  const { tmpDir, outDir } = createMismatchedPathSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'team-b', 'docs', 'guides'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'team-b', 'docs', 'guides', 'setup.md'),
      '---\ntitle: Setup Guide\ndescription: Team B setup guide.\n---\n\n# Setup Guide\n\nTeam B setup guide.'
    );

    const p = plugin(makeMockContext(tmpDir, outDir), {
      docsDir: [
        { path: 'team-a/docs', routeBasePath: 'docs/team-a' },
        { path: 'team-b/docs', routeBasePath: 'docs/team-b' },
      ],
      customLLMFiles: [
        {
          filename: 'llms-guides-test9.txt',
          includePatterns: ['guides/*.md'],
          fullContent: false,
        },
      ],
    });
    await p.postBuild({ routesPaths: ['/docs/team-a/getting-started', '/docs/team-b/faq', '/docs/team-b/guides/setup'] });

    const content = fs.readFileSync(path.join(outDir, 'llms-guides-test9.txt'), 'utf8');
    assert.ok(content.includes('Setup Guide'), `Expected team-b's guides/setup.md to match "guides/*.md", got:\n${content}`);

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

// Test 10: A file with the same relative path in two sections (e.g. faq.md in
// both) must not resolve to the same route — each keeps its own section's URL.
async function testSameBasenameAcrossSectionsDoesNotCollide() {
  const name = 'Same-named files in different sections resolve to distinct URLs';
  const { tmpDir, outDir } = createMismatchedPathSite();
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'team-a', 'docs', 'faq.md'),
      '---\ntitle: FAQ\ndescription: Team A FAQ.\n---\n\n# FAQ\n\nTeam A FAQ.'
    );

    const p = plugin(makeMockContext(tmpDir, outDir), {
      docsDir: [
        { path: 'team-a/docs', routeBasePath: 'docs/team-a' },
        { path: 'team-b/docs', routeBasePath: 'docs/team-b' },
      ],
      generateMarkdownFiles: true,
      llmsTxtFilename: 'llms-test10.txt',
      llmsFullTxtFilename: 'llms-full-test10.txt',
    });
    await p.postBuild({ routesPaths: ['/docs/team-a/getting-started', '/docs/team-a/faq', '/docs/team-b/faq'] });

    const content = fs.readFileSync(path.join(outDir, 'llms-test10.txt'), 'utf8');

    assert.ok(content.includes('(https://example.com/docs/team-a/faq.md)'), `Expected team-a's faq at its own URL, got:\n${content}`);
    assert.ok(content.includes('(https://example.com/docs/team-b/faq.md)'), `Expected team-b's faq at its own URL, got:\n${content}`);
    assert.ok(!content.includes('faq-2'), `No file should need a "-2" suffix to disambiguate, got:\n${content}`);
    assert.ok(fs.existsSync(path.join(outDir, 'docs', 'team-a', 'faq.md')), 'Expected team-a/faq.md written to its own section directory');
    assert.ok(fs.existsSync(path.join(outDir, 'docs', 'team-b', 'faq.md')), 'Expected team-b/faq.md written to its own section directory');

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

async function main() {
  await testTwoLabeledSections();
  await testLabelFallbackToPath();
  await testStringDocsDirBackwardCompat();
  await testSingleArrayEntry();
  await testValidationRejectsInvalidArray();
  await testFullTxtContainsBothSections();
  await testAllSectionsWithMismatchedPaths();
  await testFlattenedMarkdownFilesForAllSections();
  await testDocsRelativePatternMatchesAllSections();
  await testSameBasenameAcrossSectionsDoesNotCollide();

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
