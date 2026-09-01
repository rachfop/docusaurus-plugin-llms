/**
 * Tests for prop-content preservation in JSX stripping (#64):
 * - <TabItem> labels/values are emitted as bold lines before the tab body
 * - preserveComponents leaves named components' tags untouched
 *
 * Run with: node tests/test-preserve-components.js
 */

const assert = require('assert');
const { cleanMarkdownContent } = require('../lib/utils');

let passed = 0;
let failed = 0;
function expect(name, cond, detail) {
  if (cond) { console.log(`  ✅ PASS: ${name}`); passed++; }
  else { console.log(`  ❌ FAIL: ${name}\n     ${detail}`); failed++; }
}

function run() {
  console.log('Testing TabItem label emission and preserveComponents...\n');

  // 1. TabItem label prop is emitted as a bold line, tag stripped.
  {
    const input = [
      '<Tabs>',
      '<TabItem value="root" label="App root (global)">',
      '',
      'Wrap the app once.',
      '',
      '</TabItem>',
      '</Tabs>',
    ].join('\n');
    const out = cleanMarkdownContent(input);
    expect('label emitted as bold line', out.includes('**App root (global)**'), out);
    expect('tab body kept', out.includes('Wrap the app once.'), out);
    expect('TabItem tag itself stripped', !out.includes('TabItem'), out);
    expect('Tabs wrapper stripped', !out.includes('<Tabs>') && !out.includes('</Tabs>'), out);
  }

  // 2. TabItem with only a value prop falls back to value.
  {
    const input = '<TabItem value="npm">npm install x</TabItem>';
    const out = cleanMarkdownContent(input);
    expect('value fallback emitted', out.includes('**npm**'), out);
    expect('body kept', out.includes('npm install x'), out);
  }

  // 3. TabItem with neither label nor value vanishes cleanly.
  {
    const input = '<TabItem>Just a body.</TabItem>';
    const out = cleanMarkdownContent(input);
    expect('unlabeled TabItem: body kept, no stray bold', out.includes('Just a body.') && !out.includes('**'), out);
  }

  // 4. Multiple TabItems keep their order and pairing.
  {
    const input = [
      '<Tabs>',
      '<TabItem value="a" label="Option A">Alpha body.</TabItem>',
      '<TabItem value="b" label="Option B">Beta body.</TabItem>',
      '</Tabs>',
    ].join('\n');
    const out = cleanMarkdownContent(input);
    const a = out.indexOf('**Option A**');
    const alpha = out.indexOf('Alpha body.');
    const b = out.indexOf('**Option B**');
    const beta = out.indexOf('Beta body.');
    expect('labels precede their bodies in order',
      a !== -1 && a < alpha && alpha < b && b < beta,
      JSON.stringify({ a, alpha, b, beta, out }));
  }

  // 5. preserveComponents leaves the named component's tags untouched.
  {
    const input = '<PackageManagerTabs command="add my-package" />';
    const out = cleanMarkdownContent(input, false, false, ['PackageManagerTabs']);
    expect('preserved tag intact', out.includes('<PackageManagerTabs command="add my-package" />'), out);
  }

  // 6. preserveComponents is name-exact: other PascalCase tags still stripped.
  {
    const input = '<KeepMe>x</KeepMe> <StripMe>y</StripMe>';
    const out = cleanMarkdownContent(input, false, false, ['KeepMe']);
    expect('named component kept', out.includes('<KeepMe>x</KeepMe>'), out);
    expect('unnamed component still stripped', !out.includes('StripMe') && out.includes('y'), out);
  }

  // 7. Closing tags of preserved components are also kept.
  {
    const input = '<KeepMe>inner</KeepMe>';
    const out = cleanMarkdownContent(input, false, false, ['KeepMe']);
    expect('closing tag of preserved component kept', out === '<KeepMe>inner</KeepMe>', out);
  }

  // 8. TabItem emission does not apply when the tag sits inside a code fence.
  {
    const input = ['```jsx', '<TabItem label="X">body</TabItem>', '```'].join('\n');
    const out = cleanMarkdownContent(input);
    expect('fenced TabItem untouched', out.includes('<TabItem label="X">body</TabItem>'), out);
  }

  // 9. Label containing an inline code span survives.
  {
    const input = '<TabItem label="Use `npm install` here">body</TabItem>';
    const out = cleanMarkdownContent(input);
    expect('label with code span emitted', out.includes('**Use `npm install` here**'), out);
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total: ${passed + failed}\n`);
  return failed === 0;
}

const ok = run();
console.log(ok ? '🎉 All preserveComponents tests passed!' : '❌ Some tests failed.');
process.exit(ok ? 0 : 1);
