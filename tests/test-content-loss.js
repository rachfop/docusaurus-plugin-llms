/**
 * Regression tests for content loss and code-sample damage during cleaning
 * and partial resolution:
 *
 * - prose lines that begin with "import " were deleted from inlined partials
 *   and, with excludeImports, from pages; multi-line imports were half-removed
 * - nested partial resolution ran on unmasked content, so a partial's code
 *   sample showing partial usage was emptied or spliced
 * - one partial's body was spliced into another partial's code sample
 * - attribute runs backtracked exponentially on long JSX tags
 * - HTML tags were removed with no separator, and <img> was dropped
 * - nested fences (```` around ```) and blockquoted fences were not masked
 * - descriptions came from code comments and MDX comments; comments survived
 *   cleaning
 * - `{ default as X }` / `Y, { z }` partial imports and partials used with
 *   children were not inlined
 *
 * Run with: node tests/test-content-loss.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { cleanMarkdownContent } = require('../lib/content');
const { processMarkdownFile } = require('../lib/processor');

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(
      `  FAIL: ${name}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`,
    );
    failed++;
  }
}

function checkTrue(name, condition, detail) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}${detail ? `\n     ${detail}` : ''}`);
    failed++;
  }
}

const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-content-loss-'));
const docsDir = path.join(siteDir, 'docs');
fs.mkdirSync(docsDir, { recursive: true });

/** Write `files` into docs/, then process `<name>.mdx` with `main` as its body. */
async function processPage(name, main, files = {}, opts = {}) {
  for (const [f, s] of Object.entries(files)) {
    fs.writeFileSync(path.join(docsDir, f), s);
  }
  const filePath = path.join(docsDir, `${name}.mdx`);
  fs.writeFileSync(filePath, main);
  return processMarkdownFile(filePath, docsDir, 'https://x.com', 'docs', { siteDir, ...opts });
}

