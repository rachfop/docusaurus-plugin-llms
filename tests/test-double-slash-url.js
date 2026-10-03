/**
 * Test suite for double-slash URL prevention when baseUrl is root ('/')
 *
 * Regression test for issue #27:
 * When generateMarkdownFiles is true and baseUrl is '/', generated URLs
 * should not contain double slashes (e.g., https://example.com//docs/intro.md).
 *
 * siteUrl already ends with '/' when baseUrl is '/', so the markdown file URL
 * that generateIndividualMarkdownFiles returns must join it without doubling
 * the slash.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateIndividualMarkdownFiles } = require('../lib/generator');

console.log('Testing double-slash URL prevention in markdown file URL generation...\n');

// Each case is a site URL and a doc route; the returned markdown URL is the
// route with a .md extension under the site URL.
const testCases = [
  {
    name: 'Root baseUrl produces no double slash',
    siteUrl: 'https://example.com/',
    route: 'docs/intro',
    expected: 'https://example.com/docs/intro.md',
  },
  {
    name: 'No trailing slash siteUrl remains correct',
    siteUrl: 'https://example.com',
    route: 'docs/intro',
    expected: 'https://example.com/docs/intro.md',
  },
  {
    name: 'siteUrl with subpath ending in slash produces no double slash',
    siteUrl: 'https://example.com/mysite/',
    route: 'docs/api/core',
    expected: 'https://example.com/mysite/docs/api/core.md',
  },
  {
    name: 'siteUrl with subpath without trailing slash is correct',
    siteUrl: 'https://example.com/mysite',
    route: 'docs/api/core',
    expected: 'https://example.com/mysite/docs/api/core.md',
  },
  {
    name: 'Root baseUrl with nested route produces no double slash',
    siteUrl: 'https://example.com/',
    route: 'guides/advanced/setup',
    expected: 'https://example.com/guides/advanced/setup.md',
  },
  {
    name: 'URL with port and root slash produces no double slash',
    siteUrl: 'https://example.com:8080/',
    route: 'docs/intro',
    expected: 'https://example.com:8080/docs/intro.md',
  },
];

async function runTests() {
  let passedTests = 0;
  let failedTests = 0;

  for (const [index, testCase] of testCases.entries()) {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-double-slash-'));
    try {
      const docUrl = `${testCase.siteUrl.replace(/\/+$/, '')}/${testCase.route}`;
      const [doc] = await generateIndividualMarkdownFiles(
        [
          {
            title: 'Page',
            path: `${testCase.route}.md`,
            content: 'Body.',
            description: 'Description.',
            url: docUrl,
          },
        ],
        outDir,
        testCase.siteUrl,
        'docs',
      );

      assert.strictEqual(doc.url, testCase.expected);
      assert.ok(
        !doc.url.replace('://', '').includes('//'),
        `URL "${doc.url}" contains a double slash (excluding the protocol)`,
      );
      assert.ok(
        fs.existsSync(path.join(outDir, `${testCase.route}.md`)),
        `markdown file ${testCase.route}.md was not written`,
      );

      console.log(`✓ Test ${index + 1} passed: ${testCase.name}`);
      console.log(`  siteUrl: "${testCase.siteUrl}" → "${doc.url}"\n`);
      passedTests++;
    } catch (error) {
      console.error(`✗ Test ${index + 1} failed: ${testCase.name}`);
      console.error(`  siteUrl: "${testCase.siteUrl}", route: "${testCase.route}"`);
      console.error(`  ${error.message}\n`);
      failedTests++;
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }

  console.log('='.repeat(60));
  console.log(`Test Summary:`);
  console.log(`  Total tests: ${testCases.length}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${failedTests}`);
  console.log('='.repeat(60));

  if (failedTests > 0) {
    process.exit(1);
  }
  console.log('\n✓ All double-slash URL prevention tests passed!');
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
