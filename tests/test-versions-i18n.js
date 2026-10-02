/**
 * Versioned and localized sites must produce llms files whose links and
 * content match what Docusaurus serves:
 * - `versions: 'auto'` follows the docs plugin's version routing: a version
 *   is served at <baseUrl>/<routeBasePath>/<versionPath>/, where the last
 *   version's path is '' and current's is 'next' unless overridden
 *   (plugin-content-docs lib/versions/version.js getVersionPathPart and
 *   createVersionMetadata), and includeCurrentVersion, onlyIncludeVersions
 *   and lastVersion select and order the versions (lib/versions/files.js
 *   readVersionNames, version.js filterVersions / getLastVersionName)
 * - the version served at the unprefixed route owns the root llms.txt; every
 *   other version writes under <outDir>/<versionPath>/
 * - an explicit `versions` array can describe the same layout with
 *   `routePrefix: ''` and section routeBasePaths
 * - a non-default locale reads each doc from
 *   <localizationDir>/docusaurus-plugin-content-docs/<current|version-X>/
 *   (and blog posts from .../docusaurus-plugin-content-blog/) when the
 *   translated file exists, falling back to the source file (lib/docs.js
 *   readDocFile via getContentPathList; lib/versions/files.js
 *   getDocsDirPathLocalized)
 * - per-version docsDir/customLLMFiles/includeOrder get the same validation
 *   as the top-level options, and one version failing at runtime does not
 *   stop the others
 * - in versions mode the blog is listed once, in the root version's files
 *
 * Route lists below are the routes Docusaurus 3.10.2 builds for these sites
 * (from .docusaurus/routes.js of a real build of the same layout).
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
const page = (title, body) => `---\ntitle: ${title}\n---\n\n${body}\n`;

/** Files shared by the versioned cases: a current and a 1.0 version. */
const VERSIONED_FILES = {
  'versions.json': '["1.0"]',
  'docs/intro.md': page('Intro', 'Current intro.'),
  'docs/new-page.md': page('New page', 'Current only.'),
  'docs/01-guide/setup.md': page('Setup', 'Current setup.'),
  'versioned_docs/version-1.0/intro.md': page('Intro', 'Version 1.0 intro.'),
  'versioned_docs/version-1.0/old-page.md': page('Old page', 'Version 1.0 only.'),
  'versioned_docs/version-1.0/01-guide/setup.md': page('Setup', 'Version 1.0 setup.'),
  'blog/2024-01-01-hello.md': page('Hello', 'Blog post.'),
};

/** Routes Docusaurus builds for VERSIONED_FILES' docs, given the version route roots. */
function versionedRoutes({ current, v1, base = '' }) {
  const routes = [
    `${base}/`,
    `${base}/blog`,
    `${base}/blog/2024/01/01/hello`,
    `${base}/blog/archive`,
  ];
  if (current !== undefined) {
    routes.push(
      current || '/',
      `${current}/intro`,
      `${current}/new-page`,
      `${current}/guide/setup`,
    );
  }
  if (v1 !== undefined) {
    routes.push(v1 || '/', `${v1}/intro`, `${v1}/old-page`, `${v1}/guide/setup`);
  }
  return routes.map((r) => (r.startsWith(base) ? r : `${base}${r}`));
}

const classicPreset = (docs) => ({ presets: [['classic', docs === undefined ? {} : { docs }]] });

/**
 * Build a site from `files`, run postBuild with a context shaped like the one
 * Docusaurus passes, and return helpers over the output directory.
 */
