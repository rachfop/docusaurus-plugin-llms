/**
 * Regression tests for generated-output assembly.
 *
 * llms-full.txt embedded each document under a `## {title}` header but left
 * the document's own headings at their original level, so an inner `## Foo`
 * collided with the document header; a body whose first heading matched the
 * title was replaced, leaving stray blank lines. Individual .md files emitted
 * `# {title}` plus the description blockquote and then the body verbatim,
 * duplicating both the title H1 and (when no frontmatter description exists)
 * the first paragraph.
 *
 * Fixes under test:
 * - demoteHeadings: every heading drops one level, fences untouched.
 * - stripDuplicateTitleHeading: body's own H1 matching the title is removed.
 * - stripDuplicateDescriptionParagraph: a leading paragraph identical to the
 *   description is removed; a differing paragraph is kept.
 * - generateLLMFile full-content mode nests inner headings under the doc
 *   header and never emits the body's duplicate H1.
 * - generateIndividualMarkdownFiles drops the duplicated H1 and description
 *   paragraph from the body.
 *
 * Run with: node tests/test-output-assembly.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  demoteHeadings,
  stripDuplicateTitleHeading,
  stripDuplicateDescriptionParagraph,
} = require('../lib/utils');
const { generateLLMFile, generateIndividualMarkdownFiles } = require('../lib/generator');

let passed = 0;
let failed = 0;
function expect(name, cond, detail) {
  if (cond) { console.log(`  ✅ PASS: ${name}`); passed++; }
  else { console.log(`  ❌ FAIL: ${name}\n     ${JSON.stringify(detail)}`); failed++; }
}

async function run() {
  console.log('Testing output assembly...\n');

  // --- unit-level helpers ---

  {
    const out = demoteHeadings('# H1\n\n## H2\n\n### H3');
    expect('headings demote one level', out === '## H1\n\n### H2\n\n#### H3', out);
  }
  {
    const out = demoteHeadings('```\n# Not a heading\n```\n\n# Real');
    expect('demote leaves fenced headings', out.includes('```\n# Not a heading\n```'), out);
    expect('demote hits real heading', /^## Real/m.test(out), out);
  }
  {
    const out = demoteHeadings('###### H6 stays (max depth)');
    expect('H6 not demoted past six', out.includes('###### H6 stays'), out);
  }
  {
    const out = stripDuplicateTitleHeading('# Install (npm)\n\nBody.', 'Install (npm)');
    expect('duplicate title H1 stripped', out.startsWith('Body.'), out);
  }
  {
    const out = stripDuplicateTitleHeading('# Different\n\nBody.', 'Install');
    expect('differing H1 kept', out.startsWith('# Different'), out);
  }
  {
    // Regex metacharacters in the title must not break the match.
    const out = stripDuplicateTitleHeading('# Config.* files (+ more)\n\nBody.', 'Config.* files (+ more)');
    expect('metachar title stripped', out.startsWith('Body.'), out);
  }
  {
    const out = stripDuplicateTitleHeading('```\n# Install\n```\n\n# Install\n\nBody.', 'Install');
    // The fence (with its sample heading) survives verbatim; exactly one
    // heading remains in the output, the fenced one.
    const headingCount = (out.match(/^# Install$/gm) || []).length;
    expect('fenced copy kept, real one stripped',
      out.includes('```\n# Install\n```') && headingCount === 1 && out.includes('Body.'), out);
  }
  {
    const out = stripDuplicateDescriptionParagraph('Install the package.\n\n## Next\n', 'Install the package.');
    expect('duplicate description paragraph stripped', out.startsWith('## Next'), out);
  }
  {
    const out = stripDuplicateDescriptionParagraph('A different intro.\n\n## Next\n', 'Install the package.');
    expect('differing paragraph kept', out.startsWith('A different intro.'), out);
  }
  {
    // A multi-line description (wrapped paragraph) must match its full line
    // block; a partial-prefix overlap must never match.
    const out = stripDuplicateDescriptionParagraph(
      '# T\n\nFirst wrapped line\nsecond line here.\n\n## Next\n',
      'First wrapped line\nsecond line here.'
    );
    expect('multi-line description paragraph stripped',
      !out.includes('First wrapped line') && out.includes('## Next'), out);
  }
  {
    // The description must consume the whole paragraph; a description that
    // merely prefixes a longer body line is not a duplicate.
    const out = stripDuplicateDescriptionParagraph(
      '# T\n\nA longer body line than the description.\n\n## Next\n',
      'A longer body line'
    );
    expect('partial-prefix line kept', out.includes('A longer body line than the description.'), out);
  }

  // --- end-to-end: llms-full.txt ---

  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asm-'));
    const docs = [
      {
        title: 'Install',
        description: 'Install the package.',
        content: '# Install\n\nInstall the package.\n\n## Requirements\n\nNode 18+.',
        url: 'https://s.com/docs/install',
        path: 'docs/install.md',
      },
      {
        title: 'Install',
        description: '',
        content: '# Install\n\nAPI install content.',
        url: 'https://s.com/docs/api/install',
        path: 'docs/api/install.md',
      },
      {
        title: 'Plain',
        description: '',
        content: 'No heading at all here.',
        url: 'https://s.com/docs/plain',
        path: 'docs/plain.md',
      },
    ];
    await generateLLMFile(docs, path.join(dir, 'llms-full.txt'), 'Site', 'All docs', true);
    const out = fs.readFileSync(path.join(dir, 'llms-full.txt'), 'utf8');
    expect('no body H1 in full file', !/^# Install$/m.test(out), out);
    expect('inner heading nested under doc header', /^### Requirements$/m.test(out), out);
    expect('no triple blank lines', !/\n\n\n\n/.test(out), out);
    expect('unique disambiguated headers', out.includes('## Install(Api)'), out);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // --- end-to-end: individual files ---

  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asm2-'));
    const docs = [
      {
        title: 'Install',
        description: 'Install the package.',
        content: '# Install\n\nInstall the package.\n\n## Requirements\n\nNode 18+.',
        url: 'https://s.com/docs/install',
        path: 'docs/install.md',
        frontMatter: {},
      },
      {
        title: 'Fm',
        description: 'Custom frontmatter description.',
        content: '# Fm\n\nBody first paragraph differs.',
        url: 'https://s.com/docs/fm',
        path: 'docs/fm.md',
        frontMatter: {},
      },
    ];
    await generateIndividualMarkdownFiles(docs, dir, 'https://s.com', 'docs');
    const install = fs.readFileSync(path.join(dir, 'docs', 'install.md'), 'utf8');
    const count = (s, re) => (s.match(re) || []).length;
    expect('single H1 in individual file', count(install, /^# Install$/m) === 1, install);
    expect('description paragraph not duplicated', count(install, /Install the package\./gm) === 1, install);
    expect('inner headings untouched in individual file', /^## Requirements$/m.test(install), install);

    const fm = fs.readFileSync(path.join(dir, 'docs', 'fm.md'), 'utf8');
    expect('frontmatter-description file keeps body paragraph', fm.includes('Body first paragraph differs.'), fm);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total: ${passed + failed}\n`);
  return failed === 0;
}

run().then(ok => {
  console.log(ok ? '🎉 All output-assembly tests passed!' : '❌ Some tests failed.');
  process.exit(ok ? 0 : 1);
});
