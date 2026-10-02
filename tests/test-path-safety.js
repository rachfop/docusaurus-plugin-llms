/**
 * Every generated file must land inside outDir and no generated file may
 * overwrite another:
 * - a frontmatter slug with `..` segments must not write above outDir
 * - customLLMFiles[].filename and versions[].path must not escape outDir
 * - output filenames that collide (llms.txt vs llms-full.txt, custom files)
 *   are rejected at option validation
 * - the custom-file pass must reuse the markdown paths the standard pass
 *   assigned, so a same-named page from another section can't overwrite them
 * - a version's markdown files must land where its llms.txt links point,
 *   without repeating the version path on disk
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

const tempDirs = [];

/** Build a site from `files`, run postBuild, and return helpers over the output. */
async function runSite(files, options = {}, routesPaths) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-path-safety-'));
  tempDirs.push(root);
  const siteDir = path.join(root, 'a', 'b', 'site');
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
      siteConfig: { title: 'T', tagline: 'TL', url: 'https://ex.com', baseUrl: '/' },
    },
    { logLevel: 'quiet', ...options },
  );
  await plugin.postBuild(routesPaths ? { routesPaths } : {});

  // Every file under root that isn't a source file or inside outDir escaped.
  const escaped = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (full === outDir) continue;
      if (entry.isDirectory()) walk(full);
      else if (!Object.keys(files).some((rel) => path.join(siteDir, rel) === full)) {
        escaped.push(path.relative(root, full));
      }
    }
  })(root);

  const read = (rel) => fs.readFileSync(path.join(outDir, rel), 'utf8');
  const exists = (rel) => fs.existsSync(path.join(outDir, rel));
  // Map each markdown link in an llms file to the file it should be served from.
  const links = (rel) =>
    [...read(rel).matchAll(/\]\((https:\/\/ex\.com[^)]*)\)/g)].map((m) =>
      decodeURIComponent(new URL(m[1]).pathname).replace(/^\/+/, ''),
    );
  return { outDir, escaped, read, exists, links };
}

function initError(options) {
  try {
    docusaurusPluginLLMs(
      {
        siteDir: '/tmp/test-site',
        outDir: '/tmp/test-site/build',
        siteConfig: { title: 'T', url: 'https://ex.com', baseUrl: '/' },
      },
      { logLevel: 'quiet', ...options },
    );
    return null;
  } catch (err) {
    return err.message;
  }
}