async function runSite(files, options, routesPaths, ctx = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-versions-i18n-'));
  tempDirs.push(root);
  const siteDir = path.join(root, 'site');
  const buildDir = path.join(siteDir, 'build');
  const outDir = ctx.locale && ctx.locale !== 'en' ? path.join(buildDir, ctx.locale) : buildDir;
  fs.mkdirSync(outDir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(siteDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  for (const rel of ctx.outFiles ?? []) fs.writeFileSync(path.join(outDir, rel), 'not a dir');

  const context = {
    siteDir,
    outDir,
    siteConfig: {
      title: 'T',
      tagline: 'TL',
      url: 'https://example.com',
      baseUrl: ctx.locale && ctx.locale !== 'en' ? `/${ctx.locale}/` : '/',
      ...ctx.siteConfig,
    },
  };
  if (ctx.locale) {
    context.i18n = {
      defaultLocale: 'en',
      locales: ['en', ctx.locale],
      currentLocale: ctx.locale,
      localeConfigs: { en: {}, [ctx.locale]: {} },
    };
    context.localizationDir = path.join(siteDir, 'i18n', ctx.locale);
  }

  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    const plugin = docusaurusPluginLLMs(context, {
      logLevel: 'quiet',
      addMdExtension: false,
      ...options,
    });
    await plugin.postBuild({ routesPaths, outDir });
  } finally {
    console.error = origError;
  }

  const exists = (rel) => fs.existsSync(path.join(outDir, rel));
  const read = (rel) => (exists(rel) ? fs.readFileSync(path.join(outDir, rel), 'utf8') : '');
  const links = (rel = 'llms.txt') =>
    exists(rel)
      ? [...read(rel).matchAll(/^- \[[^\]]*\]\(([^)]*)\)/gm)]
          .map((m) => m[1].replace('https://example.com', ''))
          .sort()
      : null;
  return { read, exists, links, errors };
}

async function testAutoDefaultSite() {
  console.log('\nversions: auto on a default classic-preset site');
  // Default docs config: routeBasePath 'docs', lastVersion '1.0' (served at
  // /docs/...), current served at /docs/next/....
  const site = await runSite(
    VERSIONED_FILES,
    { versions: 'auto', generateLLMsFullTxt: false },
    versionedRoutes({ current: '/docs/next', v1: '/docs' }),
    { siteConfig: classicPreset() },
  );
  checkEqual('root llms.txt (1.0, the last version) links /docs/... pages', site.links(), [
    '/docs/guide/setup',
    '/docs/intro',
    '/docs/old-page',
  ]);
  check('root llms.txt is labeled 1.0', site.read('llms.txt').includes('Version: 1.0'));
  checkEqual('next/llms.txt (current) links /docs/next/... pages', site.links('next/llms.txt'), [
    '/docs/next/guide/setup',
    '/docs/next/intro',
    '/docs/next/new-page',
  ]);
  check('no 1.0/ output directory (1.0 owns the root)', !site.exists('1.0'));
}

async function testAutoLastVersionCurrent() {
  console.log('\nversions: auto with lastVersion current and a 1.0 path');
  const site = await runSite(
    VERSIONED_FILES,
    { versions: 'auto', generateLLMsFullTxt: false },
    versionedRoutes({ current: '/docs', v1: '/docs/1.0' }),
    { siteConfig: classicPreset({ lastVersion: 'current', versions: { '1.0': { path: '1.0' } } }) },
  );
  checkEqual('root llms.txt (current) links /docs/... pages', site.links(), [
    '/docs/guide/setup',
    '/docs/intro',
    '/docs/new-page',
  ]);
  checkEqual('1.0/llms.txt links /docs/1.0/... pages', site.links('1.0/llms.txt'), [
    '/docs/1.0/guide/setup',
    '/docs/1.0/intro',
    '/docs/1.0/old-page',
  ]);
}

async function testAutoVersionFilters() {
  console.log('\nversions: auto honors includeCurrentVersion and onlyIncludeVersions');
  const noCurrent = await runSite(
    VERSIONED_FILES,
    { versions: 'auto', generateLLMsFullTxt: false },
    versionedRoutes({ v1: '/docs' }),
    { siteConfig: classicPreset({ includeCurrentVersion: false }) },
  );
  checkEqual('includeCurrentVersion: false → root holds 1.0 only', noCurrent.links(), [
    '/docs/guide/setup',
    '/docs/intro',
    '/docs/old-page',
  ]);
  check('includeCurrentVersion: false → no next/ output', !noCurrent.exists('next'));

  const onlyCurrent = await runSite(
    VERSIONED_FILES,
    { versions: 'auto', generateLLMsFullTxt: false },
    versionedRoutes({ current: '/docs' }),
    { siteConfig: classicPreset({ onlyIncludeVersions: ['current'] }) },
  );
  checkEqual('onlyIncludeVersions [current] → current is last, at root', onlyCurrent.links(), [
    '/docs/guide/setup',
    '/docs/intro',
    '/docs/new-page',
  ]);
  check('onlyIncludeVersions [current] → no 1.0/ output', !onlyCurrent.exists('1.0'));
}

