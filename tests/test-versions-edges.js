/**
 * Edge cases of versions mode:
 * - `versions: 'auto'` labels each version the way Docusaurus does: the
 *   configured `versions.<name>.label`, else 'Next' for the current docs and
 *   the version name otherwise (plugin-content-docs lib/versions/version.js
 *   getVersionLabel)
 * - with an explicit `versions` array where every version has a path prefix,
 *   the blog (listed in the first version) links its /blog/... routes: blog
 *   posts aren't versioned, so they match blog routes outside the version's
 *   route prefix. The cases use `trailingSlash: true` routes (Docusaurus
 *   applies the site's trailingSlash to every route, core
 *   server/plugins/routeConfig.js applyRouteTrailingSlash), where a matched
 *   route and a file-derived URL differ
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const docusaurusPluginLLMs = require('../lib/index.js').default;

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
const page = (title, body, extra = '') => `---\ntitle: ${title}\n${extra}---\n\n${body}\n`;

const FILES = {
  'versions.json': '["1.0"]',
  'docs/intro.md': page('Intro', 'Current intro.'),
  'versioned_docs/version-1.0/intro.md': page('Intro', 'Version 1.0 intro.'),
  'blog/2024-01-01-hello.md': page('Hello', 'Blog post.'),
  'blog/2024-02-03-world/index.md': page('World', 'Folder post.'),
  'blog/custom.md': page('Custom', 'Slugged post.', 'slug: my-custom-post\n'),
};

/** Routes as Docusaurus lists them with `trailingSlash: true`. */
const withSlash = (routes) => routes.map((r) => (r.endsWith('/') ? r : `${r}/`));

const BLOG_ROUTES = [
  '/blog',
  '/blog/2024/01/01/hello',
  '/blog/2024/02/03/world',
  '/blog/my-custom-post',
  '/blog/archive',
];

const classicPreset = (docs) => ({ presets: [['classic', docs === undefined ? {} : { docs }]] });

async function runSite(options, routesPaths, siteConfig = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-versions-edges-'));
  tempDirs.push(root);
  const siteDir = path.join(root, 'site');
  const outDir = path.join(siteDir, 'build');
  fs.mkdirSync(outDir, { recursive: true });
  for (const [rel, content] of Object.entries(FILES)) {
    const file = path.join(siteDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  const context = {
    siteDir,
    outDir,
    siteConfig: {
      title: 'T',
      tagline: 'TL',
      url: 'https://example.com',
      baseUrl: '/',
      ...siteConfig,
    },
  };
  const plugin = docusaurusPluginLLMs(context, {
    logLevel: 'quiet',
    addMdExtension: false,
    generateLLMsFullTxt: false,
    ...options,
  });
  await plugin.postBuild({ routesPaths, outDir });

  const exists = (rel) => fs.existsSync(path.join(outDir, rel));
  const read = (rel) => (exists(rel) ? fs.readFileSync(path.join(outDir, rel), 'utf8') : '');
  const links = (rel = 'llms.txt') =>
    [...read(rel).matchAll(/^- \[[^\]]*\]\(([^)]*)\)/gm)]
      .map((m) => m[1].replace('https://example.com', ''))
      .sort();
  return { read, exists, links };
}

const versionLine = (txt) => (/^> Version: (.*)$/m.exec(txt) || [])[1];

async function testAutoDefaultLabels() {
  console.log('\nversions: auto labels current "Next" and versioned docs by name');
  const site = await runSite(
    { versions: 'auto' },
    ['/', '/docs/intro', '/docs/next/intro', ...BLOG_ROUTES],
    classicPreset(),
  );
  checkEqual('root (1.0) is labeled 1.0', versionLine(site.read('llms.txt')), '1.0');
  checkEqual('next/ (current) is labeled Next', versionLine(site.read('next/llms.txt')), 'Next');
}

async function testAutoLastVersionCurrentLabel() {
  console.log('\nversions: auto with lastVersion current keeps the Next label');
  const site = await runSite(
    { versions: 'auto' },
    ['/', '/docs/intro', '/docs/1.0/intro', ...BLOG_ROUTES],
    classicPreset({ lastVersion: 'current', versions: { '1.0': { path: '1.0' } } }),
  );
  checkEqual('root (current) is labeled Next', versionLine(site.read('llms.txt')), 'Next');
  checkEqual('1.0/ is labeled 1.0', versionLine(site.read('1.0/llms.txt')), '1.0');
}

async function testAutoConfiguredLabels() {
  console.log('\nversions: auto uses configured labels');
  const site = await runSite(
    { versions: 'auto' },
    ['/', '/docs/intro', '/docs/next/intro', ...BLOG_ROUTES],
    classicPreset({ versions: { current: { label: 'Canary' }, '1.0': { label: 'One' } } }),
  );
  checkEqual('root (1.0) uses its label', versionLine(site.read('llms.txt')), 'One');
  checkEqual('next/ (current) uses its label', versionLine(site.read('next/llms.txt')), 'Canary');
}

async function testExplicitAllPrefixedBlog() {
  console.log('\nexplicit versions with no root version link blog routes');
  const site = await runSite(
    {
      includeBlog: true,
      versions: [
        { name: 'nightly', docsDir: 'docs', path: 'nightly' },
        { name: 'stable', docsDir: 'versioned_docs/version-1.0', path: 'stable' },
      ],
    },
    withSlash(['/', '/nightly/intro', '/stable/intro', ...BLOG_ROUTES]),
  );
  checkEqual('nightly/llms.txt links the docs and blog routes', site.links('nightly/llms.txt'), [
    '/blog/2024/01/01/hello/',
    '/blog/2024/02/03/world/',
    '/blog/my-custom-post/',
    '/nightly/intro/',
  ]);
  checkEqual('stable/llms.txt has no blog post', site.links('stable/llms.txt'), ['/stable/intro/']);
}

async function testExplicitRoutePrefixBlog() {
  console.log('\nexplicit versions with a routePrefix link blog routes');
  const site = await runSite(
    {
      includeBlog: true,
      versions: [
        { name: 'nightly', docsDir: 'docs', path: 'nightly', routePrefix: 'docs/nightly' },
        { name: 'stable', docsDir: 'versioned_docs/version-1.0', path: '', routePrefix: 'docs' },
      ],
    },
    withSlash(['/', '/docs/nightly/intro', '/docs/intro', ...BLOG_ROUTES]),
  );
  checkEqual('root (stable) links the docs and blog routes', site.links(), [
    '/blog/2024/01/01/hello/',
    '/blog/2024/02/03/world/',
    '/blog/my-custom-post/',
    '/docs/intro/',
  ]);
}

async function main() {
  console.log('Testing versions edge cases...');
  await testAutoDefaultLabels();
  await testAutoLastVersionCurrentLabel();
  await testAutoConfiguredLabels();
  await testExplicitAllPrefixedBlog();
  await testExplicitRoutePrefixBlog();

  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
