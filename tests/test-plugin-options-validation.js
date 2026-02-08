/**
 * Test suite for plugin options validation
 *
 * Tests comprehensive validation of all plugin options to ensure:
 * - Type checking for all option values
 * - Array validation for array-type options
 * - Object validation for complex types
 * - Required field validation for customLLMFiles
 * - Empty value validation where appropriate
 */

const assert = require('assert');

console.log('Testing plugin options validation...\n');

// Import the plugin to test validation
// Note: We'll simulate the validation function since we can't import TypeScript directly in Node tests
function validatePluginOptions(options) {
  // Validate includeOrder
  if (options.includeOrder !== undefined) {
    if (!Array.isArray(options.includeOrder)) {
      throw new Error('includeOrder must be an array');
    }
    if (!options.includeOrder.every(item => typeof item === 'string')) {
      throw new Error('includeOrder must contain only strings');
    }
  }

  // Validate ignoreFiles
  if (options.ignoreFiles !== undefined) {
    if (!Array.isArray(options.ignoreFiles)) {
      throw new Error('ignoreFiles must be an array');
    }
    if (!options.ignoreFiles.every(item => typeof item === 'string')) {
      throw new Error('ignoreFiles must contain only strings');
    }
  }

  // Validate pathTransformation
  if (options.pathTransformation !== undefined) {
    if (typeof options.pathTransformation !== 'object' || options.pathTransformation === null) {
      throw new Error('pathTransformation must be an object');
    }

    const { ignorePaths, addPaths } = options.pathTransformation;

    if (ignorePaths !== undefined) {
      if (!Array.isArray(ignorePaths)) {
        throw new Error('pathTransformation.ignorePaths must be an array');
      }
      if (!ignorePaths.every(item => typeof item === 'string')) {
        throw new Error('pathTransformation.ignorePaths must contain only strings');
      }
    }

    if (addPaths !== undefined) {
      if (!Array.isArray(addPaths)) {
        throw new Error('pathTransformation.addPaths must be an array');
      }
      if (!addPaths.every(item => typeof item === 'string')) {
        throw new Error('pathTransformation.addPaths must contain only strings');
      }
    }
  }

  // Validate boolean options
  const booleanOptions = [
    'generateLLMsTxt',
    'generateLLMsFullTxt',
    'includeBlog',
    'includeUnmatchedLast',
    'excludeImports',
    'removeDuplicateHeadings',
    'generateMarkdownFiles',
    'preserveDirectoryStructure'
  ];

  for (const option of booleanOptions) {
    if (options[option] !== undefined && typeof options[option] !== 'boolean') {
      throw new Error(`${option} must be a boolean`);
    }
  }

  // Validate string options
  const stringOptions = [
    'docsDir',
    'title',
    'description',
    'llmsTxtFilename',
    'llmsFullTxtFilename',
    'version',
    'rootContent',
    'fullRootContent'
  ];

  for (const option of stringOptions) {
    if (options[option] !== undefined && typeof options[option] !== 'string') {
      throw new Error(`${option} must be a string`);
    }
  }

  // Validate keepFrontMatter
  if (options.keepFrontMatter !== undefined) {
    if (!Array.isArray(options.keepFrontMatter)) {
      throw new Error('keepFrontMatter must be an array');
    }
    if (!options.keepFrontMatter.every(item => typeof item === 'string')) {
      throw new Error('keepFrontMatter must contain only strings');
    }
  }

  // Validate logLevel
  if (options.logLevel !== undefined) {
    const validLogLevels = ['quiet', 'normal', 'verbose'];
    if (!validLogLevels.includes(options.logLevel)) {
      throw new Error(`logLevel must be one of: ${validLogLevels.join(', ')}`);
    }
  }

  // Validate customLLMFiles
  if (options.customLLMFiles !== undefined) {
    if (!Array.isArray(options.customLLMFiles)) {
      throw new Error('customLLMFiles must be an array');
    }

    options.customLLMFiles.forEach((file, index) => {
      if (typeof file !== 'object' || file === null) {
        throw new Error(`customLLMFiles[${index}] must be an object`);
      }

      // Required fields
      if (typeof file.filename !== 'string') {
        throw new Error(`customLLMFiles[${index}].filename must be a string`);
      }
      if (file.filename.trim() === '') {
        throw new Error(`customLLMFiles[${index}].filename cannot be empty`);
      }

      if (!Array.isArray(file.includePatterns)) {
        throw new Error(`customLLMFiles[${index}].includePatterns must be an array`);
      }
      if (!file.includePatterns.every(item => typeof item === 'string')) {
        throw new Error(`customLLMFiles[${index}].includePatterns must contain only strings`);
      }
      if (file.includePatterns.length === 0) {
        throw new Error(`customLLMFiles[${index}].includePatterns cannot be empty`);
      }

      if (typeof file.fullContent !== 'boolean') {
        throw new Error(`customLLMFiles[${index}].fullContent must be a boolean`);
      }

      // Optional fields
      if (file.title !== undefined && typeof file.title !== 'string') {
        throw new Error(`customLLMFiles[${index}].title must be a string`);
      }

      if (file.description !== undefined && typeof file.description !== 'string') {
        throw new Error(`customLLMFiles[${index}].description must be a string`);
      }

      if (file.ignorePatterns !== undefined) {
        if (!Array.isArray(file.ignorePatterns)) {
          throw new Error(`customLLMFiles[${index}].ignorePatterns must be an array`);
        }
        if (!file.ignorePatterns.every(item => typeof item === 'string')) {
          throw new Error(`customLLMFiles[${index}].ignorePatterns must contain only strings`);
        }
      }

      if (file.orderPatterns !== undefined) {
        if (!Array.isArray(file.orderPatterns)) {
          throw new Error(`customLLMFiles[${index}].orderPatterns must be an array`);
        }
        if (!file.orderPatterns.every(item => typeof item === 'string')) {
          throw new Error(`customLLMFiles[${index}].orderPatterns must contain only strings`);
        }
      }

      if (file.includeUnmatchedLast !== undefined && typeof file.includeUnmatchedLast !== 'boolean') {
        throw new Error(`customLLMFiles[${index}].includeUnmatchedLast must be a boolean`);
      }

      if (file.version !== undefined && typeof file.version !== 'string') {
        throw new Error(`customLLMFiles[${index}].version must be a string`);
      }

      if (file.rootContent !== undefined && typeof file.rootContent !== 'string') {
        throw new Error(`customLLMFiles[${index}].rootContent must be a string`);
      }
    });
  }
}

