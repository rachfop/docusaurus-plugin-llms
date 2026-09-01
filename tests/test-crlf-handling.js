/**
 * Tests for CRLF line-ending handling (#audit finding 2).
 *
 * readFile normalizes \r\n (and lone \r) to \n. Before that, CRLF files broke:
 *  - fence masking (closing-fence lookahead requires bare \n) → code inside
 *    fences was cleaned as prose, corrupting it
 *  - description extraction (split('\n\n') never matched on CRLF)
 *
 * Run with: node tests/test-crlf-handling.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { processMarkdownFile } = require('../lib/processor');
const { extractTitle } = require('../lib/utils');

let passed = 0;
let failed = 0;
function expect(name, cond, detail) {
  if (cond) { console.log(`  ✅ PASS: ${name}`); passed++; }
  else { console.log(`  ❌ FAIL: ${name}\n     ${detail}`); failed++; }
}

async function run() {
  console.log('Testing CRLF line-ending handling...\n');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-crlf-'));
  try {
    // A CRLF doc whose fenced code contains content the cleaner would strip.
    const docPath = path.join(tmp, 'crlf-doc.mdx');
    const raw = [
      '---',
      'title: CRLF Doc',
      '---',
      '',
      '# CRLF Doc',
      '',
      'Intro paragraph.',
      '',
      '```js',
      'import Foundation from "somewhere";',
      'console.log("<div>hello</div>");',
      '```',
      '',
      'Outro paragraph.',
    ].join('\r\n');
    fs.writeFileSync(docPath, raw);

    const result = await processMarkdownFile(
      docPath,
      tmp,
      'https://example.com',
      'docs',
      true, // excludeImports — must NOT strip the import inside the fence
      true // removeDuplicateHeadings
    );

    // 1. Code fence masked on CRLF: import and HTML inside the fence survive.
    expect('CRLF: fenced import preserved',
      result.content.includes('import Foundation'), result.content);
    expect('CRLF: fenced HTML preserved',
      result.content.includes('<div>hello</div>'), result.content);

    // 2. Description extracted from the correct paragraph, not the heading
    //    text and not the entire document.
    expect('CRLF: description from intro paragraph',
      (result.description || '').includes('Intro paragraph.'),
      JSON.stringify(result.description));
    expect('CRLF: description not the whole doc',
      !(result.description || '').includes('Outro paragraph.'),
      JSON.stringify(result.description));

    // 3. Title extracted cleanly (no \r contamination).
    expect('CRLF: title clean', result.title === 'CRLF Doc', JSON.stringify(result.title));

    // 4. extractTitle on raw CRLF content (masked path) still works.
    const title = extractTitle({}, '# Heading\r\nBody', 'some-file.mdx');
    expect('CRLF: extractTitle trims CR', title === 'Heading', JSON.stringify(title));

    // 5. No stray \r anywhere in the output content.
    expect('CRLF: no CR characters in output', !result.content.includes('\r'), result.content.slice(0, 200));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total: ${passed + failed}\n`);
  return failed === 0;
}

run()
  .then(ok => { console.log(ok ? '🎉 All CRLF tests passed!' : '❌ Some tests failed.'); process.exit(ok ? 0 : 1); })
  .catch(err => { console.error('Test execution error:', err); process.exit(1); });
