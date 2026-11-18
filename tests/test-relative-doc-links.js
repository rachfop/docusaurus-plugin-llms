/**
 * Regression tests for issue #97: relative links between docs must resolve to
 * the target page's generated markdown URL in per-page files and llms-full.txt.
 *
 * Run with: node tests/test-relative-doc-links.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const plugin = require('../lib/index').default;

let passed = 0;
let failed = 0;

const INDEX_BODY = `---
title: Section
description: Section index.
---

# Section

[Child](./child.md)
[Child anchor](./child.md#install)
[Other](../other.mdx "Other page")
[Extensionless](./child)
[API](./api(v2).md)
[User](./user's.md)
[Missing](./missing.md)
[External](https://example.org/child.md)
![Diagram](./diagram.png)

> [Quoted child][quoted]
>
> [quoted]: ./child.md
>
>     [Quoted code](./child.md)
>
>     [quoted-code]: ./child.md

    [Indented code](./child.md)

- A list item whose paragraph continues below.

    [List paragraph](./child.md)

\`[Inline code](./child.md)\`

\`\`\`md
[Fenced code](./child.md)
\`\`\`

[Child by reference][child]

[child]: ./child.md
`;

function makeSite(useRelativeUrls, extraOptions = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-doc-links-'));
  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(path.join(tmpDir, 'docs', 'section'), { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'docs', 'section', 'index.md'), INDEX_BODY);
  fs.writeFileSync(
    path.join(tmpDir, 'docs', 'section', 'child.md'),
    '---\ntitle: Child\ndescription: Child page.\n---\n\n# Child\n\n## Install\n\nChild body.',
  );
  fs.writeFileSync(
    path.join(tmpDir, 'docs', 'other.mdx'),
    '---\ntitle: Other\ndescription: Other page.\n---\n\n# Other\n\nOther body.',
  );
  for (const [file, title] of [
    ['api(v2).md', 'API'],
    ["user's.md", 'User'],
  ]) {
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'section', file),
      `---\ntitle: ${title}\ndescription: ${title} page.\n---\n\n# ${title}\n\n${title} body.`,
    );
  }
  fs.writeFileSync(
    path.join(tmpDir, 'docs', 'description.md'),
    '---\ntitle: Description\n---\n\n# Description\n\n[Child](./section/child.md)\n\nMore detail.',
  );

  const p = plugin(
    {
      siteDir: tmpDir,
      siteConfig: { title: 'Test', tagline: 'Test docs', url: 'https://example.com', baseUrl: '/' },
      outDir,
    },
    { generateMarkdownFiles: true, useRelativeUrls, ...extraOptions },
  );
  return { tmpDir, outDir, p };
}

async function testRelativeDocLinks(useRelativeUrls) {
  const name = useRelativeUrls
    ? 'Relative doc links become site-relative markdown URLs'
    : 'Relative doc links become absolute markdown URLs';
  const { tmpDir, outDir, p } = makeSite(useRelativeUrls);
  const prefix = useRelativeUrls ? '' : 'https://example.com';
  try {
    await p.postBuild({
      routesPaths: [
        '/',
        '/section',
        '/section/child',
        '/section/api(v2)',
        "/section/user's",
        '/other',
        '/description',
      ],
    });

    const page = fs.readFileSync(path.join(outDir, 'section.md'), 'utf8');
    const full = fs.readFileSync(path.join(outDir, 'llms-full.txt'), 'utf8');
    for (const [label, content] of [
      ['per-page markdown', page],
      ['llms-full.txt', full],
    ]) {
      assert.ok(
        content.includes(`[Child](${prefix}/section/child.md)`),
        `${label} rewrites the index-page child link:\n${content}`,
      );
      assert.ok(
        content.includes(`[Child anchor](${prefix}/section/child.md#install)`),
        `${label} preserves the anchor`,
      );
      assert.ok(
        content.includes(`[Other](${prefix}/other.md "Other page")`),
        `${label} resolves a parent-directory .mdx link and preserves its title`,
      );
      assert.ok(
        content.includes(`[Extensionless](${prefix}/section/child.md)`),
        `${label} resolves an extensionless doc link`,
      );
      assert.ok(
        content.includes(`[API](${prefix}/section/api(v2).md)`),
        `${label} resolves balanced parentheses in a destination`,
      );
      assert.ok(
        content.includes(`[User](${prefix}/section/user's.md)`),
        `${label} resolves an apostrophe in a destination`,
      );
      assert.ok(
        content.includes(`> [quoted]: ${prefix}/section/child.md`),
        `${label} rewrites a blockquoted reference definition`,
      );
      assert.ok(
        content.includes('    [Indented code](./child.md)'),
        `${label} keeps indented code unchanged`,
      );
      assert.ok(
        content.includes('>     [Quoted code](./child.md)'),
        `${label} keeps blockquoted indented code unchanged`,
      );
      assert.ok(
        content.includes('>     [quoted-code]: ./child.md'),
        `${label} keeps a blockquoted indented reference definition unchanged`,
      );
      assert.ok(
        content.includes(`[List paragraph](${prefix}/section/child.md)`),
        `${label} rewrites a link in a list item's indented paragraph`,
      );
      assert.ok(
        content.includes(`[child]: ${prefix}/section/child.md`),
        `${label} rewrites a reference definition`,
      );
      assert.ok(content.includes('[Missing](./missing.md)'), `${label} keeps unresolved links`);
      assert.ok(
        content.includes('[External](https://example.org/child.md)'),
        `${label} keeps external links`,
      );
      assert.ok(content.includes('![Diagram](./diagram.png)'), `${label} keeps image references`);
      assert.ok(
        content.includes('`[Inline code](./child.md)`'),
        `${label} keeps inline code unchanged`,
      );
      assert.ok(
        content.includes('[Fenced code](./child.md)'),
        `${label} keeps fenced code unchanged`,
      );
    }

    const descriptionPage = fs.readFileSync(path.join(outDir, 'description.md'), 'utf8');
    const rewrittenDescription = `[Child](${prefix}/section/child.md)`;
    assert.ok(
      descriptionPage.includes(`> ${rewrittenDescription}`),
      'the auto-extracted description uses the rewritten link',
    );
    assert.strictEqual(
      descriptionPage.split(rewrittenDescription).length - 1,
      1,
      'the rewritten description paragraph is not duplicated in the body',
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

async function testCustomFilesShareTargets() {
  const name = 'Custom files resolve targets introduced by later custom selections';
  const { tmpDir, outDir, p } = makeSite(false, {
    generateLLMsTxt: false,
    generateLLMsFullTxt: false,
    customLLMFiles: [
      {
        filename: 'intro.txt',
        includePatterns: ['docs/section/index.md'],
        fullContent: true,
      },
      {
        filename: 'all.txt',
        includePatterns: ['docs/section/*.md'],
        fullContent: true,
      },
    ],
  });
  try {
    await p.postBuild({ routesPaths: ['/', '/section', '/section/child'] });
    for (const file of ['section.md', 'intro.txt', 'all.txt']) {
      const content = fs.readFileSync(path.join(outDir, file), 'utf8');
      assert.ok(
        content.includes('[Child](https://example.com/section/child.md)'),
        `${file} uses the shared target map:\n${content}`,
      );
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

async function testStandardLinksResolveCustomTargets() {
  const name = 'Standard outputs resolve links to pages a custom selection generates';
  const { tmpDir, outDir, p } = makeSite(false, {
    includeOrder: ['docs/section/index.md'],
    includeUnmatchedLast: false,
    customLLMFiles: [
      {
        filename: 'child.txt',
        includePatterns: ['docs/section/child.md'],
        fullContent: true,
      },
    ],
  });
  try {
    await p.postBuild({ routesPaths: ['/', '/section', '/section/child', '/other'] });

    const listed = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    assert.ok(
      listed.includes('(https://example.com/section.md)'),
      `llms.txt lists the ordered page:\n${listed}`,
    );
    assert.ok(
      !listed.includes('other.md'),
      'llms.txt lists only the ordered page, matching includeOrder',
    );

    const full = fs.readFileSync(path.join(outDir, 'llms-full.txt'), 'utf8');
    assert.ok(
      !full.includes('Other body.'),
      'llms-full.txt holds only the ordered page, matching includeOrder',
    );
    assert.ok(
      full.includes('[Child](https://example.com/section/child.md)'),
      `llms-full.txt links to the markdown file the custom selection generates:\n${full}`,
    );
    const page = fs.readFileSync(path.join(outDir, 'section.md'), 'utf8');
    assert.ok(
      page.includes('[Child](https://example.com/section/child.md)'),
      'the ordered page links to the custom selection target',
    );
    assert.ok(
      fs.existsSync(path.join(outDir, 'section/child.md')),
      'the custom selection still generates its markdown file',
    );
    assert.ok(fs.existsSync(path.join(outDir, 'child.txt')), 'the custom LLM file is written');
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL: ${name}\n     ${error.message}`);
    failed++;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function testDocsOutsideSiteRoot() {
  const name = 'Links resolve when the docs directory sits outside the site root';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-external-docs-'));
  const outDir = path.join(tmpDir, 'out');
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const { generateIndividualMarkdownFiles } = require('../lib/generator');
    const docs = [
      {
        title: 'Index',
        path: '../docs/index.md',
        url: 'https://example.com/docs',
        content: '[Child](./child.md)',
        description: 'Index description.',
      },
      {
        title: 'Child',
        path: '../docs/child.md',
        url: 'https://example.com/docs/child',
        content: 'Child body.',
        description: 'Child description.',
      },
    ];
    await generateIndividualMarkdownFiles(docs, outDir, 'https://example.com', '../docs');
    const page = fs.readFileSync(path.join(outDir, 'docs.md'), 'utf8');
    assert.ok(
      page.includes('[Child](https://example.com/docs/child.md)'),
      `the external doc's link is rewritten:\n${page}`,
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

async function main() {
  console.log('Testing relative documentation links (#97)...\n');
  await testRelativeDocLinks(false);
  await testRelativeDocLinks(true);
  await testCustomFilesShareTargets();
  await testStandardLinksResolveCustomTargets();
  await testDocsOutsideSiteRoot();
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
