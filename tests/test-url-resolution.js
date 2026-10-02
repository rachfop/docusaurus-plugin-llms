/**
 * Each document's link and generated markdown file must follow the route
 * Docusaurus gives the page:
 * - docs files match docs routes (never blog routes), preferring routes under
 *   the section's routeBasePath; blog files match blog routes only
 * - date-prefixed blog files route to /blog/YYYY/MM/DD/name
 * - a section-root index resolves to the section root route
 * - a baseUrl equal to the first route segment is kept in links
 * - an index file ignores frontmatter `id`, and resolves a relative `slug`
 *   against its own directory
 * - slugs resolve against the route base and the number-prefix-stripped
 *   parent directory, in links and in generated file paths
 * - routes with spaces or accents are percent-encoded in links and written
 *   decoded on disk
 * - files inside `_`-prefixed directories are not listed as pages
 * - a trailing `{#id}` is not part of a heading's title
 * - path transformations handle adjacent duplicate segments and empty paths
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const docusaurusPluginLLMs = require('../lib/index.js').default;
const { applyPathTransformations } = require('../lib/utils.js');

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
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

const tempDirs = [];
const fm = (title, extra = '') =>
  `---\ntitle: ${title}\n${extra}---\n\n# ${title}\n\nBody of ${title}.\n`;

/** Build a site from `files`, run postBuild, and return helpers over the output. */
async function runSite(files, options = {}, routesPaths, baseUrl = '/') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-url-resolution-'));
  tempDirs.push(root);
  const siteDir = path.join(root, 'site');
  const outDir = path.join(siteDir, 'build');
  fs.mkdirSync(outDir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(siteDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }

  const plugin = docusaurusPluginLLMs(
    {
      siteDir,
      outDir,
      siteConfig: { title: 'T', tagline: 'TL', url: 'https://example.com', baseUrl },
    },
    { logLevel: 'quiet', generateLLMsFullTxt: false, addMdExtension: false, ...options },
  );
  await plugin.postBuild(routesPaths ? { routesPaths, outDir } : { outDir });

  const read = (rel) => fs.readFileSync(path.join(outDir, rel), 'utf8');
  const exists = (rel) => fs.existsSync(path.join(outDir, rel));
  // Map of link title → URL in llms.txt.
  const links = () => {
    const map = {};
    for (const m of read('llms.txt').matchAll(/^- \[([^\]]*)\]\(([^)]*)\)/gm)) map[m[1]] = m[2];
    return map;
  };
  return { read, exists, links };
}

