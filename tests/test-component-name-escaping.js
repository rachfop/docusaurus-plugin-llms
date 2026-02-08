/**
 * Test script for regex escaping in component names during partial resolution
 *
 * This test verifies that the escapeRegex helper function is properly
 * used for both component names and import paths to ensure correct
 * literal matching when resolving partial imports.
 *
 * While JavaScript identifiers can't contain most special regex chars,
 * this test ensures the code is defensive and uses proper escaping
 * consistently for both component names and paths.
 *
 * Run with: node tests/test-component-name-escaping.js
 */

const fs = require('fs').promises;
const path = require('path');
const { resolvePartialImports } = require('../lib/utils');

async function setupTestFiles() {
  const testDir = path.join(__dirname, 'test-component-escaping-temp');

  // Clean up if exists
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (err) {
    // Ignore if doesn't exist
  }

  await fs.mkdir(testDir, { recursive: true });

  return testDir;
}

// Test cases focusing on valid JavaScript identifiers
// and edge cases with import paths containing special characters
const testCases = [
  {
    name: 'Normal component with path containing special chars',
    componentName: 'SharedConfig',
    partialFileName: '_config-v1.0.mdx',  // Path with dots
    partialContent: 'Configuration content',
    mainContent: 'import SharedConfig from \'./_config-v1.0.mdx\';\n\n<SharedConfig />\n\nOther content',
    expectedContent: 'Configuration content\n\nOther content',
    description: 'Import path with dots should be escaped properly'
  },
  {
    name: 'Component with path containing parentheses',
    componentName: 'APIGuide',
    partialFileName: '_api(v2).mdx',  // Path with parentheses
    partialContent: 'API guide content',
    mainContent: 'import APIGuide from \'./_api(v2).mdx\';\n\n<APIGuide />\n\nMore info',
    expectedContent: 'API guide content\n\nMore info',
    description: 'Import path with parentheses should be escaped'
  },
  {
    name: 'Component with path containing square brackets',
    componentName: 'ArrayDocs',
    partialFileName: '_array[methods].mdx',  // Path with brackets
    partialContent: 'Array methods documentation',
    mainContent: 'import ArrayDocs from \'./_array[methods].mdx\';\n\n<ArrayDocs />\n\nExample',
    expectedContent: 'Array methods documentation\n\nExample',
    description: 'Import path with square brackets should be escaped'
  },
  {
    name: 'Component with path containing plus signs',
    componentName: 'CppGuide',
    partialFileName: '_c++guide.mdx',  // Path with ++
    partialContent: 'C++ programming guide',
    mainContent: 'import CppGuide from \'./_c++guide.mdx\';\n\n<CppGuide />\n\nDetails',
    expectedContent: 'C++ programming guide\n\nDetails',
    description: 'Import path with ++ should be escaped'
  },
  {
    name: 'Component with path containing dollar sign',
    componentName: 'PriceInfo',
    partialFileName: '_price$info.mdx',  // Path with $
    partialContent: 'Price information',
    mainContent: 'import PriceInfo from \'./_price$info.mdx\';\n\n<PriceInfo />\n\nNotes',
    expectedContent: 'Price information\n\nNotes',
    description: 'Import path with $ should be escaped'
  },
  {
    name: 'Component with path containing asterisk',
    componentName: 'WildcardTest',
    partialFileName: '_test*.mdx',  // Path with *
    partialContent: 'Wildcard test content',
    mainContent: 'import WildcardTest from \'./_test*.mdx\';\n\n<WildcardTest />\n\nText',
    expectedContent: 'Wildcard test content\n\nText',
    description: 'Import path with * should be escaped'
  },
  {
    name: 'Component with path containing question mark',
    componentName: 'HelpDoc',
    partialFileName: '_help?.mdx',  // Path with ?
    partialContent: 'Help documentation',
    mainContent: 'import HelpDoc from \'./_help?.mdx\';\n\n<HelpDoc />\n\nFAQ',
    expectedContent: 'Help documentation\n\nFAQ',
    description: 'Import path with ? should be escaped'
  },
  {
    name: 'Component with path containing caret',
    componentName: 'ConfigSettings',
    partialFileName: '_config^settings.mdx',  // Path with ^
    partialContent: 'Configuration settings',
    mainContent: 'import ConfigSettings from \'./_config^settings.mdx\';\n\n<ConfigSettings />\n\nInfo',
    expectedContent: 'Configuration settings\n\nInfo',
    description: 'Import path with ^ should be escaped'
  },
  {
    name: 'Component with path containing pipe',
    componentName: 'OptionSelect',
    partialFileName: '_option|select.mdx',  // Path with |
    partialContent: 'Option selection guide',
    mainContent: 'import OptionSelect from \'./_option|select.mdx\';\n\n<OptionSelect />\n\nMore',
    expectedContent: 'Option selection guide\n\nMore',
    description: 'Import path with | should be escaped'
  },
  {
    name: 'Component with path containing curly braces',
    componentName: 'TemplateDoc',
    partialFileName: '_template{}.mdx',  // Path with {}
    partialContent: 'Template content',
    mainContent: 'import TemplateDoc from \'./_template{}.mdx\';\n\n<TemplateDoc />\n\nExample',
    expectedContent: 'Template content\n\nExample',
    description: 'Import path with {} should be escaped'
  },
  {
    name: 'Normal component without special chars',
    componentName: 'SimpleComponent',
    partialFileName: '_simple.mdx',
    partialContent: 'Simple content',
    mainContent: 'import SimpleComponent from \'./_simple.mdx\';\n\n<SimpleComponent />\n\nText',
    expectedContent: 'Simple content\n\nText',
    description: 'Normal paths without special characters should still work'
  },
  {
    name: 'Destructured import with special chars in path',
    componentName: 'SpecialComponent',
    partialFileName: '_special-v1.0.mdx',
    partialContent: 'Special component content',
    mainContent: 'import { SpecialComponent } from \'./_special-v1.0.mdx\';\n\n<SpecialComponent />\n\nMore',
    expectedContent: 'Special component content\n\nMore',
    description: 'Destructured imports with special chars in path should work'
  },
  {
    name: 'Component with complex path',
    componentName: 'ComplexDoc',
    partialFileName: '_api(v2.0)[beta]*.mdx',  // Path with multiple special chars
    partialContent: 'Complex documentation',
    mainContent: 'import ComplexDoc from \'./_api(v2.0)[beta]*.mdx\';\n\n<ComplexDoc />\n\nNotes',
    expectedContent: 'Complex documentation\n\nNotes',
    description: 'Path with multiple special characters should all be escaped'
  },
  {
    name: 'Regex injection prevention in path',
    componentName: 'TestComponent',
    partialFileName: '_test.star.mdx',  // Path with dots that could match regex
    partialContent: 'Test content',
    mainContent: 'import TestComponent from \'./_test.star.mdx\';\n\n<TestComponent />\n\nData',
    expectedContent: 'Test content\n\nData',
    description: 'Path with dots should be treated literally, not as regex wildcard'
  },
  {
    name: 'Multiple imports with special paths',
    componentName: 'FirstComponent',
    partialFileName: '_first-v1.0.mdx',
    partialContent: 'First component',
    mainContent: 'import FirstComponent from \'./_first-v1.0.mdx\';\nimport SecondComponent from \'./_second.mdx\';\n\n<FirstComponent />\n\nText',
    expectedContent: 'First component\n\nText',
    description: 'Multiple imports with mixed special characters should work'
  }
];