async function testAutoFromPluginsArray() {
  console.log('\nversions: auto reads a docs plugin listed in plugins');
  const site = await runSite(
    VERSIONED_FILES,
    { versions: 'auto', generateLLMsFullTxt: false },
    versionedRoutes({ current: '/next', v1: '' }),
    {
      siteConfig: {
        presets: [['classic', { docs: false }]],
        plugins: [['@docusaurus/plugin-content-docs', { routeBasePath: '/' }]],
      },
    },
  );
  checkEqual('root llms.txt (1.0) links routeBasePath / pages', site.links(), [
    '/guide/setup',
    '/intro',
    '/old-page',
  ]);
  checkEqual('next/llms.txt links /next/... pages', site.links('next/llms.txt'), [
    '/next/guide/setup',
    '/next/intro',
    '/next/new-page',
  ]);
}

async function testExplicitNativeLayout() {
  console.log("\nexplicit versions describe the native layout with routePrefix: ''");
  const site = await runSite(
    VERSIONED_FILES,
    {
      generateLLMsFullTxt: false,
      versions: [
        {
          name: '1.0',
          docsDir: [{ path: 'versioned_docs/version-1.0', routeBasePath: 'docs' }],
          path: '',
        },
        {
          name: 'current',
          docsDir: [{ path: 'docs', routeBasePath: 'docs/next' }],
          path: 'next',
          routePrefix: '',
        },
      ],
    },
    versionedRoutes({ current: '/docs/next', v1: '/docs' }),
  );
  checkEqual('root (1.0) links /docs/... pages', site.links(), [
    '/docs/guide/setup',
    '/docs/intro',
    '/docs/old-page',
  ]);
  checkEqual('next/ (current) links /docs/next/... pages', site.links('next/llms.txt'), [
    '/docs/next/guide/setup',
    '/docs/next/intro',
    '/docs/next/new-page',
  ]);
}

async function testBlogOnlyInRootVersion() {
  console.log('\nversions mode lists the blog in the root version only');
  const routes = versionedRoutes({ current: '/docs/next', v1: '/docs' });
  const auto = await runSite(
    VERSIONED_FILES,
    { versions: 'auto', includeBlog: true, generateLLMsFullTxt: false },
    routes,
    { siteConfig: classicPreset() },
  );
  check('auto: root llms.txt lists the blog post', auto.links().includes('/blog/2024/01/01/hello'));
  check(
    'auto: next/llms.txt has no blog post',
    (auto.links('next/llms.txt') ?? ['missing']).every(
      (l) => !l.startsWith('/blog') && l !== 'missing',
    ),
    JSON.stringify(auto.links('next/llms.txt')),
  );

  const explicit = await runSite(
    VERSIONED_FILES,
    {
      includeBlog: true,
      generateLLMsFullTxt: false,
      versions: [
        { name: 'nightly', docsDir: 'docs', path: '' },
        { name: 'stable', docsDir: 'versioned_docs/version-1.0', path: 'stable' },
      ],
    },
    ['/blog/2024/01/01/hello', '/intro', '/stable/intro'],
  );
  check(
    'explicit: root llms.txt lists the blog post',
    explicit.links().includes('/blog/2024/01/01/hello'),
  );
  check(
    'explicit: stable/llms.txt has no blog post',
    (explicit.links('stable/llms.txt') ?? ['blog']).every((l) => !l.includes('blog')),
    JSON.stringify(explicit.links('stable/llms.txt')),
  );
}