async function main() {
  console.log('Testing path safety and output collisions...\n');

  // 1. A slug with `..` segments must not escape outDir.
  {
    const r = await runSite(
      { 'docs/a.md': '---\nslug: ../../../escaped\n---\n# A\n\nbody' },
      { generateMarkdownFiles: true },
    );
    check(
      'slug ../../../escaped writes nothing outside outDir',
      r.escaped.length === 0,
      `escaped: ${JSON.stringify(r.escaped)}`,
    );
    const [link] = r.links('llms.txt');
    check(
      'slug ../../../escaped still gets a markdown file its link points to',
      link !== undefined && !link.includes('..') && r.exists(link),
      `link: ${link}`,
    );
  }

  // 2. customLLMFiles[].filename and versions[].path must stay inside outDir.
  {
    const custom = (filename) => ({ filename, includePatterns: ['**'], fullContent: false });
    for (const filename of ['../../evil.txt', 'sub/../../evil.txt', '/tmp/evil.txt']) {
      const err = initError({ customLLMFiles: [custom(filename)] });
      check(
        `customLLMFiles filename '${filename}' is rejected`,
        err !== null && err.includes('customLLMFiles[0].filename'),
        `error: ${err}`,
      );
    }
    const versionFileErr = initError({
      versions: [{ name: 'v1', path: 'v1', customLLMFiles: [custom('../evil.txt')] }],
    });
    check(
      "versions[].customLLMFiles filename '../evil.txt' is rejected",
      versionFileErr !== null && versionFileErr.includes('versions[0].customLLMFiles[0].filename'),
      `error: ${versionFileErr}`,
    );
    const versionPathErr = initError({ versions: [{ name: 'v1', path: '../escaped' }] });
    check(
      "versions[].path '../escaped' is rejected",
      versionPathErr !== null && versionPathErr.includes('versions[0].path'),
      `error: ${versionPathErr}`,
    );
    check(
      "versions[].path '/stable' and filename 'sub/llms-x.txt' are accepted",
      initError({
        versions: [
          { name: 'current', path: '' },
          { name: 'v1', path: '/stable' },
        ],
        customLLMFiles: [custom('sub/llms-x.txt')],
      }) === null,
    );

    // Bypass validation (e.g. a mutated options object) and confirm the
    // write-time guard still keeps the file inside outDir.
    const options = { customLLMFiles: [custom('llms-x.txt')] };
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-path-safety-'));
    tempDirs.push(root);
    const siteDir = path.join(root, 'site');
    const outDir = path.join(siteDir, 'build');
    fs.mkdirSync(path.join(siteDir, 'docs'), { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(siteDir, 'docs', 'a.md'), '# A\n\nbody');
    const plugin = docusaurusPluginLLMs(
      { siteDir, outDir, siteConfig: { title: 'T', url: 'https://ex.com', baseUrl: '/' } },
      { logLevel: 'quiet', ...options },
    );
    options.customLLMFiles[0].filename = '../../evil.txt';
    await plugin.postBuild({});
    check(
      'write-time guard skips a custom file outside outDir',
      !fs.existsSync(path.join(root, 'evil.txt')),
    );
  }

  // 3. Output filenames that collide are rejected.
  {
    const custom = (filename) => ({ filename, includePatterns: ['**'], fullContent: false });
    const cases = [
      ['llmsTxtFilename === llmsFullTxtFilename', { llmsFullTxtFilename: 'llms.txt' }, true],
      [
        'llmsTxtFilename === llmsFullTxtFilename with llms-full.txt disabled',
        { llmsFullTxtFilename: 'llms.txt', generateLLMsFullTxt: false },
        false,
      ],
      ["custom filename 'llms.txt'", { customLLMFiles: [custom('llms.txt')] }, true],
      ["custom filename './llms-full.txt'", { customLLMFiles: [custom('./llms-full.txt')] }, true],
      [
        "custom filename 'llms-full.txt' with llms-full.txt disabled",
        { generateLLMsFullTxt: false, customLLMFiles: [custom('llms-full.txt')] },
        false,
      ],
      [
        'two custom files with the same filename',
        { customLLMFiles: [custom('llms-a.txt'), custom('llms-a.txt')] },
        true,
      ],
      [
        "versions[].customLLMFiles filename 'llms.txt'",
        { versions: [{ name: 'v1', customLLMFiles: [custom('llms.txt')] }] },
        true,
      ],
      [
        'distinct custom filenames',
        { customLLMFiles: [custom('llms-a.txt'), custom('llms-b.txt')] },
        false,
      ],
    ];
    for (const [name, options, expectError] of cases) {
      const err = initError(options);
      check(
        `${name} is ${expectError ? 'rejected' : 'accepted'}`,
        expectError ? err !== null && /collides|same/.test(err) : err === null,
        `error: ${err}`,
      );
    }
  }

  // 4. The custom-file pass must not overwrite the standard pass's markdown files.
  {
    const r = await runSite(
      {
        'api/intro.md': '---\ntitle: API Intro\n---\nAPI body',
        'guide/intro.md': '---\ntitle: Guide Intro\n---\nGuide body',
      },
      {
        generateMarkdownFiles: true,
        preserveDirectoryStructure: false,
        generateLLMsFullTxt: false,
        docsDir: [
          { path: 'api', routeBasePath: 'api' },
          { path: 'guide', routeBasePath: 'guide' },
        ],
        customLLMFiles: [
          { filename: 'llms-guide.txt', includePatterns: ['guide/**'], fullContent: false },
        ],
      },
      ['/api/intro', '/guide/intro'],
    );
    const standard = r.links('llms.txt');
    const guide = r.links('llms-guide.txt');
    check(
      "llms.txt's API link serves the API page",
      standard.length === 2 && r.exists(standard[0]) && r.read(standard[0]).includes('API body'),
      `links: ${JSON.stringify(standard)}`,
    );
    check(
      "llms.txt's Guide link serves the Guide page",
      standard.length === 2 && r.exists(standard[1]) && r.read(standard[1]).includes('Guide body'),
      `links: ${JSON.stringify(standard)}`,
    );
    check(
      "llms-guide.txt links the same file as llms.txt's Guide link",
      guide.length === 1 && guide[0] === standard[1],
      `guide: ${JSON.stringify(guide)}, standard: ${JSON.stringify(standard)}`,
    );
  }

  // 5. A version's markdown files land where its llms.txt links point.
  {
    const r = await runSite(
      {
        'docs/get-started.md': '---\ntitle: GS\n---\nnightly body',
        'stable-docs/get-started.md': '---\ntitle: GS\n---\nstable body',
      },
      {
        generateMarkdownFiles: true,
        generateLLMsFullTxt: false,
        versions: [
          { name: 'nightly', docsDir: 'docs', path: '' },
          { name: 'v1', docsDir: 'stable-docs', path: 'stable' },
        ],
      },
      ['/', '/get-started', '/stable', '/stable/get-started'],
    );
    const [stableLink] = r.links('stable/llms.txt');
    check(
      'stable/llms.txt links /stable/get-started.md',
      stableLink === 'stable/get-started.md',
      `link: ${stableLink}`,
    );
    check(
      'build/stable/get-started.md holds the stable page',
      r.exists('stable/get-started.md') && r.read('stable/get-started.md').includes('stable body'),
    );
    check('build/stable/stable/ is not created', !r.exists('stable/stable'));
    check(
      'root version page stays at build/get-started.md',
      r.exists('get-started.md') && r.read('get-started.md').includes('nightly body'),
    );
  }

  // Regressions: legitimate slugs and duplicate-name suffixing are unchanged.
  {
    const r = await runSite(
      {
        'docs/root.md': '---\ntitle: Root\nslug: /\n---\nroot body',
        'docs/nested.md': '---\ntitle: Nested\nslug: /a/b\n---\nnested body',
        'docs/sub/simple.md': '---\ntitle: Simple\nslug: plain\n---\nsimple body',
        'docs/num.md': '---\ntitle: Num\nslug: 42\n---\nnum body',
        'docs/x/dup.md': '---\ntitle: Dup One\nslug: /same\n---\ndup one',
        'docs/y/dup.md': '---\ntitle: Dup Two\nslug: /same\n---\ndup two',
      },
      {
        generateMarkdownFiles: true,
        generateLLMsFullTxt: false,
        customLLMFiles: [{ filename: 'llms-y.txt', includePatterns: ['y/**'], fullContent: true }],
      },
      ['/docs/', '/docs/a/b', '/docs/sub/plain', '/docs/42', '/docs/same'],
    );
    check('slug / writes docs.md', r.exists('docs.md') && r.read('docs.md').includes('root body'));
    check('slug /a/b writes a/b.md', r.exists('a/b.md'));
    check('slug plain writes docs/sub/plain.md', r.exists('docs/sub/plain.md'));
    check('numeric slug 42 writes docs/42.md', r.exists('docs/42.md'));
    check(
      'duplicate slugs get docs/same.md and docs/same-2.md',
      r.exists('docs/same.md') &&
        r.read('docs/same.md').includes('dup one') &&
        r.exists('docs/same-2.md') &&
        r.read('docs/same-2.md').includes('dup two'),
      r.exists('docs/same.md') ? `docs/same.md: ${r.read('docs/same.md')}` : 'docs/same.md missing',
    );
    check('regression site writes nothing outside outDir', r.escaped.length === 0);
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