// Run tests
async function runTests() {
  console.log('Running component name and path regex escaping tests...\n');
  console.log('='.repeat(80));
  console.log('COMPONENT NAME AND PATH REGEX ESCAPING TESTS');
  console.log('='.repeat(80));
  console.log();

  const testDir = await setupTestFiles();
  let passCount = 0;
  let failCount = 0;

  try {
    for (let i = 0; i < testCases.length; i++) {
      const test = testCases[i];
      console.log(`Test ${i + 1}: ${test.name}`);
      console.log(`  Description: ${test.description}`);
      console.log(`  Component: "${test.componentName}", Path: "${test.partialFileName}"`);

      try {
        // Create a partial file with the component's content
        const partialPath = path.join(testDir, test.partialFileName);
        await fs.writeFile(partialPath, `---\ntitle: Test Partial\n---\n\n${test.partialContent}`);

        // Create a main file that imports the partial
        const mainFilePath = path.join(testDir, `main-${i}.md`);
        await fs.writeFile(mainFilePath, test.mainContent);

        // Resolve the partial imports
        const result = await resolvePartialImports(test.mainContent, mainFilePath);

        // Normalize whitespace for comparison
        const normalizedResult = result.trim().replace(/\s+/g, ' ');
        const normalizedExpected = test.expectedContent.trim().replace(/\s+/g, ' ');

        console.log(`  Expected: "${test.expectedContent.replace(/\n/g, '\\n')}"`);
        console.log(`  Result:   "${result.replace(/\n/g, '\\n')}"`);

        if (normalizedResult === normalizedExpected) {
          console.log('  ✅ PASS');
          passCount++;
        } else {
          console.log('  ❌ FAIL');
          console.log(`  Normalized Expected: "${normalizedExpected}"`);
          console.log(`  Normalized Result:   "${normalizedResult}"`);
          failCount++;
        }
      } catch (error) {
        console.log(`  ❌ FAIL: ${error.message}`);
        console.error(error);
        failCount++;
      }

      console.log();
    }
  } finally {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  console.log('='.repeat(80));
  console.log(`SUMMARY: ${passCount} passed, ${failCount} failed out of ${testCases.length} tests`);
  console.log('='.repeat(80));

  if (failCount > 0) {
    console.log('\n⚠️  Some tests failed.');
    console.log('Special regex characters in paths must be escaped to prevent regex injection.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Component name and path escaping is working correctly.');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
