/**
 * Unit tests for description extraction and cleaning functionality, through
 * the real processMarkdownFile and cleanMarkdownContent.
 *
 * In YAML, ` #` starts a comment, so an unquoted front matter value such as
 * `description: Learn about the # symbol` parses as "Learn about the", the
 * same value Docusaurus reads; a `#` that belongs to the text needs quotes.
 *
 * Run with: node tests/test-description-extraction.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { processMarkdownFile } = require('../lib/processor');
const { cleanMarkdownContent } = require('../lib/utils');

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${name}`);
    console.log(`     expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

const longText = Array(20)
  .fill('This is a very long description that should be truncated for TOC items. ')
  .join('')
  .trim();

const testCases = [
  {
    name: 'Description from frontmatter',
    input: `---
title: Test Page
description: This is a test description
---

# Test Header

This is some content.`,
    expected: 'This is a test description',
  },
  {
    name: 'Description from first paragraph',
    input: `---
title: Test Page
---

# Test Header

This is the first paragraph that should become the description.

This is other content.`,
    expected: 'This is the first paragraph that should become the description.',
  },
  {
    name: 'Quoted description keeps an inline hashtag symbol',
    input: `---
title: Test Page
description: "Learn about the # symbol in Markdown"
---

# Test Header

Content here.`,
    expected: 'Learn about the # symbol in Markdown',
  },
  {
    name: 'Unquoted " #" starts a YAML comment',
    input: `---
title: Test Page
description: Learn about the # symbol in Markdown
---

# Test Header

Content here.`,
    expected: 'Learn about the',
  },
  {
    name: 'A description that is only a YAML comment falls back to the first paragraph',
    input: `---
title: Test Page
description: # This is a YAML comment
---

# Test Header

Content here.`,
    expected: 'Content here.',
  },
  {
    name: 'Multi-line description is kept whole',
    input: `---
title: Test Page
description: |
  First line of description
  Second line that should be included
  Third line with some # characters that should be preserved
---

# Test Header

Content here.`,
    expected:
      'First line of description\nSecond line that should be included\nThird line with some # characters that should be preserved\n',
  },
  {
    name: 'Description from header when no paragraphs available',
    input: `---
title: Test Page
---

# This Will Become The Description

# Another Heading`,
    expected: 'This Will Become The Description',
  },
  {
    name: 'Frontmatter description with HTML is kept as written',
    input: `---
title: Test Page
description: This has <strong>HTML</strong> in it
---

# Test Header

Content here.`,
    expected: 'This has <strong>HTML</strong> in it',
  },
  {
    name: 'Very long frontmatter description is kept whole (the TOC truncates it)',
    input: `---
title: Test Page
description: ${longText}
---

# Test Header

Content here.`,
    expected: longText,
  },
];

async function runTests() {
  console.log('Running description extraction tests...\n');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-description-extraction-'));
  try {
    for (const [index, test] of testCases.entries()) {
      const file = path.join(dir, `case-${index}.md`);
      fs.writeFileSync(file, test.input);
      const doc = await processMarkdownFile(file, dir, 'https://example.com', 'docs');
      check(test.name, doc ? doc.description : null, test.expected);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runXmlPreservationTests() {
  console.log('\n=== XML Preservation Tests ===\n');

  const xmlTests = [
    {
      name: 'Preserve XML plist tags',
      input: '```xml\n<dict><key>test</key><string>value</string></dict>\n```',
      shouldHave: ['<dict>', '<key>test</key>', '<string>value</string>'],
      shouldNotHave: [],
    },
    {
      name: 'Remove HTML but keep XML',
      input: 'Text with <strong>bold</strong>\n```xml\n<plist><dict></dict></plist>\n```',
      shouldHave: ['<plist>', '<dict>'],
      shouldNotHave: ['<strong>'],
    },
  ];

  for (const test of xmlTests) {
    const cleaned = cleanMarkdownContent(test.input);
    const hasAll = test.shouldHave.every((tag) => cleaned.includes(tag));
    const hasNone = test.shouldNotHave.every((tag) => !cleaned.includes(tag));
    check(test.name, hasAll && hasNone, true);
  }
}

runTests()
  .then(() => {
    runXmlPreservationTests();
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