const FR = 'i18n/fr/docusaurus-plugin-content-docs';
const I18N_FILES = {
  'docs/intro.md': page('Intro', 'English intro.'),
  'docs/untranslated.md': page('Untranslated', 'English only.'),
  'docs/guide/setup.md':
    "---\ntitle: Setup\n---\n\nimport Shared from './_shared.md';\n\nEnglish setup.\n\n<Shared />\n",
  'docs/guide/_shared.md': 'English partial.\n',
  'docs/missing-partial.md':
    "---\ntitle: Missing\n---\n\nimport Gone from './_gone.md';\n\nEnglish missing.\n\n<Gone />\n",
  'docs/_gone.md': 'English gone partial.\n',
  [`${FR}/current/intro.md`]: page('Introduction', 'Introduction en français.'),
  [`${FR}/current/guide/setup.md`]:
    "---\ntitle: Installation\n---\n\nimport Shared from './_shared.md';\n\nInstallation en français.\n\n<Shared />\n",
  [`${FR}/current/guide/_shared.md`]: 'Partiel en français.\n',
  [`${FR}/current/missing-partial.md`]:
    "---\ntitle: Manquant\n---\n\nimport Gone from './_gone.md';\n\nManquant en français.\n\n<Gone />\n",
  'blog/2024-01-01-hello.md': page('Hello', 'English post.'),
  'i18n/fr/docusaurus-plugin-content-blog/2024-01-01-hello.md': page('Bonjour', 'Article.'),
};
const I18N_ROUTES = [
  '/fr/',
  '/fr/docs/intro',
  '/fr/docs/untranslated',
  '/fr/docs/guide/setup',
  '/fr/docs/missing-partial',
  '/fr/blog/2024/01/01/hello',
];

async function testI18nTranslatedContent() {
  console.log('\ni18n: a non-default locale uses translated files');
  const site = await runSite(I18N_FILES, { includeBlog: true }, I18N_ROUTES, {
    locale: 'fr',
    siteConfig: classicPreset(),
  });
  const txt = site.read('llms.txt');
  const full = site.read('llms-full.txt');
  check('fr llms.txt uses the translated title', txt.includes('[Introduction]'), txt);
  check('fr llms.txt has no English intro', !txt.includes('English intro'), txt);
  check('fr llms-full.txt has the translated body', full.includes('Introduction en français.'));
  check('fr llms-full.txt has the translated partial', full.includes('Partiel en français.'));
  check('fr llms-full.txt has no English partial', !full.includes('English partial.'));
  check('untranslated doc falls back to the source file', full.includes('English only.'));
  check(
    'translated blog post is used',
    full.includes('Article.') && !full.includes('English post'),
  );
  check(
    'translated doc with a missing partial still renders',
    full.includes('Manquant en français.'),
  );
  check('links keep the /fr/ routes', site.links().includes('/fr/docs/intro'), site.links());
}

async function testI18nVersioned() {
  console.log('\ni18n: versions: auto reads version-X translations');
  const files = {
    ...VERSIONED_FILES,
    [`${FR}/current/intro.md`]: page('Intro', 'Intro actuelle en français.'),
    [`${FR}/version-1.0/intro.md`]: page('Intro', 'Intro 1.0 en français.'),
  };
  const site = await runSite(
    files,
    { versions: 'auto' },
    versionedRoutes({ current: '/docs/next', v1: '/docs', base: '/fr' }),
    { locale: 'fr', siteConfig: classicPreset() },
  );
  check(
    'fr root (1.0) llms-full.txt has the 1.0 translation',
    site.read('llms-full.txt').includes('Intro 1.0 en français.'),
  );
  check(
    'fr next/llms-full.txt has the current translation',
    site.read('next/llms-full.txt').includes('Intro actuelle en français.'),
  );
  checkEqual('fr root links /fr/docs/...', site.links(), [
    '/fr/docs/guide/setup',
    '/fr/docs/intro',
    '/fr/docs/old-page',
  ]);
}

async function testDefaultLocaleUnchanged() {
  console.log('\ni18n: the default locale output is unchanged');
  const routes = I18N_ROUTES.map((r) => r.replace(/^\/fr/, '') || '/');
  const plain = await runSite(I18N_FILES, { includeBlog: true }, routes);
  const en = await runSite(I18N_FILES, { includeBlog: true }, routes, { locale: 'en' });
  check(
    'en llms.txt matches a context without i18n',
    en.read('llms.txt') === plain.read('llms.txt'),
  );
  check(
    'en llms-full.txt matches a context without i18n',
    en.read('llms-full.txt') === plain.read('llms-full.txt'),
  );
  check('en llms-full.txt is English', en.read('llms-full.txt').includes('English intro.'));
}

