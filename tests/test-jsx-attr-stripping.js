/**
 * Tests that tag stripping is attribute-aware: `>` inside JSX expression
 * attributes (`onClick={() => ...}`) or quoted values (`title="a > b"`) must
 * not cut the tag short and leak fragments into the output.
 *
 * Run with: node tests/test-jsx-attr-stripping.js
 */

const assert = require('assert');
const { cleanMarkdownContent, resolvePartialImports } = require('../lib/utils');

let passed = 0;
let failed = 0;
function expect(name, cond, detail) {
  if (cond) { console.log(`  ✅ PASS: ${name}`); passed++; }
  else { console.log(`  ❌ FAIL: ${name}\n     ${detail}`); failed++; }
}

async function run() {
  console.log('Testing attribute-aware tag stripping...\n');

  // 1. Arrow function inside an HTML tag's attribute.
  {
    const input = 'Questions? <a href="#" onClick={() => openChat()}>Contact us</a> anytime.';
    const out = cleanMarkdownContent(input);
    expect('arrow fn in <a> attr: no fragment leaks', !out.includes('openChat') && !out.includes('>'), out);
    expect('arrow fn in <a> attr: inner text kept', out.includes('Contact us'), out);
  }

  // 2. Arrow function inside a JSX component's attribute.
  {
    const input = '<Button onClick={() => doThing()}>Click me</Button> to proceed.';
    const out = cleanMarkdownContent(input);
    expect('arrow fn in JSX attr: no fragment leaks', !out.includes('doThing') && !out.includes('>'), out);
    expect('arrow fn in JSX attr: inner text kept', out.includes('Click me'), out);
  }

  // 3. `>` inside a quoted attribute value.
  {
    const input = '<span title="a > b">threshold</span> note.';
    const out = cleanMarkdownContent(input);
    expect('`>` in quoted attr: tag fully removed', out.includes('threshold note.') && !out.includes('title='), out);
  }

  // 4. Attributes spread across multiple lines still match.
  {
    const input = ['<Admonition', '  type="tip"', '  onClick={() => open()}', '>', 'Body text.', '</Admonition>'].join('\n');
    const out = cleanMarkdownContent(input);
    expect('multiline tag stripped', out.trim() === 'Body text.', out);
  }

  // 5. Ceiling: a brace expression nested two levels deep fails to match and
  // the opening tag stays intact — visible leftover, not silent corruption.
  {
    const input = '<Button onClick={() => setState({a: {b: 1}})}>Go</Button>';
    const out = cleanMarkdownContent(input);
    expect('deeply nested braces: opening tag left intact', out.includes('onClick={() => setState({a: {b: 1}})}'), out);
    expect('deeply nested braces: inner text kept', out.includes('Go'), out);
  }

  // 6. Code fences still shield JSX with expression attributes.
  {
    const input = ['```jsx', '<a onClick={() => openChat()}>hi</a>', '```'].join('\n');
    const out = cleanMarkdownContent(input);
    expect('arrow-fn JSX preserved inside code fence', out.includes('<a onClick={() => openChat()}>hi</a>'), out);
  }

  // 7. Unresolvable partial usage with an expression attribute is removed
  // cleanly (same `[^>]*` flaw existed in resolvePartialImports).
  {
    const input = [
      "import Missing from './_missing.mdx';",
      '',
      '<Missing onClick={() => track()}>fallback</Missing>',
      '',
      'After.',
    ].join('\n');
    const out = await resolvePartialImports(input, '/nonexistent/dir/page.mdx');
    expect('missing partial with arrow-fn attr removed cleanly', !out.includes('track()') && out.includes('After.'), out);
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total: ${passed + failed}\n`);
  return failed === 0;
}

run()
  .then(ok => { console.log(ok ? '🎉 All attribute-aware stripping tests passed!' : '❌ Some tests failed.'); process.exit(ok ? 0 : 1); })
  .catch(err => { console.error('Test execution error:', err); process.exit(1); });
