/**
 * Regression tests for compound number-prefix stripping in generated markdown paths.
 *
 * Docusaurus's DefaultNumberPrefixParser strips a leading ordering prefix using a
 * one-or-more separator ([-_.]+) and deliberately leaves version/date-like names
 * intact. A folder such as "03--1.6.X" (ordering prefix "03-" + literal name
 * "-1.6.X") therefore resolves to the clean name "1.6.X", and Docusaurus serves the
 * page under a "1.6.X/" directory.
 *
 * The plugin previously stripped only a single literal dash (/^\d+-/), turning
 * "03--1.6.X" into "-1.6.X" and writing the generated .md under a non-existent
 * "-1.6.X/" directory. These tests exercise the real, shipped
 * generateIndividualMarkdownFiles to confirm parity with Docusaurus's parser.
 *
 * Run with: node tests/test-compound-number-prefixes.js
 */

const fs = require('fs');
const path = require('path');
const { generateIndividualMarkdownFiles } = require('../lib/generator');

const testCases = [
  {
    name: 'compound prefix "03--1.6.X" resolves to clean "1.6.X"',
    doc: {
      title: 'Version 1.6.X',
      path: 'docs/03--1.6.X/intro.md',
      content: 'Release notes.',
      url: 'https://example.com/docs/03--1.6.X/intro'
    },
    expectedPath: '1.6.X/intro.md',
    expectedUrl: 'https://example.com/1.6.X/intro.md'
  },
  {
    name: 'compound prefix "01--1.6.2" resolves to clean "1.6.2"',
    doc: {
      title: 'Patch 1.6.2',
      path: 'docs/01--1.6.2/notes.md',
      content: 'Patch notes.',
      url: 'https://example.com/docs/01--1.6.2/notes'
    },
    expectedPath: '1.6.2/notes.md',
    expectedUrl: 'https://example.com/1.6.2/notes.md'
  },
  {
    name: 'plain single-dash ordering prefix "02-guide" still strips to "guide"',
    doc: {
      title: 'Guide',
      path: 'docs/02-guide/02-vulnerabilidades-cves.md',
      content: 'Guide content.',
      url: 'https://example.com/docs/02-guide/02-vulnerabilidades-cves'
    },
    expectedPath: 'guide/vulnerabilidades-cves.md',
    expectedUrl: 'https://example.com/guide/vulnerabilidades-cves.md'
  },
  {
    name: 'version-like name "7.0-foo" (no ordering prefix) is preserved',
    doc: {
      title: 'Seven',
      path: 'docs/7.0-foo/index.md',
      content: 'Seven content.',
      url: 'https://example.com/docs/7.0-foo/page'
    },
    expectedPath: '7.0-foo/page.md',
    expectedUrl: 'https://example.com/7.0-foo/page.md'
  },
  {
    name: 'non-prefixed name "release-notes" is untouched',
    doc: {
      title: 'Release Notes',
      path: 'docs/release-notes/index.md',
      content: 'Notes.',
      url: 'https://example.com/docs/release-notes/latest'
    },
    expectedPath: 'release-notes/latest.md',
    expectedUrl: 'https://example.com/release-notes/latest.md'
  }
];

async function runTests() {
  console.log('Running compound number-prefix tests...\n');

  let passed = 0;
  let failed = 0;

  const testDir = path.join(__dirname, 'test-compound-number-prefixes-out');

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    try {
      const result = await generateIndividualMarkdownFiles(
        [testCase.doc],
        testDir,
        'https://example.com',
        'docs',
        [],
        false // preserveDirectoryStructure: false → flatten relative to docs root
      );

      let ok = true;

      const fullPath = path.join(testDir, testCase.expectedPath);
      if (!fs.existsSync(fullPath)) {
        console.log(`❌ FAIL - Expected file at "${testCase.expectedPath}" not found`);
        // Surface what was actually written to aid debugging.
        const walk = d => fs.readdirSync(d, { withFileTypes: true })
          .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
        console.log(`   Actual files: ${walk(testDir).map(f => path.relative(testDir, f)).join(', ')}`);
        ok = false;
      }

      if (result[0].url !== testCase.expectedUrl) {
        console.log(`❌ FAIL - Expected URL "${testCase.expectedUrl}", got "${result[0].url}"`);
        ok = false;
      }

      if (ok) {
        console.log('✅ PASS');
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      console.error(error.stack);
      failed++;
    }
  }

  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }

  console.log(`\n========================================`);
  console.log(`Compound number-prefix Tests Summary:`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log(`========================================\n`);

  if (failed === 0) {
    console.log('🎉 All compound number-prefix tests passed!');
  } else {
    console.log('❌ Some compound number-prefix tests failed.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