async function run() {
  console.log('Testing content loss and code-sample damage...\n');

  console.log('Bug 1: prose starting with "import" in inlined partials');
  {
    const r = await processPage('b1', "import S from './_s.mdx';\n\n# P\n\n<S />\n", {
      '_s.mdx': 'Before calling the API you need to\nimport the SDK and configure a client.\n',
    });
    check(
      'wrapped prose line kept',
      r.content,
      '# P\n\nBefore calling the API you need to\nimport the SDK and configure a client.',
    );
    const r2 = await processPage('b1b', "import T from './_t.mdx';\n\n# P\n\n<T />\n", {
      '_t.mdx':
        "import Tabs from '@theme/Tabs';\nimport {\n  A,\n  B,\n} from '@site/src/x';\nimport './styles.css';\n\nBody.\n",
    });
    check('partial import statements (incl. multi-line) stripped', r2.content, '# P\n\nBody.');
  }

  console.log('\nBug 2: excludeImports');
  check(
    'wrapped prose line kept',
    cleanMarkdownContent('To use it, you first need to\nimport the module and then call it.', true),
    'To use it, you first need to\nimport the module and then call it.',
  );
  check(
    'multi-line import fully removed',
    cleanMarkdownContent("import {\n  Foo,\n  Bar,\n} from '@site/x';\n\nText", true),
    'Text',
  );
  check(
    'default, namespace and side-effect imports removed',
    cleanMarkdownContent(
      "import Foo from 'foo';\nimport * as ns from \"ns\"\nimport Def, { a, b } from './c';\nimport './s.css';\n\nText",
      true,
    ),
    'Text',
  );

  console.log('\nBug 3: nested partial code samples');
  {
    const fence = "```mdx\nimport Snippet from './_snippet.mdx';\n\n<Snippet />\n```";
    const r = await processPage(
      'b3',
      "import Guide from './_guide.mdx';\n\n# Page\n\n<Guide />\n",
      {
        '_guide.mdx': `Reuse content like this:\n\n${fence}\n`,
        '_snippet.mdx': 'SNIPPET BODY\n',
      },
    );
    check(
      'fence in nested partial kept (resolvable target)',
      r.content,
      `# Page\n\nReuse content like this:\n\n${fence}`,
    );
    const missingFence = "```mdx\nimport Gone from './_gone.mdx';\n\n<Gone />\n```";
    const r2 = await processPage('b3b', "import G from './_guide2.mdx';\n\n# Page\n\n<G />\n", {
      '_guide2.mdx': `Example:\n\n${missingFence}\n`,
    });
    check(
      'fence in nested partial kept (missing target)',
      r2.content,
      `# Page\n\nExample:\n\n${missingFence}`,
    );
  }

  console.log("\nBug 4: one partial spliced into another partial's code sample");
  {
    const r = await processPage(
      'b4',
      "import A from './_a4.mdx';\nimport B from './_b4.mdx';\n\n# P\n\n<A />\n\n<B />\n",
      { '_a4.mdx': 'Usage:\n\n```jsx\n<B />\n```\n', '_b4.mdx': 'B BODY' },
    );
    check('fence keeps <B />', r.content, '# P\n\nUsage:\n\n```jsx\n<B />\n```\n\nB BODY');
  }

  console.log('\nBug 5: attribute-run backtracking');
  {
    const n = 40;
    const attrs = Array.from({ length: n }, (_, i) => `  prop${i}={${i}}`).join('\n');
    const deep = `# API\n\n<ApiTable\n${attrs}\n  render={(row) => { if (row) { return {a: 1}; } }}\n/>\n`;
    // Child process with a hard timeout: a backtracking regex never returns,
    // so timing it in-process would hang the suite instead of failing it.
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        `const { cleanMarkdownContent } = require(${JSON.stringify(path.join(__dirname, '../lib/content'))});
         const s = ${JSON.stringify(deep)};
         const t = Date.now(); cleanMarkdownContent(s); console.log(Date.now() - t);`,
      ],
      { timeout: 5000, encoding: 'utf8' },
    );
    const ms = child.error ? Infinity : Number(child.stdout.trim());
    checkTrue(
      `${n} attrs + deep brace finishes < 200ms`,
      ms < 200,
      child.error ? 'killed after 5s' : `took ${ms}ms`,
    );
    check(
      `${n} brace attrs stripped`,
      cleanMarkdownContent(`# API\n\n<ApiTable\n${attrs}\n/>\n`),
      '# API',
    );
    check(
      'bare, quoted and brace values still stripped',
      cleanMarkdownContent('<Box a=1 b="x > y" c=\'z\' d={{k: 1}} e>text</Box>'),
      'text',
    );
  }

  console.log('\nBug 6: HTML tag separators and <img>');
  check('br becomes newline', cleanMarkdownContent('line one<br/>line two'), 'line one\nline two');
  check(
    'table cells separated',
    cleanMarkdownContent('<table><tr><td>a</td><td>b</td></tr></table>'),
    'a | b',
  );
  check(
    'table rows on separate lines',
    cleanMarkdownContent(
      '<table><tr><th>k</th><th>v</th></tr><tr><td>a</td><td>b</td></tr></table>',
    ),
    'k | v\na | b',
  );
  check('p/div boundaries', cleanMarkdownContent('<div>one</div><p>two</p>'), 'one\ntwo');
  check('li boundaries', cleanMarkdownContent('<ul><li>x</li><li>y</li></ul>'), 'x\ny');
  check('inline tags join', cleanMarkdownContent('a <b>bold</b> word'), 'a bold word');
  check(
    'img becomes markdown image',
    cleanMarkdownContent('<img src="./diagram.png" alt="Architecture" />'),
    '![Architecture](./diagram.png)',
  );
  check('img without alt', cleanMarkdownContent("<img src='./d.png'>"), '![](./d.png)');
  {
    const imageAssetMap = new Map([['diagram.png', ['/assets/images/diagram-abc.png']]]);
    const r = await processPage(
      'b6',
      '# P\n\n<img src="./diagram.png" alt="Architecture" />\n',
      {},
      { imageAssetMap, outDir: path.join(siteDir, 'build') },
    );
    check(
      'img src is rewritten to the build asset',
      r.content,
      '# P\n\n![Architecture](https://x.com/assets/images/diagram-abc.png)',
    );
  }

  console.log('\nBug 7: fence masking');
  {
    const nested = '````md\nExample:\n```\n<div>x</div>\n```\n````';
    check(
      'nested fence untouched',
      cleanMarkdownContent(`${nested}\n\nAfter <b>bold</b>`),
      `${nested}\n\nAfter bold`,
    );
    const longer = '```\n<div>a</div>\n````\n\n<b>z</b>';
    check(
      'longer closing fence closes',
      cleanMarkdownContent(longer),
      '```\n<div>a</div>\n````\n\nz',
    );
    const tilde = '~~~~\n~~~\n<div>a</div>\n~~~\n~~~~\n\n<b>z</b>';
    check(
      'nested tilde fence untouched',
      cleanMarkdownContent(tilde),
      '~~~~\n~~~\n<div>a</div>\n~~~\n~~~~\n\nz',
    );
    const bq = '> ```html\n> <div>x</div>\n> ```';
    check('blockquoted fence untouched', cleanMarkdownContent(`${bq}\n\n<b>y</b>`), `${bq}\n\ny`);
  }

  console.log('\nBug 8: descriptions and comments');
  {
    const r = await processPage('b8a', '## Setup\n\n```bash\n# install deps\nnpm i\n```\n');
    check('no description from a code comment', r.description, '');
    const r2 = await processPage('b8b', '# T\n\n{/* TODO: rewrite */}\n\nReal summary.\n');
    check('MDX comment skipped for description', r2.description, 'Real summary.');
    check('MDX comment stripped from content', r2.content, '# T\n\nReal summary.');
    check(
      'MDX and HTML comments stripped',
      cleanMarkdownContent('A\n\n{/* internal note */}\n\n<!-- truncate -->\n\nB'),
      'A\n\nB',
    );
    check(
      'inline and multi-line comments stripped',
      cleanMarkdownContent('A {/* x */}B\n\n<!--\nmulti\nline\n-->\n\nC'),
      'A B\n\nC',
    );
    const code = '```js\n{/* keep */}\n<!-- keep -->\n```\n\nUse `<!-- x -->` here.';
    check('comments inside code kept', cleanMarkdownContent(code), code);
  }

  console.log('\nIndented HTML leaves no runs of blank lines');
  {
    check(
      'indented block tags collapse to one blank line',
      cleanMarkdownContent('<div>\n    <p>a</p>\n    \n    <p>b</p>\n</div>'),
      'a\n\nb',
    );
    const code = '```\na\n   \n\n\nb\n```';
    check('whitespace lines inside code kept', cleanMarkdownContent(code), code);
  }

  console.log('\nBug 9: partial import forms and children');
  {
    const r = await processPage(
      'b9',
      "import { default as X } from './_x9.mdx';\nimport Y, { z } from './_y9.mdx';\n\n# P\n\nText\n\n<X />\n\n<Y />\n",
      { '_x9.mdx': 'X BODY', '_y9.mdx': 'Y BODY' },
    );
    check(
      'default-as and default+named imports inlined',
      r.content,
      '# P\n\nText\n\nX BODY\n\nY BODY',
    );
    const r2 = await processPage(
      'b9b',
      "import P from './_p9.mdx';\n\n# Page\n\nIntro text.\n\n<P>\n  <b>x</b>\n</P>\n",
      { '_p9.mdx': 'Partial body.' },
    );
    check(
      'partial with element children inlined',
      r2.content,
      '# Page\n\nIntro text.\n\nPartial body.',
    );
    const r3 = await processPage(
      'b9c',
      "import Wrap from './_wrap9.mdx';\n\n# Page\n\n<Wrap>\n  Child text.\n</Wrap>\n",
      { '_wrap9.mdx': 'Before.\n\n{props.children}\n\nAfter.' },
    );
    check(
      'children rendered by {props.children} kept',
      r3.content,
      '# Page\n\nBefore.\n\nChild text.\n\nAfter.',
    );
  }
}

run()
  .catch((err) => {
    console.log(`  FAIL: unexpected error: ${err && err.stack}`);
    failed++;
  })
  .finally(() => {
    fs.rmSync(siteDir, { recursive: true, force: true });
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });
