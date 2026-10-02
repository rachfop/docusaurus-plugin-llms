/**
 * Small output-correctness fixes:
 * - preserveComponents protects components named like HTML tags (<Table>) and
 *   <TabItem>
 * - TabItem label extraction: `label={"x"}` unwraps the string literal, and
 *   `data-label` is never read as `label`
 * - titles are escaped in llms.txt link text and kept on one line in headings
 * - TOC descriptions taken from a hard-wrapped first paragraph keep the whole
 *   paragraph (joined with spaces) before truncation
 * - blog posts get their own heading when docs sections have headings
 * - useRelativeUrls / rewriteImageUrls / warnOnIgnoredFiles must be booleans
 * - each plugin instance logs at its own logLevel
 * - duplicate llms-full.txt headers get a space before the suffix
 * - relative image paths without `./`, in angle brackets, or percent-encoded
 *   are rewritten
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const docusaurusPluginLLMs = require('../lib/index.js').default;
const { cleanMarkdownContent } = require('../lib/content.js');
const { rewriteRelativeImageUrls } = require('../lib/images.js');

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}${detail ? `\n     ${detail}` : ''}`);
    failed++;
  }
}

function checkEqual(name, actual, expected) {
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}\n     got      ${JSON.stringify(actual)}`,
  );
}

const tempDirs = [];

function makeSite(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-small-fixes-'));
  tempDirs.push(root);
  const siteDir = path.join(root, 'site');
  const outDir = path.join(siteDir, 'build');
  fs.mkdirSync(outDir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(siteDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return { siteDir, outDir };
}

function createPlugin(site, options) {
  return docusaurusPluginLLMs(
    {
      siteDir: site.siteDir,
      outDir: site.outDir,
      siteConfig: { title: 'T', tagline: 'TL', url: 'https://ex.com', baseUrl: '/' },
    },
    options,
  );
}

/** Build a site from `files`, run postBuild, and return a reader over outDir. */
async function runSite(files, options = {}, routesPaths) {
  const site = makeSite(files);
  const plugin = createPlugin(site, { logLevel: 'quiet', ...options });
  await plugin.postBuild(routesPaths ? { routesPaths } : {});
  return { read: (rel) => fs.readFileSync(path.join(site.outDir, rel), 'utf8') };
}

function initError(options) {
  try {
    createPlugin(
      { siteDir: '/tmp/llms-small-fixes', outDir: '/tmp/llms-small-fixes/build' },
      options,
    );
    return null;
  } catch (err) {
    return err.message;
  }
}

