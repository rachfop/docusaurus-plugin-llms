/**
 * Regressions found reviewing the 0.6.1 fixes:
 * - an HTML block tag on an indented line kept a list item's text on the
 *   item's indentation (it was turned into a newline at column 0, which ended
 *   the list item)
 * - `excludeImports` strips imports with a trailing comment or an import
 *   attribute (`with { type: 'json' }`)
 * - docs routes under the blog's routeBasePath stay matchable when the blog
 *   isn't included
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { cleanMarkdownContent } = require('../lib/content');
const docusaurusPluginLLMs = require('../lib/index.js').default;

let passed = 0;
let failed = 0;
const tempDirs = [];

function checkEqual(name, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

async function links(files, options, routesPaths) {
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-review-followups-'));
  tempDirs.push(siteDir);
  const outDir = path.join(siteDir, 'build');
  fs.mkdirSync(outDir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(siteDir, rel)), { recursive: true });
    fs.writeFileSync(path.join(siteDir, rel), content);
  }
  const plugin = docusaurusPluginLLMs(
    {
      siteDir,
      outDir,
      siteConfig: { title: 'T', tagline: 'TL', url: 'https://ex.com', baseUrl: '/' },
    },
    { logLevel: 'quiet', generateLLMsFullTxt: false, ...options },
  );
  await plugin.postBuild({ routesPaths, outDir });
  return fs
    .readFileSync(path.join(outDir, 'llms.txt'), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('- ['));
}

async function main() {
  console.log('Block tags inside list items');
  checkEqual(
    'tag at the start of an indented line keeps the indentation',
    cleanMarkdownContent('- item\n  <p>para</p>\n- next'),
    '- item\n  para\n- next',
  );
  checkEqual(
    'div inside a numbered step stays in the step',
    cleanMarkdownContent('1. Step one\n   <div>Detail text</div>\n2. Step two'),
    '1. Step one\n   Detail text\n2. Step two',
  );
  checkEqual(
    'mid-line break inside a list item continues on the item indentation',
    cleanMarkdownContent('- first<br/>second\n- next'),
    '- first\n  second\n- next',
  );
  checkEqual(
    'mid-line break in a paragraph still splits the line',
    cleanMarkdownContent('line one<br/>line two'),
    'line one\nline two',
  );

  checkEqual(
    'deeply indented HTML in a list item takes the item indentation',
    cleanMarkdownContent('1. Install\n\n              <p>Then restart.</p>\n2. Next'),
    '1. Install\n\n   Then restart.\n2. Next',
  );
  checkEqual(
    'indented HTML outside a list is not left as an indented code block',
    cleanMarkdownContent('<div>\n    <p>a</p>\n    <p>b</p>\n</div>'),
    'a\nb',
  );
  {
    const rows = Array.from({ length: 20000 }, (_, i) => `    <p>row ${i}</p>`).join('\n');
    const start = Date.now();
    cleanMarkdownContent(`<div>\n${rows}\n</div>`);
    const ms = Date.now() - start;
    checkEqual(`20,000 indented block tags clean in under 1s (${ms} ms)`, ms < 1000, true);
  }

  console.log('\nexcludeImports: trailing comments and import attributes');
  checkEqual(
    'import with a trailing line comment is removed',
    cleanMarkdownContent("import Foo from '@site/x'; // eslint-disable-line\n\nText", true),
    'Text',
  );
  checkEqual(
    'import with a block comment is removed',
    cleanMarkdownContent("import Foo from '@site/x'; /* used below */\n\nText", true),
    'Text',
  );
  checkEqual(
    'import with an import attribute is removed',
    cleanMarkdownContent("import d from './d.json' with { type: 'json' };\n\nText", true),
    'Text',
  );
  checkEqual(
    'prose starting with import is kept',
    cleanMarkdownContent('You need to\nimport the SDK first.', true),
    'You need to\nimport the SDK first.',
  );

  console.log('\nDocs routes under the blog base without includeBlog');
  const files = {
    'docs/blog/02-guides/orig.md': '---\nslug: /blog/custom-place\n---\n# Custom\n\nbody',
    'docs/blog/plain.md': '# Plain\n\nbody',
  };
  const routes = ['/', '/blog/custom-place', '/blog/plain'];
  const docsOnly = await links(files, { docsDir: [{ path: 'docs', routeBasePath: '/' }] }, routes);
  checkEqual(
    'docs-only site resolves docs under /blog/ to their routes',
    docsOnly.join('\n'),
    [
      '- [Custom](https://ex.com/blog/custom-place): body',
      '- [Plain](https://ex.com/blog/plain): body',
    ].join('\n'),
  );
  const withBlog = await links({ 'docs/install.md': '# Install\n\nbody' }, { includeBlog: true }, [
    '/blog/install',
    '/docs/install',
  ]);
  checkEqual(
    'with includeBlog, a docs file still never takes a blog route',
    withBlog.join('\n'),
    '- [Install](https://ex.com/docs/install): body',
  );
  const withoutBlog = await links({ 'docs/install.md': '# Install\n\nbody' }, {}, [
    '/blog/install',
    '/docs/install',
  ]);
  checkEqual(
    'without includeBlog, a docs file prefers its own section route',
    withoutBlog.join('\n'),
    '- [Install](https://ex.com/docs/install): body',
  );
}

main()
  .catch((err) => {
    console.log(`  FAIL: unexpected error: ${err && err.stack}`);
    failed++;
  })
  .finally(() => {
    for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });
