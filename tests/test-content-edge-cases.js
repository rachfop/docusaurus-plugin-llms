/**
 * Content edge cases:
 * - empty and unclosed fenced code blocks are masked, so cleaning (HTML strip,
 *   import removal, JSX strip, partial resolution) leaves their content as
 *   written
 * - `<img src={require('./x.png').default} />` and other literal brace `src`
 *   values become markdown images
 * - `@site/...` image paths are rewritten like Docusaurus resolves them
 * - a front matter description whose first line opens a code span or link
 *   that closes on a later line keeps the TOC line balanced
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { cleanMarkdownContent, resolvePartialImports } = require('../lib/content');
const { rewriteRelativeImageUrls } = require('../lib/images');
const { processMarkdownFile } = require('../lib/processor');
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

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-content-edge-cases-'));
  tempDirs.push(dir);
  return dir;
}

function writeFiles(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
}

async function links(files) {
  const siteDir = tempDir();
  const outDir = path.join(siteDir, 'build');
  fs.mkdirSync(outDir, { recursive: true });
  writeFiles(siteDir, files);
  const plugin = docusaurusPluginLLMs(
    {
      siteDir,
      outDir,
      siteConfig: { title: 'T', tagline: 'TL', url: 'https://ex.com', baseUrl: '/' },
    },
    { logLevel: 'quiet', generateLLMsFullTxt: false },
  );
  await plugin.postBuild({ outDir });
  return fs
    .readFileSync(path.join(outDir, 'llms.txt'), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('- ['));
}

async function main() {
  console.log('Empty fenced code blocks');
  checkEqual(
    'empty ``` block between prose is masked',
    cleanMarkdownContent('Before <b>x</b>\n\n```\n```\n\nAfter <span>y</span>\n\n```\nz\n```'),
    'Before x\n\n```\n```\n\nAfter y\n\n```\nz\n```',
  );
  checkEqual(
    'empty ```js block does not pair with a later fence',
    cleanMarkdownContent('```js\n```\n\nText <b>bold</b>\n\n```\n<div>code</div>\n```'),
    '```js\n```\n\nText bold\n\n```\n<div>code</div>\n```',
  );
  checkEqual(
    'empty ~~~ block does not pair with a later fence',
    cleanMarkdownContent('~~~\n~~~\n\nText <b>bold</b>\n\n~~~\n<div>code</div>\n~~~'),
    '~~~\n~~~\n\nText bold\n\n~~~\n<div>code</div>\n~~~',
  );

  console.log('Unclosed fenced code blocks');
  checkEqual(
    'unclosed ``` keeps HTML to the end of the document',
    cleanMarkdownContent('Intro <b>x</b>\n\n```html\n<div class="a">\n  <span>hi</span>\n</div>'),
    'Intro x\n\n```html\n<div class="a">\n  <span>hi</span>\n</div>',
  );
  checkEqual(
    'unclosed ~~~ keeps imports with excludeImports',
    cleanMarkdownContent("Text\n\n~~~js\nimport x from 'y';\nx();", true),
    "Text\n\n~~~js\nimport x from 'y';\nx();",
  );
  checkEqual(
    'unclosed ``` keeps JSX component tags',
    cleanMarkdownContent('Text\n\n```jsx\n<Tabs>\n  <TabItem value="a">A</TabItem>\n</Tabs>'),
    'Text\n\n```jsx\n<Tabs>\n  <TabItem value="a">A</TabItem>\n</Tabs>',
  );
  checkEqual(
    'unclosed ``` swallows a later closed ~~~ block whole',
    cleanMarkdownContent('```\n<b>a</b>\n~~~\n<i>b</i>\n~~~'),
    '```\n<b>a</b>\n~~~\n<i>b</i>\n~~~',
  );
  checkEqual(
    'unclosed fence in a list item ends with the item',
    cleanMarkdownContent('- Step\n\n  ```sh\n  <b>cmd</b>\n\nAfter <b>bold</b>'),
    '- Step\n\n  ```sh\n  <b>cmd</b>\n\nAfter bold',
  );
  checkEqual(
    'unclosed fence in a blockquote ends with the blockquote',
    cleanMarkdownContent('> ```\n> <b>q</b>\n\nAfter <b>bold</b>'),
    '> ```\n> <b>q</b>\n\nAfter bold',
  );
  checkEqual(
    'a line of inline code is not an unclosed fence',
    cleanMarkdownContent('```a``` then <b>b</b>\n\nMore <i>c</i>'),
    '```a``` then b\n\nMore c',
  );
  checkEqual(
    'closed blockquoted fence still masked',
    cleanMarkdownContent('> ```\n> <b>q</b>\n> ```\n\nAfter <b>bold</b>'),
    '> ```\n> <b>q</b>\n> ```\n\nAfter bold',
  );
  checkEqual(
    'nested fence (```` around ```) still masked',
    cleanMarkdownContent('````md\n```\n<b>x</b>\n```\n````\n\n<b>y</b>'),
    '````md\n```\n<b>x</b>\n```\n````\n\ny',
  );
  {
    const dir = tempDir();
    writeFiles(dir, { '_p.mdx': 'Partial body.' });
    const doc = path.join(dir, 'doc.mdx');
    checkEqual(
      'partial usage inside an unclosed fence is not resolved',
      await resolvePartialImports(
        "import P from './_p.mdx';\n\n<P />\n\n```mdx\nimport P from './_p.mdx';\n<P />",
        doc,
        new Set(),
        dir,
      ),
      "\n\nPartial body.\n\n```mdx\nimport P from './_p.mdx';\n<P />",
    );
  }

  console.log('JSX img src expressions');
  checkEqual(
    "src={require('./img/x.png').default}",
    cleanMarkdownContent(`<img src={require('./img/x.png').default} alt="X" />`),
    '![X](./img/x.png)',
  );
  checkEqual(
    'src={require("./x.png")}',
    cleanMarkdownContent('<img alt="Y" src={require("./x.png")} />'),
    '![Y](./x.png)',
  );
  checkEqual(
    'src={"./x.png"}',
    cleanMarkdownContent('<img src={"./x.png"} alt="Z" />'),
    '![Z](./x.png)',
  );
  checkEqual("src={'./x.png'}", cleanMarkdownContent("<img src={'./x.png'} />"), '![](./x.png)');
  checkEqual(
    'src={`./x.png`}',
    cleanMarkdownContent('<img src={`./x.png`} alt="T" />'),
    '![T](./x.png)',
  );
  checkEqual(
    'src={`${base}/x.png`} (interpolated) is dropped',
    cleanMarkdownContent('Text <img src={`${base}/x.png`} /> end'),
    'Text  end',
  );
  checkEqual(
    'src={variable} is dropped',
    cleanMarkdownContent('Text <img src={logo} /> end'),
    'Text  end',
  );

  console.log('@site image paths');
  {
    const siteDir = tempDir();
    const outDir = path.join(siteDir, 'build');
    const hash = 'abcdef0123456789';
    writeFiles(siteDir, {
      'docs/img/x.png': 'XPNG',
      'static/img/s.png': 'SPNG',
      'static/img/big.png': 'BIG',
      [`build/assets/images/x-${hash}.png`]: 'XPNG',
      [`build/assets/images/big-${hash}.png`]: 'BIG',
      'build/img/s.png': 'SPNG',
      'build/img/big.png': 'BIG',
      'docs/doc.md': '',
    });
    const map = new Map([
      ['x.png', [`/assets/images/x-${hash}.png`]],
      ['big.png', [`/assets/images/big-${hash}.png`]],
    ]);
    const rewrite = (content) =>
      rewriteRelativeImageUrls(
        content,
        path.join(siteDir, 'docs/doc.md'),
        map,
        'https://ex.com/base/',
        outDir,
        siteDir,
      );
    checkEqual(
      '@site/<non-static> path resolves to the bundled asset',
      await rewrite('![a](@site/docs/img/x.png)'),
      `![a](https://ex.com/base/assets/images/x-${hash}.png)`,
    );
    checkEqual(
      '@site/static/<p> bundled asset wins (Docusaurus bundles markdown images)',
      await rewrite('![b](@site/static/img/big.png)'),
      `![b](https://ex.com/base/assets/images/big-${hash}.png)`,
    );
    checkEqual(
      '@site/static/<p> with no bundled asset is served at <baseUrl><p>',
      await rewrite('![c](@site/static/img/s.png)'),
      '![c](https://ex.com/base/img/s.png)',
    );
    checkEqual(
      'missing @site image left unchanged',
      await rewrite('![d](@site/static/img/missing.png)'),
      '![d](@site/static/img/missing.png)',
    );
    checkEqual(
      '@site image in code left unchanged',
      await rewrite('`![e](@site/docs/img/x.png)`'),
      '`![e](@site/docs/img/x.png)`',
    );
    writeFiles(siteDir, { 'docs/page.md': '# Page\n\n![a](@site/docs/img/x.png)\n' });
    const doc = await processMarkdownFile(
      path.join(siteDir, 'docs/page.md'),
      path.join(siteDir, 'docs'),
      'https://ex.com/base/',
      'docs',
      { imageAssetMap: map, outDir, siteDir },
    );
    checkEqual(
      'processMarkdownFile passes siteDir to the rewrite',
      doc.content,
      `# Page\n\n![a](https://ex.com/base/assets/images/x-${hash}.png)`,
    );
  }

  console.log('TOC description with a span closing on a later line');
  {
    const lines = await links({
      'docs/code.md':
        '---\ntitle: Code\ndescription: |\n  Split-K pass 2: every partition owns the band `x\n  y` here.\n---\n\nBody.\n',
      'docs/link.md':
        '---\ntitle: Link\ndescription: |\n  See the [guide\n  page](./guide.md) for details.\n---\n\nBody.\n',
      'docs/plain.md':
        '---\ntitle: Plain\ndescription: |\n  First line `ok` here.\n  Second line.\n---\n\nBody.\n',
    });
    const line = (title) => lines.find((l) => l.startsWith(`- [${title}]`));
    checkEqual(
      'dangling code span dropped, ellipsis appended',
      line('Code'),
      '- [Code](https://ex.com/docs/code): Split-K pass 2: every partition owns the band...',
    );
    checkEqual(
      'dangling link opener dropped, ellipsis appended',
      line('Link'),
      '- [Link](https://ex.com/docs/link): See the...',
    );
    checkEqual(
      'balanced first line unchanged',
      line('Plain'),
      '- [Plain](https://ex.com/docs/plain): First line `ok` here.',
    );
  }

  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
