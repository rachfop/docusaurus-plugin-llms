/**
 * Regression tests for edge cases in TabItem label emission and multi-line
 * descriptions.
 *
 * 1. <TabItem label="A > B"> — the `>` inside a quoted attribute value must
 *    not terminate the tag match; a [^>]* scan leaked 'B" value="x">' as prose.
 * 2. A multi-line frontmatter description must render as a full blockquote
 *    ('> line one\n> line two'); only the first line was quoted.
 *
 * Run with: node tests/test-tabitem-attr-edge-cases.js
 */

const { cleanMarkdownContent, createMarkdownContent } = require('../lib/utils');

let passed = 0;
let failed = 0;
function expect(name, cond, detail) {
  if (cond) { console.log(`  ✅ PASS: ${name}`); passed++; }
  else { console.log(`  ❌ FAIL: ${name}\n     ${detail}`); failed++; }
}

function run() {
  console.log('Testing TabItem attribute edge cases and multi-line descriptions...\n');

  // 1. '>' inside a quoted label value.
  {
    const out = cleanMarkdownContent(
      '<Tabs>\n<TabItem label="A > B" value="x">\nBody.\n</TabItem>\n</Tabs>'
    );
    expect('label with > emitted intact', out.includes('**A > B**'), out);
    expect('no tag fragment leaked', !out.includes('value='), out);
    expect('body kept', out.includes('Body.'), out);
  }

  // 2. '>' inside a single-quoted label value.
  {
    const out = cleanMarkdownContent("<TabItem label='x > y'>Body.</TabItem>");
    expect('single-quoted label with > intact', out.includes('**x > y**'), out);
  }

  // 3. Plain labels still work (no regression).
  {
    const out = cleanMarkdownContent('<TabItem value="npm">npm install x</TabItem>');
    expect('plain value fallback works', out.includes('**npm**'), out);
  }

  // 4. Multi-line description blockquotes every line.
  {
    const out = createMarkdownContent('Title', 'line one\nline two', 'Body.');
    expect('first line quoted', out.includes('> line one'), out);
    expect('second line quoted', out.includes('> line two'), out);
    expect(
      'no unquoted second line',
      !/^line two$/m.test(out.split('Body.')[0]),
      out
    );
  }

  // 5. Single-line description unchanged (no regression).
  {
    const out = createMarkdownContent('Title', 'one line', 'Body.');
    expect('single-line description', out.includes('> one line'), out);
    expect('exactly one blockquote line', (out.match(/^> /gm) || []).length === 1, out);
  }

  // 6. Empty description omits the blockquote entirely.
  {
    const out = createMarkdownContent('Title', '', 'Body.');
    expect('no blockquote when empty', !out.includes('> '), out);
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total: ${passed + failed}\n`);
  return failed === 0;
}

const ok = run();
console.log(ok ? '🎉 All edge-case tests passed!' : '❌ Some tests failed.');
process.exit(ok ? 0 : 1);