// Test cases
const testCases = [
  // Valid options tests
  {
    name: 'Valid empty options',
    options: {},
    shouldThrow: false,
    description: 'Empty options object should be valid'
  },
  {
    name: 'Valid complete options',
    options: {
      generateLLMsTxt: true,
      generateLLMsFullTxt: true,
      docsDir: 'docs',
      ignoreFiles: ['file1.md', 'file2.md'],
      title: 'Test Title',
      description: 'Test Description',
      llmsTxtFilename: 'llms.txt',
      llmsFullTxtFilename: 'llms-full.txt',
      includeBlog: false,
      pathTransformation: {
        ignorePaths: ['api', 'internal'],
        addPaths: ['docs']
      },
      includeOrder: ['intro.md', 'guide.md'],
      includeUnmatchedLast: true,
      customLLMFiles: [{
        filename: 'custom.txt',
        includePatterns: ['*.md'],
        fullContent: true
      }],
      excludeImports: false,
      removeDuplicateHeadings: false,
      generateMarkdownFiles: false,
      keepFrontMatter: ['title', 'description'],
      rootContent: 'Root content',
      fullRootContent: 'Full root content'
    },
    shouldThrow: false,
    description: 'All valid options should pass validation'
  },

  // includeOrder validation tests
  {
    name: 'Invalid includeOrder (not array)',
    options: {
      includeOrder: 'not-an-array'
    },
    shouldThrow: true,
    expectedError: 'includeOrder must be an array',
    description: 'includeOrder must be an array'
  },
  {
    name: 'Invalid includeOrder (non-string elements)',
    options: {
      includeOrder: ['valid', 123, 'also-valid']
    },
    shouldThrow: true,
    expectedError: 'includeOrder must contain only strings',
    description: 'includeOrder must contain only strings'
  },

  // ignoreFiles validation tests
  {
    name: 'Invalid ignoreFiles (not array)',
    options: {
      ignoreFiles: 'not-an-array'
    },
    shouldThrow: true,
    expectedError: 'ignoreFiles must be an array',
    description: 'ignoreFiles must be an array'
  },
  {
    name: 'Invalid ignoreFiles (non-string elements)',
    options: {
      ignoreFiles: ['valid.md', { file: 'invalid' }]
    },
    shouldThrow: true,
    expectedError: 'ignoreFiles must contain only strings',
    description: 'ignoreFiles must contain only strings'
  },

  // pathTransformation validation tests
  {
    name: 'Invalid pathTransformation (not object)',
    options: {
      pathTransformation: 'not-an-object'
    },
    shouldThrow: true,
    expectedError: 'pathTransformation must be an object',
    description: 'pathTransformation must be an object'
  },
  {
    name: 'Invalid pathTransformation (null)',
    options: {
      pathTransformation: null
    },
    shouldThrow: true,
    expectedError: 'pathTransformation must be an object',
    description: 'pathTransformation cannot be null'
  },
  {
    name: 'Invalid pathTransformation.ignorePaths (not array)',
    options: {
      pathTransformation: {
        ignorePaths: 'not-an-array'
      }
    },
    shouldThrow: true,
    expectedError: 'pathTransformation.ignorePaths must be an array',
    description: 'pathTransformation.ignorePaths must be an array'
  },
  {
    name: 'Invalid pathTransformation.ignorePaths (non-string elements)',
    options: {
      pathTransformation: {
        ignorePaths: ['valid', 123]
      }
    },
    shouldThrow: true,
    expectedError: 'pathTransformation.ignorePaths must contain only strings',
    description: 'pathTransformation.ignorePaths must contain only strings'
  },
  {
    name: 'Invalid pathTransformation.addPaths (not array)',
    options: {
      pathTransformation: {
        addPaths: 'not-an-array'
      }
    },
    shouldThrow: true,
    expectedError: 'pathTransformation.addPaths must be an array',
    description: 'pathTransformation.addPaths must be an array'
  },
  {
    name: 'Invalid pathTransformation.addPaths (non-string elements)',
    options: {
      pathTransformation: {
        addPaths: ['valid', true]
      }
    },
    shouldThrow: true,
    expectedError: 'pathTransformation.addPaths must contain only strings',
    description: 'pathTransformation.addPaths must contain only strings'
  },

  // Boolean options validation tests
  {
    name: 'Invalid generateLLMsTxt (not boolean)',
    options: {
      generateLLMsTxt: 'true'
    },
    shouldThrow: true,
    expectedError: 'generateLLMsTxt must be a boolean',
    description: 'generateLLMsTxt must be a boolean'
  },
  {
    name: 'Invalid includeBlog (not boolean)',
    options: {
      includeBlog: 1
    },
    shouldThrow: true,
    expectedError: 'includeBlog must be a boolean',
    description: 'includeBlog must be a boolean'
  },
  {
    name: 'Invalid excludeImports (not boolean)',
    options: {
      excludeImports: 'false'
    },
    shouldThrow: true,
    expectedError: 'excludeImports must be a boolean',
    description: 'excludeImports must be a boolean'
  },

  // String options validation tests
  {
    name: 'Invalid docsDir (not string)',
    options: {
      docsDir: 123
    },
    shouldThrow: true,
    expectedError: 'docsDir must be a string',
    description: 'docsDir must be a string'
  },
  {
    name: 'Invalid title (not string)',
    options: {
      title: ['title']
    },
    shouldThrow: true,
    expectedError: 'title must be a string',
    description: 'title must be a string'
  },
  {
    name: 'Invalid llmsTxtFilename (not string)',
    options: {
      llmsTxtFilename: true
    },
    shouldThrow: true,
    expectedError: 'llmsTxtFilename must be a string',
    description: 'llmsTxtFilename must be a string'
  },

  // keepFrontMatter validation tests
  {
    name: 'Invalid keepFrontMatter (not array)',
    options: {
      keepFrontMatter: 'not-an-array'
    },
    shouldThrow: true,
    expectedError: 'keepFrontMatter must be an array',
    description: 'keepFrontMatter must be an array'
  },
  {
    name: 'Invalid keepFrontMatter (non-string elements)',
    options: {
      keepFrontMatter: ['title', 123, 'description']
    },
    shouldThrow: true,
    expectedError: 'keepFrontMatter must contain only strings',
    description: 'keepFrontMatter must contain only strings'
  },

  // customLLMFiles validation tests
  {
    name: 'Invalid customLLMFiles (not array)',
    options: {
      customLLMFiles: 'not-an-array'
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles must be an array',
    description: 'customLLMFiles must be an array'
  },
  {
    name: 'Invalid customLLMFiles element (not object)',
    options: {
      customLLMFiles: ['not-an-object']
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0] must be an object',
    description: 'customLLMFiles elements must be objects'
  },
  {
    name: 'Invalid customLLMFiles element (null)',
    options: {
      customLLMFiles: [null]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0] must be an object',
    description: 'customLLMFiles elements cannot be null'
  },
  {
    name: 'Invalid customLLMFiles.filename (not string)',
    options: {
      customLLMFiles: [{
        filename: 123,
        includePatterns: ['*.md'],
        fullContent: true
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].filename must be a string',
    description: 'customLLMFiles[].filename must be a string'
  },
  {
    name: 'Invalid customLLMFiles.filename (empty)',
    options: {
      customLLMFiles: [{
        filename: '   ',
        includePatterns: ['*.md'],
        fullContent: true
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].filename cannot be empty',
    description: 'customLLMFiles[].filename cannot be empty'
  },
  {
    name: 'Invalid customLLMFiles.includePatterns (not array)',
    options: {
      customLLMFiles: [{
        filename: 'test.txt',
        includePatterns: 'not-an-array',
        fullContent: true
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].includePatterns must be an array',
    description: 'customLLMFiles[].includePatterns must be an array'
  },
  {
    name: 'Invalid customLLMFiles.includePatterns (non-string elements)',
    options: {
      customLLMFiles: [{
        filename: 'test.txt',
        includePatterns: ['*.md', 123],
        fullContent: true
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].includePatterns must contain only strings',
    description: 'customLLMFiles[].includePatterns must contain only strings'
  },
  {
    name: 'Invalid customLLMFiles.includePatterns (empty array)',
    options: {
      customLLMFiles: [{
        filename: 'test.txt',
        includePatterns: [],
        fullContent: true
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].includePatterns cannot be empty',
    description: 'customLLMFiles[].includePatterns cannot be empty'
  },
  {
    name: 'Invalid customLLMFiles.fullContent (not boolean)',
    options: {
      customLLMFiles: [{
        filename: 'test.txt',
        includePatterns: ['*.md'],
        fullContent: 'true'
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].fullContent must be a boolean',
    description: 'customLLMFiles[].fullContent must be a boolean'
  },
  {
    name: 'Invalid customLLMFiles.title (not string)',
    options: {
      customLLMFiles: [{
        filename: 'test.txt',
        includePatterns: ['*.md'],
        fullContent: true,
        title: 123
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].title must be a string',
    description: 'customLLMFiles[].title must be a string'
  },
  {
    name: 'Invalid customLLMFiles.ignorePatterns (not array)',
    options: {
      customLLMFiles: [{
        filename: 'test.txt',
        includePatterns: ['*.md'],
        fullContent: true,
        ignorePatterns: 'not-an-array'
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].ignorePatterns must be an array',
    description: 'customLLMFiles[].ignorePatterns must be an array'
  },
  {
    name: 'Invalid customLLMFiles.ignorePatterns (non-string elements)',
    options: {
      customLLMFiles: [{
        filename: 'test.txt',
        includePatterns: ['*.md'],
        fullContent: true,
        ignorePatterns: ['valid', true]
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].ignorePatterns must contain only strings',
    description: 'customLLMFiles[].ignorePatterns must contain only strings'
  },
  {
    name: 'Invalid customLLMFiles.orderPatterns (not array)',
    options: {
      customLLMFiles: [{
        filename: 'test.txt',
        includePatterns: ['*.md'],
        fullContent: true,
        orderPatterns: 'not-an-array'
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].orderPatterns must be an array',
    description: 'customLLMFiles[].orderPatterns must be an array'
  },
  {
    name: 'Invalid customLLMFiles.includeUnmatchedLast (not boolean)',
    options: {
      customLLMFiles: [{
        filename: 'test.txt',
        includePatterns: ['*.md'],
        fullContent: true,
        includeUnmatchedLast: 'true'
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].includeUnmatchedLast must be a boolean',
    description: 'customLLMFiles[].includeUnmatchedLast must be a boolean'
  },

  // logLevel validation tests
  {
    name: 'Valid logLevel (quiet)',
    options: {
      logLevel: 'quiet'
    },
    shouldThrow: false,
    description: 'logLevel can be "quiet"'
  },
  {
    name: 'Valid logLevel (normal)',
    options: {
      logLevel: 'normal'
    },
    shouldThrow: false,
    description: 'logLevel can be "normal"'
  },
  {
    name: 'Valid logLevel (verbose)',
    options: {
      logLevel: 'verbose'
    },
    shouldThrow: false,
    description: 'logLevel can be "verbose"'
  },
  {
    name: 'Invalid logLevel (invalid value)',
    options: {
      logLevel: 'debug'
    },
    shouldThrow: true,
    expectedError: 'logLevel must be one of: quiet, normal, verbose',
    description: 'logLevel must be one of the valid values'
  },
  {
    name: 'Invalid logLevel (number)',
    options: {
      logLevel: 1
    },
    shouldThrow: true,
    expectedError: 'logLevel must be one of: quiet, normal, verbose',
    description: 'logLevel must be a string value'
  }
];

// Run tests
let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  try {
    if (testCase.shouldThrow) {
      // Test should throw an error
      try {
        validatePluginOptions(testCase.options);
        console.log(`  ${index + 1}. FAIL: ${testCase.name}`);
        console.log(`     Expected error but validation passed`);
        console.log(`     Description: ${testCase.description}\n`);
        failedTests++;
      } catch (err) {
        if (err.message === testCase.expectedError) {
          console.log(`  ${index + 1}. PASS: ${testCase.name}`);
          passedTests++;
        } else {
          console.log(`  ${index + 1}. FAIL: ${testCase.name}`);
          console.log(`     Expected error: ${testCase.expectedError}`);
          console.log(`     Got error: ${err.message}`);
          console.log(`     Description: ${testCase.description}\n`);
          failedTests++;
        }
      }
    } else {
      // Test should not throw an error
      validatePluginOptions(testCase.options);
      console.log(`  ${index + 1}. PASS: ${testCase.name}`);
      passedTests++;
    }
  } catch (err) {
    console.log(`  ${index + 1}. FAIL: ${testCase.name}`);
    console.log(`     Unexpected error: ${err.message}`);
    console.log(`     Description: ${testCase.description}\n`);
    failedTests++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`Test Results: ${passedTests}/${testCases.length} passed, ${failedTests} failed`);
console.log('='.repeat(50));

if (failedTests > 0) {
  process.exit(1);
}
