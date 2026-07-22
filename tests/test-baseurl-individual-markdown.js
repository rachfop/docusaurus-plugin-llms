/**
 * Regression tests for generateIndividualMarkdownFiles with a non-root baseUrl.
 *
 * When a Docusaurus site is deployed under a non-root baseUrl (e.g.
 * '/some/subpath/'), siteUrl already equals siteConfig.url + siteConfig.baseUrl,
 * so doc.url includes the baseUrl segment. The physical .md file must be written
 * relative to the output root *without* the baseUrl segment (matching how
 * Docusaurus writes its own HTML build output), while the published link in
 * llms.txt keeps the baseUrl exactly once.
 *
 * Run with: node test-baseurl-individual-markdown.js
 */

const fs = require('fs');
const path = require('path');
const { generateIndividualMarkdownFiles } = require('../lib/generator');

const testCases = [
  {
    name: 'single-segment baseUrl - file written relative to output root',
    docs: [
      {
        title: 'Intro',
        path: 'docs/guides/intro.md',
        content: 'Intro content.',
        description: 'Getting started',
        url: 'https://example.com/subpath/guides/intro'
      }
    ],
    preserveDirectoryStructure: false,
    siteUrl: 'https://example.com/subpath/',
    docsDir: 'docs',
    expectedPaths: ['guides/intro.md'],
    expectedUrls: ['https://example.com/subpath/guides/intro.md']
  },
  {
    name: 'multi-segment baseUrl - baseUrl stripped once from physical path',
    docs: [
      {
        title: 'Intro',
        path: 'docs/guides/intro.md',
        content: 'Intro content.',
        description: 'Getting started',
        url: 'https://example.com/some/subpath/guides/intro'
      }
    ],
    preserveDirectoryStructure: false,
    siteUrl: 'https://example.com/some/subpath/',
    docsDir: 'docs',
    expectedPaths: ['guides/intro.md'],
    expectedUrls: ['https://example.com/some/subpath/guides/intro.md']
  },
  {
    name: 'multi-segment baseUrl - preserveDirectoryStructure true keeps docs/ but strips baseUrl',
    docs: [
      {
        title: 'Intro',
        path: 'docs/guides/intro.md',
        content: 'Intro content.',
        description: 'Getting started',
        url: 'https://example.com/some/subpath/docs/guides/intro'
      }
    ],
    preserveDirectoryStructure: true,
    siteUrl: 'https://example.com/some/subpath/',
    docsDir: 'docs',
    expectedPaths: ['docs/guides/intro.md'],
    expectedUrls: ['https://example.com/some/subpath/docs/guides/intro.md']
  },
  {
    name: 'baseUrl-only page (slug: /) written as index.md',
    docs: [
      {
        title: 'Home',
        path: 'docs/index.md',
        content: 'Home content.',
        description: 'Home page',
        url: 'https://example.com/some/subpath/'
      }
    ],
    preserveDirectoryStructure: false,
    siteUrl: 'https://example.com/some/subpath/',
    docsDir: 'docs',
    expectedPaths: ['index.md'],
    expectedUrls: ['https://example.com/some/subpath/index.md']
  },
  {
    name: 'root baseUrl - unaffected (no stripping)',
    docs: [
      {
        title: 'Intro',
        path: 'docs/guides/intro.md',
        content: 'Intro content.',
        description: 'Getting started',
        url: 'https://example.com/guides/intro'
      }
    ],
    preserveDirectoryStructure: false,
    siteUrl: 'https://example.com',
    docsDir: 'docs',
    expectedPaths: ['guides/intro.md'],
    expectedUrls: ['https://example.com/guides/intro.md']
  }
];

async function runTests() {
  console.log('Running baseUrl individual-markdown regression tests...\n');

  let passed = 0;
  let failed = 0;

  const testDir = path.join(__dirname, 'test-baseurl-individual-markdown-out');

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);

    // Fresh directory per case
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    try {
      const result = await generateIndividualMarkdownFiles(
        testCase.docs,
        testDir,
        testCase.siteUrl,
        testCase.docsDir,
        [],
        testCase.preserveDirectoryStructure
      );

      let ok = true;

      // Physical file exists at the expected (baseUrl-stripped) path.
      for (const expectedPath of testCase.expectedPaths) {
        const fullPath = path.join(testDir, expectedPath);
        if (!fs.existsSync(fullPath)) {
          console.log(`❌ FAIL - Expected file at "${expectedPath}" not found`);
          ok = false;
        }
      }

      // Published URL keeps baseUrl exactly once.
      for (let i = 0; i < result.length; i++) {
        if (result[i].url !== testCase.expectedUrls[i]) {
          console.log(`❌ FAIL - Expected URL "${testCase.expectedUrls[i]}", got "${result[i].url}"`);
          ok = false;
        }
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
  console.log(`baseUrl individual-markdown Tests Summary:`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log(`========================================\n`);

  if (failed === 0) {
    console.log('🎉 All baseUrl individual-markdown tests passed!');
  } else {
    console.log('❌ Some baseUrl individual-markdown tests failed.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
