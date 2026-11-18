/**
 * Regression tests for issue #98: a Docusaurus route ending in .md is a
 * directory in the build output, so the page's markdown copy needs a distinct
 * filename. One unwritable page must not prevent the other LLM files from
 * being written.
 *
 * Run with: node tests/test-route-md-collision.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const plugin = require('../lib/index').default;
const { generateIndividualMarkdownFiles } = require('../lib/generator');

let passed = 0;
let failed = 0;

function page(title, slug) {
  const slugLine = slug ? `slug: ${slug}\n` : '';
  return `---\ntitle: ${title}\n${slugLine}description: ${title} page.\n---\n\n# ${title}\n\n${title} body.`;
}

function makeSite(docs, slugs = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-route-md-'));
  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const [file, title] of Object.entries(docs)) {
    const filePath = path.join(tmpDir, 'docs', file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, page(title, slugs[file]));
  }
  return { tmpDir, outDir };
}

async function build(tmpDir, outDir, routesPaths) {
  await plugin(
    {
      siteDir: tmpDir,
      siteConfig: { title: 'Test', tagline: 'Test docs', url: 'https://example.com', baseUrl: '/' },
      outDir,
    },
    { generateMarkdownFiles: true },
  ).postBuild({ routesPaths });
}

async function testRouteEndingInMd() {
  const name = 'A route ending in .md gets a non-colliding markdown file and llms outputs';
  const { tmpDir, outDir } = makeSite(
    {
      'intro.md': 'Intro',
      'guide/fiber.md': 'Fiber',
    },
    { 'guide/fiber.md': 'fiber.md' },
  );
  try {
    // Docusaurus serves this route from a directory containing index.html.
    fs.mkdirSync(path.join(outDir, 'guide', 'fiber.md'), { recursive: true });
    fs.writeFileSync(path.join(outDir, 'guide', 'fiber.md', 'index.html'), '<html></html>');
    await build(tmpDir, outDir, ['/', '/intro', '/guide/fiber.md']);

    const markdownPath = path.join(outDir, 'guide', 'fiber.md.md');
    assert.ok(fs.existsSync(markdownPath), 'the markdown copy is guide/fiber.md.md');
    assert.ok(fs.statSync(markdownPath).isFile(), 'the markdown copy is a file');
    for (const filename of ['llms.txt', 'llms-full.txt']) {
      assert.ok(fs.existsSync(path.join(outDir, filename)), `${filename} is written`);
    }
    const llms = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    assert.ok(
      llms.includes('(https://example.com/guide/fiber.md.md)'),
      `llms.txt links the generated file:\n${llms}`,
    );
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL: ${name}\n     ${error.message}`);
    failed++;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function testUnwritablePageDoesNotAbort() {
  const name = 'An unwritable page does not prevent other markdown and llms outputs';
  const { tmpDir, outDir } = makeSite({ 'intro.md': 'Intro', 'blocked.md': 'Blocked' });
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'intro.md'),
      page('Intro').replace('Intro body.', '[Blocked](./blocked.md)'),
    );
    // Force EISDIR for this one output file.
    fs.mkdirSync(path.join(outDir, 'blocked.md'), { recursive: true });
    await build(tmpDir, outDir, ['/', '/intro', '/blocked']);

    assert.ok(fs.existsSync(path.join(outDir, 'intro.md')), 'the writable page is generated');
    for (const filename of ['llms.txt', 'llms-full.txt']) {
      assert.ok(fs.existsSync(path.join(outDir, filename)), `${filename} is still written`);
    }
    const llms = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    assert.ok(llms.includes('(https://example.com/intro.md)'), 'the writable page keeps its link');
    assert.ok(
      llms.includes('(https://example.com/blocked)'),
      'the unwritable page falls back to its HTML route',
    );
    const intro = fs.readFileSync(path.join(outDir, 'intro.md'), 'utf8');
    const full = fs.readFileSync(path.join(outDir, 'llms-full.txt'), 'utf8');
    for (const content of [intro, full]) {
      assert.ok(
        content.includes('[Blocked](https://example.com/blocked)'),
        'links to the unwritable page use its HTML route',
      );
      assert.ok(!content.includes('/blocked.md)'), 'no output links the unwritable markdown file');
    }
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL: ${name}\n     ${error.message}`);
    failed++;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function testDuplicateSourceFailureIsPerFile() {
  const name = 'A failed duplicate source path does not invalidate its successful duplicate';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-duplicate-write-'));
  const outDir = path.join(tmpDir, 'out');
  try {
    fs.mkdirSync(path.join(outDir, 'duplicate.md'), { recursive: true });
    const docs = ['First', 'Second'].map((title) => ({
      title,
      path: 'docs/duplicate.md',
      url: 'https://example.com/duplicate',
      content: `${title} body.`,
      description: `${title} description.`,
    }));
    const result = await generateIndividualMarkdownFiles(docs, outDir, 'https://example.com');
    assert.strictEqual(result[0].markdownFile, false, 'the failed file uses its HTML route');
    assert.strictEqual(
      result[1].url,
      'https://example.com/duplicate-2.md',
      'the successful duplicate keeps its own markdown URL',
    );
    assert.ok(
      fs.existsSync(path.join(outDir, 'duplicate-2.md')),
      'the successful duplicate remains on disk',
    );
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL: ${name}\n     ${error.message}`);
    failed++;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function testCorrectiveWriteFailureFallsBack() {
  const name = 'A failed corrective write removes the stale file and uses the HTML route';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-corrective-write-'));
  const outDir = path.join(tmpDir, 'out');
  const fsPromises = require('fs/promises');
  const originalWriteFile = fsPromises.writeFile;
  const sourcePath = path.join(outDir, 'source.md');
  let sourceWrites = 0;
  try {
    fs.mkdirSync(path.join(outDir, 'target.md'), { recursive: true });
    const docs = [
      {
        title: 'Source',
        path: 'docs/source.md',
        url: 'https://example.com/source',
        content: '[Target](./target.md)',
        description: 'Source description.',
      },
      {
        title: 'Target',
        path: 'docs/target.md',
        url: 'https://example.com/target',
        content: 'Target body.',
        description: 'Target description.',
      },
    ];
    fsPromises.writeFile = async (filePath, ...args) => {
      if (filePath === sourcePath && ++sourceWrites === 2) {
        const error = new Error('Injected corrective-write failure');
        error.code = 'EIO';
        throw error;
      }
      return originalWriteFile(filePath, ...args);
    };

    const result = await generateIndividualMarkdownFiles(docs, outDir, 'https://example.com');
    assert.strictEqual(sourceWrites, 2, 'the corrective write was attempted');
    assert.strictEqual(result[0].url, 'https://example.com/source');
    assert.strictEqual(result[0].markdownFile, false);
    assert.ok(!fs.existsSync(sourcePath), 'the stale source markdown file is removed');
    assert.strictEqual(result[1].url, 'https://example.com/target');
    assert.strictEqual(result[1].markdownFile, false);
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL: ${name}\n     ${error.message}`);
    failed++;
  } finally {
    fsPromises.writeFile = originalWriteFile;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function testEarlierPassFileSurvivesFailure() {
  const name = 'A failed rewrite keeps the markdown file an earlier pass assigned';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-earlier-pass-'));
  const outDir = path.join(tmpDir, 'out');
  const fsPromises = require('fs/promises');
  const originalWriteFile = fsPromises.writeFile;
  const registry = { usedPaths: new Set(), docPaths: new Map(), markdownUrls: new Map() };
  const sourcePath = path.join(outDir, 'source.md');
  const source = {
    title: 'Source',
    path: 'docs/source.md',
    url: 'https://example.com/source',
    content: 'Source body.',
    description: 'Source description.',
  };
  const target = {
    title: 'Target',
    path: 'docs/target.md',
    url: 'https://example.com/target',
    content: 'Target body.',
    description: 'Target description.',
  };
  let sourceWrites = 0;
  try {
    fs.mkdirSync(outDir, { recursive: true });
    // The first pass generates both files and registers their paths.
    await generateIndividualMarkdownFiles(
      [source, target],
      outDir,
      'https://example.com',
      'docs',
      [],
      true,
      undefined,
      '',
      registry,
    );
    assert.ok(fs.existsSync(sourcePath), 'the first pass writes the source file');

    // The target's path becomes unwritable, and the source rewrite that
    // follows the target's failure fails too.
    fs.rmSync(path.join(outDir, 'target.md'));
    fs.mkdirSync(path.join(outDir, 'target.md'));
    fsPromises.writeFile = async (filePath, ...args) => {
      if (filePath === sourcePath && ++sourceWrites === 2) {
        const error = new Error('Injected corrective-write failure');
        error.code = 'EIO';
        throw error;
      }
      return originalWriteFile(filePath, ...args);
    };

    const result = await generateIndividualMarkdownFiles(
      [
        { ...source, content: '[Target](./target.md)' },
        { ...target, content: 'Target body with [Source](./source.md).' },
      ],
      outDir,
      'https://example.com',
      'docs',
      [],
      true,
      undefined,
      '',
      registry,
    );
    assert.strictEqual(sourceWrites, 2, 'the rewrite is attempted after the target fails');
    assert.strictEqual(result[0].markdownFile, false, 'the source falls back to its HTML route');
    assert.ok(
      fs.existsSync(sourcePath),
      'the file an earlier pass wrote stays on disk for that pass to link to',
    );
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL: ${name}\n     ${error.message}`);
    failed++;
  } finally {
    fsPromises.writeFile = originalWriteFile;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  console.log('Testing markdown route collisions (#98)...\n');
  await testRouteEndingInMd();
  await testUnwritablePageDoesNotAbort();
  await testDuplicateSourceFailureIsPerFile();
  await testCorrectiveWriteFailureFallsBack();
  await testEarlierPassFileSurvivesFailure();
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
