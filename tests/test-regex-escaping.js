/**
 * Test script for regex escaping in path transformation
 *
 * This test verifies that special regex characters in ignorePath
 * are properly escaped to prevent regex injection and ensure
 * correct literal matching.
 *
 * Run with: node tests/test-regex-escaping.js
 */

const { applyPathTransformations } = require('../lib/utils');

// Test cases for regex escaping
const testCases = [
  {
    name: 'Literal dot should not match any character',
    input: 'docs/backup/test',
    config: { ignorePaths: ['docs.backup'] },
    expected: 'docs/backup/test',  // Should NOT match because . is literal
    description: 'docs.backup should only match literal "docs.backup", not "docs/backup"'
  },
  {
    name: 'Literal dot should match when present',
    input: 'docs.backup/test',
    config: { ignorePaths: ['docs.backup'] },
    expected: 'test',  // Should match literal "docs.backup"
    description: 'docs.backup should match literal "docs.backup"'
  },
  {
    name: 'Asterisk should be treated as literal character',
    input: 'api/methods/test',
    config: { ignorePaths: ['api*'] },
    expected: 'api/methods/test',  // Should NOT match because * is literal
    description: 'api* should only match literal "api*", not "api"'
  },
  {
    name: 'Asterisk literal should match when present',
    input: 'api*/methods/test',
    config: { ignorePaths: ['api*'] },
    expected: 'methods/test',  // Should match literal "api*"
    description: 'api* should match literal "api*"'
  },
  {
    name: 'Plus sign should be treated as literal',
    input: 'c++/reference/test',
    config: { ignorePaths: ['c++'] },
    expected: 'reference/test',  // Should match literal "c++"
    description: 'c++ should match literal "c++"'
  },
  {
    name: 'Question mark should be treated as literal',
    input: 'help?/faq/test',
    config: { ignorePaths: ['help?'] },
    expected: 'faq/test',  // Should match literal "help?"
    description: 'help? should match literal "help?"'
  },
  {
    name: 'Caret should be treated as literal',
    input: 'docs^/test',
    config: { ignorePaths: ['docs^'] },
    expected: 'test',  // Should match literal "docs^"
    description: 'docs^ should match literal "docs^"'
  },
  {
    name: 'Dollar sign should be treated as literal',
    input: 'price$/test',
    config: { ignorePaths: ['price$'] },
    expected: 'test',  // Should match literal "price$"
    description: 'price$ should match literal "price$"'
  },
  {
    name: 'Curly braces should be treated as literal',
    input: 'template{}/test',
    config: { ignorePaths: ['template{}'] },
    expected: 'test',  // Should match literal "template{}"
    description: 'template{} should match literal "template{}"'
  },
  {
    name: 'Parentheses should be treated as literal',
    input: 'func()/test',
    config: { ignorePaths: ['func()'] },
    expected: 'test',  // Should match literal "func()"
    description: 'func() should match literal "func()"'
  },
  {
    name: 'Pipe should be treated as literal',
    input: 'option|/test',
    config: { ignorePaths: ['option|'] },
    expected: 'test',  // Should match literal "option|"
    description: 'option| should match literal "option|"'
  },
  {
    name: 'Square brackets should be treated as literal',
    input: 'array[]/test',
    config: { ignorePaths: ['array[]'] },
    expected: 'test',  // Should match literal "array[]"
    description: 'array[] should match literal "array[]"'
  },
  {
    name: 'Backslash should be treated as literal',
    input: 'windows\\path/test',
    config: { ignorePaths: ['windows\\path'] },
    expected: 'test',  // Should match literal "windows\path"
    description: 'windows\\path should match literal "windows\\path"'
  },
  {
    name: 'Version number with dot',
    input: 'v1.0/api/test',
    config: { ignorePaths: ['v1.0'] },
    expected: 'api/test',  // Should match literal "v1.0"
    description: 'v1.0 should match literal "v1.0", not "v1X0"'
  },
  {
    name: 'Version number should not wildcard',
    input: 'v1X0/api/test',
    config: { ignorePaths: ['v1.0'] },
    expected: 'v1X0/api/test',  // Should NOT match because dot is literal
    description: 'v1.0 should not match "v1X0"'
  },
  {
    name: 'Multiple special characters combined',
    input: 'api*v1.0/test',
    config: { ignorePaths: ['api*v1.0'] },
    expected: 'test',  // Should match literal "api*v1.0"
    description: 'api*v1.0 should match literal "api*v1.0"'
  },
  {
    name: 'Complex path with special characters',
    input: 'docs/api(v2.0)/methods/test',
    config: { ignorePaths: ['api(v2.0)'] },
    expected: 'docs/methods/test',  // Should match literal "api(v2.0)"
    description: 'api(v2.0) should match literal "api(v2.0)"'
  },
  {
    name: 'Normal path without special characters still works',
    input: 'docs/api/test',
    config: { ignorePaths: ['docs'] },
    expected: 'api/test',  // Normal case should still work
    description: 'Normal path transformation should still work'
  },
  {
    name: 'Multiple ignorePaths with special characters',
    input: 'v1.0/api*/test',
    config: { ignorePaths: ['v1.0', 'api*'] },
    expected: 'test',  // Should match both literal patterns
    description: 'Multiple ignorePaths with special chars should work'
  },
  {
    name: 'Regex injection attempt should fail',
    input: 'docs/api/test',
    config: { ignorePaths: ['.*'] },
    expected: 'docs/api/test',  // Should NOT match because .* is treated as literal ".*", not as wildcard
    description: '.* should not act as a regex wildcard matching everything'
  },
  {
    name: 'Regex injection with literal match',
    input: '.*/test',
    config: { ignorePaths: ['.*'] },
    expected: 'test',  // Should match literal ".*"
    description: '.* should match literal ".*" when present'
  }
];

// Run tests
function runTests() {
  console.log('Running regex escaping tests...\n');
  console.log('='.repeat(80));
  console.log('REGEX ESCAPING SECURITY AND CORRECTNESS TESTS');
  console.log('='.repeat(80));
  console.log();

  let passCount = 0;
  let failCount = 0;

  testCases.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.name}`);
    console.log(`  Description: ${test.description}`);
    console.log(`  Input path: "${test.input}"`);
    console.log(`  Ignore pattern: ${JSON.stringify(test.config.ignorePaths)}`);

    const result = applyPathTransformations(test.input, test.config);
    console.log(`  Expected: "${test.expected}"`);
    console.log(`  Result:   "${result}"`);

    if (result === test.expected) {
      console.log('  ✅ PASS');
      passCount++;
    } else {
      console.log('  ❌ FAIL');
      failCount++;
    }

    console.log();
  });

  console.log('='.repeat(80));
  console.log(`SUMMARY: ${passCount} passed, ${failCount} failed out of ${testCases.length} tests`);
  console.log('='.repeat(80));

  if (failCount > 0) {
    console.log('\n⚠️  Some tests failed. This indicates a security or correctness issue.');
    console.log('Special regex characters must be escaped to prevent regex injection.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Regex escaping is working correctly.');
    process.exit(0);
  }
}

runTests();
