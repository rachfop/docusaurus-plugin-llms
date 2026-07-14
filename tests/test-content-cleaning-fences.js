/**
 * Tests that content cleaning is code-fence aware: HTML/JSX/import stripping,
 * image-URL rewriting and title detection must never alter code samples shown
 * inside fenced blocks or inline code (review findings #2, #4, and title bug).
 *
 * Run with: node tests/test-content-cleaning-fences.js
 */

const assert = require('assert');
const { cleanMarkdownContent, extractTitle, rewriteRelativeImageUrls } = require('../lib/utils');

let passed = 0;
let failed = 0;
function expect(name, cond, detail) {
  if (cond) { console.log(`  ✅ PASS: ${name}`); passed++; }
  else { console.log(`  ❌ FAIL: ${name}\n     ${detail}`); failed++; }
}

async function run() {
  console.log('Testing code-fence-aware content cleaning...\n');

  // 1. HTML inside a fenced block is preserved; HTML in prose is stripped.
  {
    const input = [
      'Prose with <strong>bold</strong> text.',
      '',
      '```html',
      '<div class="x"><p>hi</p></div>',
      '```',
    ].join('\n');
    const out = cleanMarkdownContent(input);
    expect('HTML preserved inside code fence', out.includes('<div class="x"><p>hi</p></div>'), out);
    expect('HTML stripped in prose', out.includes('Prose with bold text.') && !out.includes('<strong>'), out);
  }

  // 2. excludeImports strips real imports but not import lines inside code.
  {
    const input = [
      "import Foo from '@site/src/Foo';",
      '',
      'Text.',
      '',
      '```python',
      'import os',
      'import sys',
      '```',
    ].join('\n');
    const out = cleanMarkdownContent(input, true);
    expect('real MDX import removed', !out.includes("@site/src/Foo"), out);
    expect('import lines in code block preserved', out.includes('import os') && out.includes('import sys'), out);
  }

  // 3. JSX component tags stripped in prose (content kept); preserved in code.
  {
    const input = [
      '<Tabs><TabItem value="a">Alpha</TabItem></Tabs>',
      '',
      '```jsx',
      '<Tabs><TabItem value="b">Beta</TabItem></Tabs>',
      '```',
    ].join('\n');
    const out = cleanMarkdownContent(input);
    expect('JSX tags stripped in prose, text kept', out.includes('Alpha') && !out.match(/<Tabs>[^`]*Alpha/), out);
    expect('JSX preserved inside code fence', out.includes('<TabItem value="b">Beta</TabItem>'), out);
  }

  // 4. Inline code with angle brackets is preserved.
  {
    const input = 'Use the `<div>` element and <em>emphasis</em>.';
    const out = cleanMarkdownContent(input);
    expect('inline code <div> preserved', out.includes('`<div>`'), out);
    expect('prose <em> stripped', !out.includes('<em>'), out);
  }

  // 5. extractTitle ignores a `#` comment inside a code block.
  {
    const content = [
      '```bash',
      '# This is a shell comment',
      'echo hi',
      '```',
      '',
      '# Real Title',
      '',
      'Body.',
    ].join('\n');
    const title = extractTitle({}, content, '/x/file.md');
    expect('title is the real heading, not the code comment', title === 'Real Title', title);
  }

  // 5b. A heading containing inline code yields a clean title (no placeholder
  // tokens leaking out of maskCodeSegments).
  {
    const content = '# API reference for `MyClass`\n\nBody.';
    const title = extractTitle({}, content, '/x/file.md');
    expect('inline code in heading restored in title', title === 'API reference for `MyClass`', JSON.stringify(title));
  }

  // 5c. A longer closing fence (4 backticks closing a 3-backtick block) is still
  // treated as one code block, so its contents are preserved.
  {
    const input = ['```js', '<Widget />', '````', '', '<Widget />'].join('\n');
    const out = cleanMarkdownContent(input);
    expect('longer closing fence still masks block', out.includes('<Widget />\n````') || out.includes('<Widget />'), out);
    // The prose <Widget /> after the block should be stripped.
    expect('JSX after code block stripped', out.trimEnd().endsWith('````') || !out.split('````')[1]?.includes('<Widget'), out);
  }

  // 5d. A stray backtick does not swallow across a blank line (inline spans are
  // single-line), so an import after it is still removed with excludeImports.
  {
    const input = ['Para with ` stray backtick', '', "import X from 'x';", '', 'more `'].join('\n');
    const out = cleanMarkdownContent(input, true);
    expect('import after stray backtick still removed', !out.includes("import X from"), out);
  }

  // 6. Image rewriting skips image syntax shown inside a code block.
  {
    const content = [
      '![real](./img/logo.png)',
      '',
      '```markdown',
      '![example](./img/logo.png)',
      '```',
    ].join('\n');
    const assetMap = new Map([['logo.png', ['/assets/images/logo-abc123.png']]]);
    const out = await rewriteRelativeImageUrls(content, '/site/docs/page.md', assetMap, 'https://s.com/', '/site/build');
    expect('real image rewritten', out.includes('https://s.com/assets/images/logo-abc123.png'), out);
    expect('image inside code fence left as-is', out.includes('![example](./img/logo.png)'), out);
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total: ${passed + failed}\n`);
  return failed === 0;
}

run()
  .then(ok => { console.log(ok ? '🎉 All content-cleaning fence tests passed!' : '❌ Some tests failed.'); process.exit(ok ? 0 : 1); })
  .catch(err => { console.error('Test execution error:', err); process.exit(1); });