async function main() {
  // 1. preserveComponents for HTML-named components and TabItem.
  console.log('preserveComponents');
  checkEqual(
    "<Table> is kept when 'Table' is preserved",
    cleanMarkdownContent('<Table rows={3}>x</Table>', false, false, ['Table']),
    '<Table rows={3}>x</Table>',
  );
  checkEqual(
    '<Tabs>/<TabItem> are kept when both are preserved',
    cleanMarkdownContent('<Tabs><TabItem value="a" label="A">x</TabItem></Tabs>', false, false, [
      'TabItem',
      'Tabs',
    ]),
    '<Tabs><TabItem value="a" label="A">x</TabItem></Tabs>',
  );
  checkEqual(
    '<Tabs> alone preserved: TabItem still becomes a label line',
    cleanMarkdownContent('<Tabs><TabItem value="a" label="A">x</TabItem></Tabs>', false, false, [
      'Tabs',
    ]),
    '<Tabs>\n\n**A**\n\nx</Tabs>',
  );
  checkEqual(
    '<Table> without preserve is stripped to its text',
    cleanMarkdownContent('<Table rows={3}>x</Table>'),
    'x',
  );
  checkEqual(
    'lowercase HTML <table> is still stripped',
    cleanMarkdownContent('<table><tr><td>a</td><td>b</td></tr></table>'),
    'a | b',
  );

  // 2. TabItem label extraction.
  console.log('TabItem labels');
  checkEqual(
    'label={"Python"} unwraps the string literal',
    cleanMarkdownContent('<TabItem value="py" label={"Python"}>x</TabItem>'),
    '**Python**\n\nx',
  );
  checkEqual(
    "label={'Python'} unwraps the string literal",
    cleanMarkdownContent('<TabItem value="py" label={\'Python\'}>x</TabItem>'),
    '**Python**\n\nx',
  );
  checkEqual(
    'label={`Python`} unwraps the template literal',
    cleanMarkdownContent('<TabItem value="py" label={`Python`}>x</TabItem>'),
    '**Python**\n\nx',
  );
  checkEqual(
    'data-label is not read as label',
    cleanMarkdownContent('<TabItem data-label="nope" value="py" label="Python">x</TabItem>'),
    '**Python**\n\nx',
  );
  checkEqual(
    'data-value is not read as the value fallback',
    cleanMarkdownContent('<TabItem data-value="nope" value="py">x</TabItem>'),
    '**py**\n\nx',
  );

  // 3 + 4. Titles and descriptions in llms.txt / llms-full.txt.
  console.log('titles and descriptions');
  {
    const r = await runSite({
      'docs/a.md': '---\ntitle: "Close ] bracket"\ndescription: "line1"\n---\nbody',
      'docs/b.md': '---\ntitle: "Multi\\nLine title"\n---\nbody',
      'docs/c.md': '---\ntitle: "[Link](http://evil)"\n---\nbody',
      'docs/d.md': '---\ntitle: "Back\\\\slash"\n---\nbody',
      'docs/e.md': '---\ntitle: Spaced (normal)\n---\nbody',
      'docs/f.md':
        '# Wrapped\n\nThis page collects recommended option combinations for common\ndocumentation shapes.\n\nSecond paragraph.',
      'docs/g.md': '---\ntitle: Folded\ndescription: "first line\\nsecond line"\n---\nbody',
      'docs/h.md': '---\ntitle: Tabs\ndescription: "a\\tb  c"\n---\nbody',
      'docs/i.md': `# Long\n\n${'word '.repeat(20).trim()}\n${'more '.repeat(30).trim()}`,
    });
    const txt = r.read('llms.txt');
    const full = r.read('llms-full.txt');
    const lines = txt.split('\n');
    const has = (line) => lines.includes(line);
    check(
      'title with ] is escaped in link text',
      has('- [Close \\] bracket](https://ex.com/docs/a): line1'),
      txt,
    );
    check(
      'multi-line title is collapsed onto the link line',
      has('- [Multi Line title](https://ex.com/docs/b): body'),
      txt,
    );
    check(
      'title with link syntax is escaped in link text',
      has('- [\\[Link\\](http://evil)](https://ex.com/docs/c): body'),
      txt,
    );
    check(
      'title with backslash is escaped in link text',
      has('- [Back\\\\slash](https://ex.com/docs/d): body'),
      txt,
    );
    check(
      'normal title is unchanged',
      has('- [Spaced (normal)](https://ex.com/docs/e): body'),
      txt,
    );
    check(
      'hard-wrapped first paragraph is joined in the TOC description',
      has(
        '- [Wrapped](https://ex.com/docs/f): This page collects recommended option combinations for common documentation shapes.',
      ),
      txt,
    );
    check(
      'front matter description keeps its first line',
      has('- [Folded](https://ex.com/docs/g): first line'),
      txt,
    );
    check(
      'front matter description whitespace is normalized',
      has('- [Tabs](https://ex.com/docs/h): a b c'),
      txt,
    );
    const longDesc = `${'word '.repeat(20)}${'more '.repeat(30).trim()}`;
    check(
      'joined paragraph is truncated to 150 characters',
      has(`- [Long](https://ex.com/docs/i): ${longDesc.substring(0, 147)}...`),
      txt,
    );
    check(
      'multi-line title is one ## heading in llms-full.txt',
      full.split('\n').includes('## Multi Line title'),
      full,
    );
    check(
      'llms-full.txt headings keep brackets as written',
      full.split('\n').includes('## Close ] bracket') &&
        full.split('\n').includes('## [Link](http://evil)'),
      full,
    );
  }

  {
    const r = await runSite(
      { 'docs/b.md': '---\ntitle: "Multi\\nLine title"\n---\nbody' },
      { generateMarkdownFiles: true, generateLLMsFullTxt: false },
    );
    checkEqual(
      'multi-line title is one # heading in the generated markdown file',
      r.read('docs/b.md'),
      '# Multi Line title\n\n> body\n',
    );
  }

  // 5. Blog posts under their own heading with multiple docs sections.
  console.log('blog heading');
  {
    const r = await runSite(
      {
        'api/a.md': '# API A\n\na',
        'guide/m.md': '# Guide M\n\nm',
        'blog/2024-01-01-post.md': '---\ntitle: Post\n---\nblog body',
      },
      {
        generateLLMsFullTxt: false,
        includeBlog: true,
        docsDir: [
          { path: 'api', routeBasePath: 'api' },
          { path: 'guide', routeBasePath: 'guide' },
        ],
      },
    );
    const txt = r.read('llms.txt');
    check(
      'blog posts get a ## Blog heading',
      txt.includes(
        '## guide\n\n- [Guide M](https://ex.com/guide/m): m\n\n## Blog\n\n- [Post](https://ex.com/blog/2024-01-01-post): blog body',
      ),
      txt,
    );

    const single = await runSite(
      {
        'docs/a.md': '# A\n\na',
        'blog/2024-01-01-post.md': '---\ntitle: Post\n---\nblog body',
      },
      { generateLLMsFullTxt: false, includeBlog: true },
    );
    const singleTxt = single.read('llms.txt');
    check(
      'single docs section keeps one Table of Contents list',
      singleTxt.includes(
        '## Table of Contents\n\n- [A](https://ex.com/docs/a): a\n- [Post](https://ex.com/blog/2024-01-01-post): blog body',
      ) && !singleTxt.includes('## Blog'),
      singleTxt,
    );
  }

  // 6. Boolean option validation.
  console.log('boolean options');
  for (const option of ['useRelativeUrls', 'rewriteImageUrls', 'warnOnIgnoredFiles']) {
    const err = initError({ [option]: 'false' });
    check(`${option}: 'false' is rejected`, err === `${option} must be a boolean`, `error: ${err}`);
    check(`${option}: false is accepted`, initError({ [option]: false }) === null);
  }

  // 7. logLevel per plugin instance, including concurrent postBuild runs.
  console.log('logLevel per instance');
  {
    const files = { 'docs/a.md': '# A\n\na' };
    const quietSite = makeSite(files);
    const normalSite = makeSite(files);
    const quiet = createPlugin(quietSite, { logLevel: 'quiet' });
    const normal = createPlugin(normalSite, { logLevel: 'normal' });

    const lines = [];
    const original = { log: console.log, warn: console.warn };
    console.log = (...args) => lines.push(args.join(' '));
    console.warn = (...args) => lines.push(args.join(' '));
    try {
      await quiet.postBuild({});
      await Promise.all([quiet.postBuild({}), normal.postBuild({})]);
    } finally {
      console.log = original.log;
      console.warn = original.warn;
    }
    check(
      'quiet instance prints nothing',
      !lines.some((l) => l.includes(quietSite.outDir)),
      JSON.stringify(lines.filter((l) => l.includes(quietSite.outDir))),
    );
    check(
      'normal instance still prints its output',
      lines.some((l) => l.includes(`Generated: ${path.join(normalSite.outDir, 'llms.txt')}`)),
      JSON.stringify(lines),
    );
  }

  // 8. Header de-duplication spacing in llms-full.txt.
  console.log('header de-duplication');
  {
    const r = await runSite(
      {
        'docs/setup/guide.md': '---\ntitle: Guide\n---\nx',
        'docs/install/guide.md': '---\ntitle: Guide\n---\ny',
        'docs/install/guide2.md': '---\ntitle: Guide\n---\nz',
        'docs/intro1.md': '---\ntitle: Intro\n---\n1',
        'docs/intro2.md': '---\ntitle: Intro\n---\n2',
        'docs/intro3.md': '---\ntitle: Intro\n---\n3',
      },
      { generateLLMsTxt: false },
    );
    const headers = r.read('llms-full.txt').match(/^## .*/gm) || [];
    checkEqual(
      'duplicate headers get " (Folder)" / " (N)" suffixes',
      JSON.stringify(headers),
      JSON.stringify([
        '## Guide',
        '## Guide (Install)',
        '## Intro',
        '## Intro (Docs)',
        '## Intro (3)',
        '## Guide (Setup)',
      ]),
    );
  }

  // 9. Relative image URL forms.
  console.log('image URLs');
  {
    const map = new Map([
      ['foo.png', ['/assets/images/foo-0123456789abcdef.png']],
      ['my img.png', ['/assets/images/my img-0123456789abcdef.png']],
    ]);
    const src = '/site/docs/page.md';
    const rw = (content) => rewriteRelativeImageUrls(content, src, map, 'https://ex.com', '/out');
    checkEqual(
      'path without ./ is rewritten',
      await rw('![a](img/foo.png)'),
      '![a](https://ex.com/assets/images/foo-0123456789abcdef.png)',
    );
    checkEqual(
      'path without ./ keeps its title',
      await rw('![a](img/foo.png "Title")'),
      '![a](https://ex.com/assets/images/foo-0123456789abcdef.png "Title")',
    );
    checkEqual(
      'angle-bracket path with a space is rewritten',
      await rw('![a](<./my img.png>)'),
      '![a](<https://ex.com/assets/images/my%20img-0123456789abcdef.png>)',
    );
    checkEqual(
      'percent-encoded path is rewritten',
      await rw('![a](./my%20img.png)'),
      '![a](https://ex.com/assets/images/my%20img-0123456789abcdef.png)',
    );
    checkEqual(
      './ path is rewritten as before',
      await rw('![a](./img/foo.png)'),
      '![a](https://ex.com/assets/images/foo-0123456789abcdef.png)',
    );
    const untouched = [
      '![a](https://cdn.example.com/foo.png)',
      '![a](/img/foo.png)',
      '![a](//cdn.example.com/foo.png)',
      '![a](@site/static/foo.png)',
      '[link](img/foo.png)',
      '`![a](img/foo.png)`',
    ].join('\n');
    checkEqual(
      'absolute, root, protocol-relative, alias, links, code untouched',
      await rw(untouched),
      untouched,
    );
  }

  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
