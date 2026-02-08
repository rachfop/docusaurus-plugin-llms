/**
 * Tests for BOM (Byte Order Mark) handling in markdown files
 *
 * Run with: node test-bom-handling.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock the readFile function from utils.ts
async function readFile(filePath) {
  let content = await fs.promises.readFile(filePath, 'utf8');

  // Remove UTF-8 BOM if present
  // UTF-8 BOM is the character U+FEFF at the start of the file
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  return content;
}

// Test cases for BOM handling
const testCases = [
  {
    name: 'File with UTF-8 BOM',
    content: '\uFEFF# Test Document\n\nThis file has a BOM at the start.',
    expected: '# Test Document\n\nThis file has a BOM at the start.',
    shouldHaveBOM: true
  },
  {
    name: 'File without BOM',
    content: '# Test Document\n\nThis file has no BOM.',
    expected: '# Test Document\n\nThis file has no BOM.',
    shouldHaveBOM: false
  },
  {
    name: 'File with BOM and frontmatter',
    content: '\uFEFF---\ntitle: Test\n---\n\n# Content\n\nSome content here.',
    expected: '---\ntitle: Test\n---\n\n# Content\n\nSome content here.',
    shouldHaveBOM: true
  },
  {
    name: 'Empty file with BOM',
    content: '\uFEFF',
    expected: '',
    shouldHaveBOM: true
  },
  {
    name: 'Empty file without BOM',
    content: '',
    expected: '',
    shouldHaveBOM: false
  },
  {
    name: 'File with BOM and imports',
    content: '\uFEFFimport Component from "./Component";\n\n# Test\n\nContent here.',
    expected: 'import Component from "./Component";\n\n# Test\n\nContent here.',
    shouldHaveBOM: true
  },
  {
    name: 'File with BOM character in the middle (should not be removed)',
    content: '# Test\n\nSome text \uFEFF with BOM in middle.',
    expected: '# Test\n\nSome text \uFEFF with BOM in middle.',
    shouldHaveBOM: false
  },
  {
    name: 'File with multiple lines and BOM at start',
    content: '\uFEFF# Heading 1\n\n## Heading 2\n\nParagraph 1\n\nParagraph 2',
    expected: '# Heading 1\n\n## Heading 2\n\nParagraph 1\n\nParagraph 2',
    shouldHaveBOM: true
  }
];

async function runTests() {
  console.log('Running BOM handling tests...\n');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bom-test-'));
  let passCount = 0;

  try {
    for (let i = 0; i < testCases.length; i++) {
      const test = testCases[i];
      console.log(`Test ${i + 1}: ${test.name}`);

      try {
        // Create a temporary file with the test content
        const testFilePath = path.join(tempDir, `test-${i}.md`);
        await fs.promises.writeFile(testFilePath, test.content, 'utf8');

        // Verify BOM was written correctly
        const rawContent = await fs.promises.readFile(testFilePath, 'utf8');
        const hasBOM = rawContent.charCodeAt(0) === 0xFEFF;

        if (test.shouldHaveBOM && !hasBOM) {
          console.log('  ⚠️  WARNING: BOM was not written to file (this might be a Node.js/filesystem quirk)');
        }

        // Read the file with our BOM-stripping function
        const result = await readFile(testFilePath);

        // Check if BOM was removed
        const resultHasBOM = result.charCodeAt(0) === 0xFEFF;
        const pass = result === test.expected && !resultHasBOM;

        console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}`);

        if (!pass) {
          console.log(`    Expected: "${test.expected}"`);
          console.log(`    Expected first char code: ${test.expected.charCodeAt(0)}`);
          console.log(`    Actual: "${result}"`);
          console.log(`    Actual first char code: ${result.charCodeAt(0)}`);
          console.log(`    Result has BOM: ${resultHasBOM}`);
        }

        if (pass) {
          passCount++;
        }

        // Clean up test file
        await fs.promises.unlink(testFilePath);

      } catch (error) {
        console.log('  ❌ ERROR:', error.message);
      }

      console.log('');
    }
  } finally {
    // Clean up temp directory
    try {
      await fs.promises.rmdir(tempDir);
    } catch (error) {
      // Directory might not be empty or might not exist
    }
  }

  console.log(`Results: ${passCount} of ${testCases.length} tests passed.`);

  if (passCount === testCases.length) {
    console.log('🎉 All BOM handling tests passed!');
  } else {
    console.log('❌ Some BOM handling tests failed.');
    process.exit(1);
  }
}

// Test BOM detection function
function testBOMDetection() {
  console.log('\nRunning BOM detection tests...\n');

  const detectionTests = [
    {
      name: 'String with BOM',
      input: '\uFEFFHello World',
      expectedHasBOM: true,
      expectedWithoutBOM: 'Hello World'
    },
    {
      name: 'String without BOM',
      input: 'Hello World',
      expectedHasBOM: false,
      expectedWithoutBOM: 'Hello World'
    },
    {
      name: 'Empty string',
      input: '',
      expectedHasBOM: false,
      expectedWithoutBOM: ''
    },
    {
      name: 'String with only BOM',
      input: '\uFEFF',
      expectedHasBOM: true,
      expectedWithoutBOM: ''
    }
  ];

  let passCount = 0;

  detectionTests.forEach((test, index) => {
    console.log(`BOM Detection Test ${index + 1}: ${test.name}`);

    try {
      const hasBOM = test.input.charCodeAt(0) === 0xFEFF;
      const withoutBOM = hasBOM ? test.input.slice(1) : test.input;

      const detectionPass = hasBOM === test.expectedHasBOM;
      const removalPass = withoutBOM === test.expectedWithoutBOM;
      const pass = detectionPass && removalPass;

      console.log(`  Detection: ${detectionPass ? '✅ PASS' : '❌ FAIL'}`);
      if (!detectionPass) {
        console.log(`    Expected hasBOM: ${test.expectedHasBOM}, Actual: ${hasBOM}`);
      }

      console.log(`  Removal: ${removalPass ? '✅ PASS' : '❌ FAIL'}`);
      if (!removalPass) {
        console.log(`    Expected: "${test.expectedWithoutBOM}"`);
        console.log(`    Actual: "${withoutBOM}"`);
      }

      if (pass) {
        passCount++;
      }

    } catch (error) {
      console.log('  ❌ ERROR:', error.message);
    }

    console.log('');
  });

  console.log(`BOM Detection Results: ${passCount} of ${detectionTests.length} tests passed.`);

  if (passCount === detectionTests.length) {
    console.log('🎉 All BOM detection tests passed!');
  } else {
    console.log('❌ Some BOM detection tests failed.');
    process.exit(1);
  }
}

// Run the tests
runTests().then(() => {
  testBOMDetection();
});