async function main() {
  console.log('Bug 1: docs files match docs routes, preferring the route base');
  {
    let r = await runSite({ 'docs/about.md': fm('About') }, {}, ['/', '/about', '/docs/about']);
    checkEqual(
      'docs/about.md links /docs/about',
      r.links().About,
      'https://example.com/docs/about',
    );

    r = await runSite({ 'docs/install.md': fm('Install') }, {}, ['/blog/install', '/docs/install']);
    checkEqual(
      'docs/install.md links /docs/install, not /blog/install',
      r.links().Install,
      'https://example.com/docs/install',
    );

    r = await runSite({ 'docs/install.md': fm('Install') }, {}, ['/blog/install']);
    checkEqual(
      'docs/install.md never takes a blog route',
      r.links().Install,
      'https://example.com/docs/install',
    );

    r = await runSite({ 'documentation/guide.md': fm('Guide') }, { docsDir: 'documentation' }, [
      '/docs/guide',
    ]);
    checkEqual(
      'single section still matches outside its route base when nothing is under it',
      r.links().Guide,
      'https://example.com/docs/guide',
    );

    r = await runSite({ 'blog/post.md': fm('Post'), 'docs/x.md': fm('X') }, { includeBlog: true }, [
      '/docs/post',
      '/blog/post',
      '/docs/x',
    ]);
    checkEqual('blog/post.md links /blog/post', r.links().Post, 'https://example.com/blog/post');
  }

  console.log('Bug 2: date-prefixed blog posts');
  {
    let r = await runSite(
      {
        'blog/2024-01-01-hello.md': fm('Hello'),
        'blog/2024-01-02-world/index.md': fm('World'),
      },
      { includeBlog: true, docsDir: 'nodocs' },
      ['/blog', '/blog/2024/01/01/hello', '/blog/2024/01/02/world'],
    );
    checkEqual(
      'blog/2024-01-01-hello.md links /blog/2024/01/01/hello',
      r.links().Hello,
      'https://example.com/blog/2024/01/01/hello',
    );
    checkEqual(
      'blog/2024-01-02-world/index.md links /blog/2024/01/02/world',
      r.links().World,
      'https://example.com/blog/2024/01/02/world',
    );

    r = await runSite(
      { 'blog/2024-01-01-hello.md': fm('Hello') },
      { includeBlog: true, docsDir: 'nodocs' },
    );
    checkEqual(
      'no-routes fallback converts the date to a path',
      r.links().Hello,
      'https://example.com/blog/2024/01/01/hello',
    );

    r = await runSite(
      { 'blog/2024-01-01-hello.md': fm('Hello') },
      { includeBlog: true, docsDir: 'nodocs', generateMarkdownFiles: true },
      ['/blog', '/blog/2024/01/01/hello'],
    );
    check(
      'markdown file written at blog/2024/01/01/hello.md',
      r.exists('blog/2024/01/01/hello.md'),
    );
  }

  console.log('Bug 3: section-root index files');
  {
    let r = await runSite(
      { 'docs/index.md': fm('Home'), 'docs/intro.md': fm('Intro') },
      { docsDir: [{ path: 'docs', routeBasePath: '/' }] },
      ['/', '/intro', '/blog/tags/docs'],
    );
    checkEqual(
      'docs/index.md at routeBasePath / links the site root',
      r.links().Home,
      'https://example.com/',
    );
    checkEqual('docs/intro.md links /intro', r.links().Intro, 'https://example.com/intro');

    r = await runSite(
      { 'content/index.md': fm('Home'), 'content/x.md': fm('X'), 'other/y.md': fm('Y') },
      {
        docsDir: [
          { path: 'content', routeBasePath: 'guide' },
          { path: 'other', routeBasePath: 'other' },
        ],
      },
      ['/guide', '/guide/x', '/other/y'],
    );
    checkEqual('content/index.md links /guide', r.links().Home, 'https://example.com/guide');
  }

  console.log('Bug 4: baseUrl equal to the first route segment');
  {
    let r = await runSite(
      { 'docs/intro.md': fm('Intro') },
      { generateMarkdownFiles: true },
      ['/docs/', '/docs/docs/intro'],
      '/docs/',
    );
    check('markdown file written at docs/intro.md', r.exists('docs/intro.md'));
    checkEqual(
      'link keeps baseUrl and route base',
      r.links().Intro,
      'https://example.com/docs/docs/intro.md',
    );

    r = await runSite({ 'docs/intro.md': fm('Intro') }, {}, undefined, '/docs/');
    checkEqual(
      'no-routes fallback keeps baseUrl and route base',
      r.links().Intro,
      'https://example.com/docs/docs/intro',
    );

    r = await runSite(
      { 'docs/intro.md': fm('Intro') },
      {},
      ['/docs/', '/docs/docs/intro'],
      '/docs/',
    );
    checkEqual(
      'resolved route keeps baseUrl',
      r.links().Intro,
      'https://example.com/docs/docs/intro',
    );

    r = await runSite(
      { 'docs/intro.md': fm('Intro') },
      { generateMarkdownFiles: true },
      ['/sub/docs/intro'],
      '/sub/',
    );
    checkEqual(
      'other baseUrl link unchanged',
      r.links().Intro,
      'https://example.com/sub/docs/intro.md',
    );
  }

  console.log('Bug 5: index file with frontmatter id');
  {
    const files = {
      'docs/guides/index.md': fm('Guides', 'id: overview\n'),
      'docs/overview.md': fm('Overview'),
    };
    let r = await runSite(files, {}, ['/docs/guides', '/docs/overview']);
    checkEqual('Guides links /docs/guides', r.links().Guides, 'https://example.com/docs/guides');
    checkEqual(
      'Overview links /docs/overview',
      r.links().Overview,
      'https://example.com/docs/overview',
    );

    r = await runSite(files, { generateMarkdownFiles: true }, ['/docs/guides', '/docs/overview']);
    checkEqual('Guides file link', r.links().Guides, 'https://example.com/docs/guides.md');
    checkEqual('Overview file link', r.links().Overview, 'https://example.com/docs/overview.md');
    check(
      'docs/overview.md holds Overview',
      r.exists('docs/overview.md') && r.read('docs/overview.md').includes('Body of Overview.'),
    );

    r = await runSite(files, { generateMarkdownFiles: true });
    checkEqual(
      'no-routes Guides file link',
      r.links().Guides,
      'https://example.com/docs/guides.md',
    );
    checkEqual(
      'no-routes Overview file link',
      r.links().Overview,
      'https://example.com/docs/overview.md',
    );
  }

  console.log('Bug 6: slugs in generated markdown file paths');
  {
    const files = {
      'docs/guides/foo.md': fm('Foo', 'slug: /custom/path\n'),
      'docs/x/b.md': fm('B', 'slug: sub/page\n'),
      'docs/intro.md': fm('Intro'),
    };
    let r = await runSite(files, { generateMarkdownFiles: true }, [
      '/docs/custom/path',
      '/docs/x/sub/page',
      '/docs/intro',
    ]);
    check('absolute slug written at docs/custom/path.md', r.exists('docs/custom/path.md'));
    checkEqual('absolute slug link', r.links().Foo, 'https://example.com/docs/custom/path.md');
    check('relative slug written at docs/x/sub/page.md', r.exists('docs/x/sub/page.md'));
    checkEqual('relative slug link', r.links().B, 'https://example.com/docs/x/sub/page.md');
    check('nothing written at custom/ or sub/', !r.exists('custom') && !r.exists('sub'));

    r = await runSite(files, { generateMarkdownFiles: true });
    checkEqual(
      'no-routes absolute slug link',
      r.links().Foo,
      'https://example.com/docs/custom/path.md',
    );
    checkEqual(
      'no-routes relative slug link',
      r.links().B,
      'https://example.com/docs/x/sub/page.md',
    );
  }

  console.log('Bug 7: relative slug under a number-prefixed folder');
  {
    const r = await runSite({ 'docs/01-guides/foo.md': fm('Foo', 'slug: bar\n') }, {}, [
      '/docs/guides/bar',
    ]);
    checkEqual('links /docs/guides/bar', r.links().Foo, 'https://example.com/docs/guides/bar');
  }

  console.log('Bug 8: relative slug on an index file');
  {
    const r = await runSite(
      { 'docs/guides/index.md': fm('GuidesHome', 'slug: bar\n'), 'docs/bar.md': fm('Bar') },
      {},
      ['/docs/bar', '/docs/guides/bar'],
    );
    checkEqual(
      'index links /docs/guides/bar',
      r.links().GuidesHome,
      'https://example.com/docs/guides/bar',
    );
    checkEqual('docs/bar.md links /docs/bar', r.links().Bar, 'https://example.com/docs/bar');
  }

  console.log('Bug 9: number-prefixed file matching its folder');
  {
    const r = await runSite({ 'docs/02-api/02-api.md': fm('Api') }, {}, [
      '/docs/api',
      '/docs/other',
    ]);
    checkEqual('links /docs/api', r.links().Api, 'https://example.com/docs/api');
  }

  console.log('Bug 10: spaces and accents');
  {
    let r = await runSite({ 'docs/my file.md': fm('Sp'), 'docs/café.md': fm('Cafe') }, {}, [
      '/docs/my file',
      '/docs/café',
    ]);
    checkEqual('space encoded in link', r.links().Sp, 'https://example.com/docs/my%20file');
    checkEqual('accent encoded in link', r.links().Cafe, 'https://example.com/docs/caf%C3%A9');

    r = await runSite({ 'docs/x.md': fm('Enc', 'slug: a%20b\n') }, {}, ['/docs/a%20b']);
    checkEqual('encoded route not double-encoded', r.links().Enc, 'https://example.com/docs/a%20b');

    r = await runSite(
      { 'docs/my file.md': fm('Sp'), 'docs/café.md': fm('Cafe') },
      { generateMarkdownFiles: true },
      ['/docs/my file', '/docs/café'],
    );
    check('docs/my file.md written decoded', r.exists('docs/my file.md'));
    check('docs/café.md written decoded', r.exists('docs/café.md'));
    check(
      'no percent-encoded file names',
      !r.exists('docs/my%20file.md') && !r.exists('docs/caf%C3%A9.md'),
    );
    checkEqual('space file link', r.links().Sp, 'https://example.com/docs/my%20file.md');
    checkEqual('accent file link', r.links().Cafe, 'https://example.com/docs/caf%C3%A9.md');

    r = await runSite({ 'docs/my file.md': fm('Sp') }, { generateMarkdownFiles: true });
    check('no-routes docs/my file.md written decoded', r.exists('docs/my file.md'));
    checkEqual('no-routes space file link', r.links().Sp, 'https://example.com/docs/my%20file.md');
  }

  console.log('Bug 11: files inside _-prefixed directories');
  {
    const r = await runSite(
      {
        'docs/a.md': fm('A'),
        'docs/_partials/snip.md': '# Snip\n\nPartial text.\n',
        'docs/b.mdx': "---\ntitle: B\n---\n\nimport Snip from './_partials/snip.md';\n\n<Snip />\n",
      },
      { generateLLMsFullTxt: true },
    );
    const links = r.links();
    check('A and B listed', 'A' in links && 'B' in links, JSON.stringify(links));
    check('partial not listed', !('Snip' in links), JSON.stringify(links));
    check('partial inlined into B', r.read('llms-full.txt').includes('Partial text.'));
  }

  console.log('Bug 12: custom heading ids');
  {
    const r = await runSite(
      {
        'docs/gs.md': '# Getting started {#start}\n\nIntro text.\n',
        'docs/fm.md': '---\ntitle: Setup\n---\n\n# Setup {#setup-id}\n\nSetup text.\n',
      },
      { generateMarkdownFiles: true, generateLLMsFullTxt: true },
    );
    check('title has no {#id}', 'Getting started' in r.links(), JSON.stringify(r.links()));
    const gs = r.exists('docs/gs.md') ? r.read('docs/gs.md') : '';
    checkEqual(
      'heading appears once in docs/gs.md',
      (gs.match(/^# Getting started/gm) || []).length,
      1,
    );
    check(
      'docs/gs.md header has no {#id}',
      gs.includes('# Getting started\n') && !gs.includes('{#start}'),
    );
    const setup = r.exists('docs/fm.md') ? r.read('docs/fm.md') : '';
    checkEqual('heading appears once in docs/fm.md', (setup.match(/^# Setup/gm) || []).length, 1);
    const full = r.read('llms-full.txt');
    check('llms-full.txt drops the duplicate heading', !full.includes('{#start}'));
  }

  console.log('Bug 13: path transformations');
  {
    checkEqual(
      'adjacent duplicate ignored segments removed',
      applyPathTransformations('api/api/x', { ignorePaths: ['api'] }),
      'x',
    );
    checkEqual(
      'multi-segment ignore path removed',
      applyPathTransformations('a/b/c', { ignorePaths: ['a/b'] }),
      'c',
    );
    checkEqual(
      'addPaths on empty path has no trailing slash',
      applyPathTransformations('', { addPaths: ['docs'] }),
      'docs',
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
