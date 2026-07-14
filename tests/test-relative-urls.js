/**
 * Tests for the `useRelativeUrls` option (issues #37, #42): when enabled, links
 * in llms.txt are emitted origin-relative (path + baseUrl only) instead of
 * absolute, so they resolve regardless of which host serves the site.
 *
 * Run with: node test-relative-urls.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { generateLLMFile } = require('../lib/generator');

let passed = 0;
let failed = 0;

async function emit(docs, { addMdExtension = true, useRelativeUrls = false } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-relurl-'));
  const outPath = path.join(tmpDir, 'llms.txt');
  await generateLLMFile(
    docs,
    outPath,
    'Test',
    'Test description',
    false,        // links only
    undefined,    // version
    undefined,    // rootContent
    100,          // batchSize
    addMdExtension,
    useRelativeUrls
  );
  const content = fs.readFileSync(outPath, 'utf8');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return content;
}

function expect(name, condition, detail) {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${name}\n   ${detail}`);
    failed++;
  }
}

async function run() {
  console.log('Testing useRelativeUrls option...\n');

  const flatDocs = [
    { title: 'Page One', url: 'https://thunder.dev/thunder/docs/one', description: 'first', content: '' },
  ];
  const sectionedDocs = [
    { title: 'Page Two', url: 'https://thunder.dev/thunder/docs/two', description: 'second', content: '', section: 'Guides' },
  ];

  // Default: absolute URLs preserved
  const abs = await emit(flatDocs);
  expect('default emits absolute URL', abs.includes('(https://thunder.dev/thunder/docs/one.md)'), abs);

  // Enabled: origin-relative, keeps baseUrl and .md extension
  const rel = await emit(flatDocs, { useRelativeUrls: true });
  expect('relative link keeps baseUrl + .md', rel.includes('(/thunder/docs/one.md)'), rel);
  expect('relative link drops scheme+host', !rel.includes('https://thunder.dev'), rel);

  // Enabled without .md extension
  const relNoMd = await emit(flatDocs, { useRelativeUrls: true, addMdExtension: false });
  expect('relative link without .md', relNoMd.includes('(/thunder/docs/one)') && !relNoMd.includes('.md)'), relNoMd);

  // Sectioned branch also converts
  const relSection = await emit(sectionedDocs, { useRelativeUrls: true });
  expect('relative link in sectioned output', relSection.includes('(/thunder/docs/two.md)'), relSection);
  expect('sectioned output has heading', relSection.includes('## Guides'), relSection);

  // Query string and fragment are preserved (addMdExtension off to isolate)
  const queryDocs = [
    { title: 'Page Q', url: 'https://thunder.dev/thunder/docs/one?tab=a#frag', description: 'q', content: '' },
  ];
  const relQuery = await emit(queryDocs, { useRelativeUrls: true, addMdExtension: false });
  expect('relative link preserves query + fragment', relQuery.includes('(/thunder/docs/one?tab=a#frag)'), relQuery);

  // Already-relative URLs pass through unchanged (catch branch)
  const alreadyRelDocs = [
    { title: 'Page R', url: '/thunder/docs/one', description: 'r', content: '' },
  ];
  const relPassthrough = await emit(alreadyRelDocs, { useRelativeUrls: true, addMdExtension: false });
  expect('already-relative URL passes through unchanged', relPassthrough.includes('(/thunder/docs/one)'), relPassthrough);

  console.log(`\n========================================`);
  console.log(`Relative URL Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);
  return failed === 0;
}

run()
  .then(ok => {
    console.log(ok ? '🎉 All relative URL tests passed!' : '❌ Some tests failed.');
    process.exit(ok ? 0 : 1);
  })
  .catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