async function testDefaultLocaleTranslations() {
  console.log('\ni18n: the default locale reads its own i18n folder too');
  const routes = I18N_ROUTES.map((r) => r.replace(/^\/fr/, '') || '/');
  const files = {
    ...I18N_FILES,
    'i18n/en/docusaurus-plugin-content-docs/current/intro.md': page(
      'Intro',
      'Edited English intro.',
    ),
  };
  const en = await runSite(files, { includeBlog: true }, routes, { locale: 'en' });
  const full = en.read('llms-full.txt');
  check('en llms-full.txt uses i18n/en override', full.includes('Edited English intro.'), full);
}

function testVersionValidation() {
  console.log('\nper-version options get the top-level validation');
  const ctx = {
    siteDir: '/tmp',
    outDir: '/tmp/out',
    siteConfig: { title: 'T', url: 'https://e.com', baseUrl: '/' },
  };
  const throwsMatching = (name, options, pattern) => {
    let message = '';
    try {
      docusaurusPluginLLMs(ctx, options);
    } catch (err) {
      message = err.message;
    }
    check(name, pattern.test(message), `got ${JSON.stringify(message)}`);
  };
  throwsMatching(
    'versions[].docsDir sections need a path',
    {
      versions: [
        { name: 'a', docsDir: [{}] },
        { name: 'b', path: 'b' },
      ],
    },
    /versions\[0\]\.docsDir\[0\]\.path must be a non-empty string/,
  );
  throwsMatching(
    'versions[].customLLMFiles need includePatterns',
    { versions: [{ name: 'a', customLLMFiles: [{ filename: 'c.txt' }] }] },
    /versions\[0\]\.customLLMFiles\[0\]\.includePatterns must be a non-empty array/,
  );
  throwsMatching(
    'versions[].customLLMFiles need fullContent',
    { versions: [{ name: 'a', customLLMFiles: [{ filename: 'c.txt', includePatterns: ['*'] }] }] },
    /versions\[0\]\.customLLMFiles\[0\]\.fullContent must be a boolean/,
  );
  throwsMatching(
    'versions[].includeOrder must contain strings',
    { versions: [{ name: 'a', includeOrder: [1] }] },
    /versions\[0\]\.includeOrder must contain only strings/,
  );
  throwsMatching(
    'versions[].routePrefix must be a string',
    { versions: [{ name: 'a', routePrefix: 1 }] },
    /versions\[0\]\.routePrefix must be a string/,
  );
}

async function testVersionFailureIsolated() {
  console.log('\none version failing does not stop the others');
  // build/a is a regular file, so version a cannot write a/llms.txt.
  const site = await runSite(
    { 'docs/intro.md': page('Intro', 'Body.') },
    {
      logLevel: 'normal',
      generateLLMsFullTxt: false,
      versions: [
        { name: 'a', docsDir: 'docs', path: 'a' },
        { name: 'b', docsDir: 'docs', path: 'b' },
      ],
    },
    ['/a/intro', '/b/intro'],
    { outFiles: ['a'] },
  );
  check('version b is generated after version a fails', site.exists('b/llms.txt'));
  check(
    'version a failure is logged as an error naming the version',
    site.errors.some((e) => e.includes("'a'")),
    JSON.stringify(site.errors),
  );
}

async function main() {
  console.log('Testing versions and i18n...');
  await testAutoDefaultSite();
  await testAutoLastVersionCurrent();
  await testAutoVersionFilters();
  await testAutoFromPluginsArray();
  await testExplicitNativeLayout();
  await testBlogOnlyInRootVersion();
  await testI18nTranslatedContent();
  await testI18nVersioned();
  await testDefaultLocaleUnchanged();
  await testDefaultLocaleTranslations();
  testVersionValidation();
  await testVersionFailureIsolated();

  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
