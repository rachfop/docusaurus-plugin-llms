# 📜 docusaurus-plugin-llms

A Docusaurus plugin for generating LLM-friendly documentation following the [llmstxt standard](https://llmstxt.org/).

## Features

- ⚡️ Easy integration with Docusaurus
- ✅ Zero config required, works out of the box
- ⚙️ Highly customizable with multiple options
- 📝 Creates `llms.txt` with section links
- 📖 Produces `llms-full.txt` with all content in one file
- 📋 Document ordering control for custom sequence
- 🔄 Path transformation to customize URL construction
- 📚 Option to include blog posts
- 🧩 Custom LLM files for specific documentation sections
- 🧹 Cleans HTML and normalizes content for optimal LLM consumption
- 🚫 Optional import statement removal for cleaner MDX content
- 🔄 Optional duplicate heading removal for concise output
- 📊 Provides statistics about generated documentation

## Table of Contents

- [Installation](#installation)
- [Configuration Options](#configuration-options)
- [Available Options](#available-options)
- [Path Transformation Examples](#path-transformation-examples)
- [Document Ordering Examples](#document-ordering-examples)
- [Custom LLM Files](#custom-llm-files)
- [Content Cleaning Options](#content-cleaning-options)
- [Best Practices](#best-practices)
- [How It Works](#how-it-works)
- [Implementation Details](#implementation-details)
- [Testing](#testing)
- [Future Enhancements](#future-enhancements)
- [License](#license)

## Installation

```bash
npm install docusaurus-plugin-llms --save-dev
```

Then add to your Docusaurus configuration:

```js
module.exports = {
  // ... your existing Docusaurus config
  plugins: [
    'docusaurus-plugin-llms',
    // ... your other plugins
  ],
};
```

## Configuration Options

You can configure the plugin by passing options:

```js
module.exports = {
  // ... your existing Docusaurus config
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        // Options here
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        docsDir: 'docs',
        ignoreFiles: ['advanced/*', 'private/*'],
        title: 'My Project Documentation',
        description: 'Complete reference documentation for My Project',
        includeBlog: true,
        // Content cleaning options
        excludeImports: true,
        removeDuplicateHeadings: true,
        // Control documentation order
        includeOrder: [
          'getting-started/*',
          'guides/*',
          'api/*',
        ],
        includeUnmatchedLast: true,
        // Path transformation options
        pathTransformation: {
          // Paths to ignore when constructing URLs (will be removed if found)
          ignorePaths: ['docs'],
          // Paths to add when constructing URLs (will be prepended if not already present)
          addPaths: ['api'],
        },
        // Custom LLM files for specific documentation sections
        customLLMFiles: [
          {
            filename: 'llms-python.txt',
            includePatterns: ['api/python/**/*.md', 'guides/python/*.md'],
            fullContent: true,
            title: 'Python API Documentation',
            description: 'Complete reference for Python API'
          },
          {
            filename: 'llms-tutorials.txt',
            includePatterns: ['tutorials/**/*.md'],
            fullContent: false,
            title: 'Tutorial Documentation',
            description: 'All tutorials in a single file'
          }
        ],
      },
    ],
    // ... your other plugins
  ],
};
```

### Available Options

| Option                           | Type     | Default           | Description                                                   |
|----------------------------------|----------|-------------------|---------------------------------------------------------------|
| `description`                    | string   | Site tagline      | Custom description to use in generated files                  |
| `docsDir`                        | string   | `'docs'`          | Base directory for documentation files                        |
| `excludeImports`                 | boolean  | `false`           | Remove import statements from generated content                |
| `generateLLMsFullTxt`            | boolean  | `true`            | Whether to generate the full content file                     |
| `generateLLMsTxt`                | boolean  | `true`            | Whether to generate the links file                            |
| `ignoreFiles`                    | string[] | `[]`              | Array of glob patterns for files to ignore                    |
| `includeBlog`                    | boolean  | `false`           | Whether to include blog content                               |
| `includeOrder`                   | string[] | `[]`              | Array of glob patterns for files to process in specific order |
| `includeUnmatchedLast`           | boolean  | `true`            | Whether to include unmatched files at the end                 |
| `llmsFullTxtFilename`            | string   | `'llms-full.txt'` | Custom filename for the full content file                     |
| `llmsTxtFilename`                | string   | `'llms.txt'`      | Custom filename for the links file                            |
| `pathTransformation.addPaths`    | string[] | `[]`              | Path segments to add when constructing URLs                   |
| `pathTransformation.ignorePaths` | string[] | `[]`              | Path segments to ignore when constructing URLs                |
| `pathTransformation`             | object   | `undefined`       | Path transformation options for URL construction              |
| `removeDuplicateHeadings`        | boolean  | `false`           | Remove redundant content that duplicates heading text         |
| `title`                          | string   | Site title        | Custom title to use in generated files                        |
| `version`                        | string   | `undefined`       | Global version to include in all generated files              |
| `customLLMFiles`                 | array    | `[]`              | Array of custom LLM file configurations                       |

### Path Transformation Examples

The path transformation feature allows you to manipulate how URLs are constructed from file paths:

**Example 1**: Remove 'docs' from the URL path
```js
pathTransformation: {
  ignorePaths: ['docs'],
}
```
File path: `/content/docs/manual/decorators.md` → URL: `https://example.com/manual/decorators`

**Example 2**: Add 'api' to the URL path
```js
pathTransformation: {
  addPaths: ['api'],
}
```
File path: `/content/manual/decorators.md` → URL: `https://example.com/api/manual/decorators`

**Example 3**: Combine both transformations
```js
pathTransformation: {
  ignorePaths: ['docs'],
  addPaths: ['api'],
}
```
File path: `/content/docs/manual/decorators.md` → URL: `https://example.com/api/manual/decorators`

The configuration supports multiple path segments in both arrays.

### Document Ordering Examples

The document ordering feature allows you to control the sequence in which files appear in the generated output:

**Example 1**: Basic Section Ordering
```js
includeOrder: [
  'getting-started/*',
  'guides/*',
  'api/*',
  'advanced/*'
]
```
Result: Files will appear in the generated output following this section order.

**Example 2**: Strict Inclusion List
```js
includeOrder: [
  'public-docs/**/*.md'
],
includeUnmatchedLast: false
```
Result: Only files matching 'public-docs/**/*.md' are included, all others are excluded.

**Example 3**: Detailed Ordering with Specific Files First
```js
includeOrder: [
  'getting-started/installation.md',
  'getting-started/quick-start.md',
  'getting-started/*.md',
  'api/core/*.md',
  'api/plugins/*.md',
  'api/**/*.md'
]
```
Result: Installation and quick-start guides appear first, followed by other getting-started files, then API documentation in a specific order.

### Custom LLM Files

In addition to the standard `llms.txt` and `llms-full.txt` files, you can generate custom LLM-friendly files for different sections of your documentation with the `customLLMFiles` option:

```js
customLLMFiles: [
  {
    filename: 'llms-python.txt',
    includePatterns: ['api/python/**/*.md', 'guides/python/*.md'],
    fullContent: true,
    title: 'Python API Documentation',
    description: 'Complete reference for Python API'
  },
  {
    filename: 'llms-tutorials.txt',
    includePatterns: ['tutorials/**/*.md'],
    fullContent: false,
    title: 'Tutorial Documentation',
    description: 'All tutorials in a single file'
  }
]
```

#### Custom LLM File Configuration

Each custom LLM file is defined by an object with the following properties:

| Option                | Type     | Required | Description                                  |
|-----------------------|----------|----------|----------------------------------------------|
| `filename`            | string   | Yes      | Name of the output file (e.g., 'llms-python.txt') |
| `includePatterns`     | string[] | Yes      | Glob patterns for files to include |
| `fullContent`         | boolean  | Yes      | `true` for full content like llms-full.txt, `false` for links only like llms.txt |
| `title`               | string   | No       | Custom title for this file (defaults to site title) |
| `description`         | string   | No       | Custom description for this file (defaults to site description) |
| `ignorePatterns`      | string[] | No       | Additional patterns to exclude (combined with global ignoreFiles) |
| `orderPatterns`       | string[] | No       | Order patterns for controlling file ordering (similar to includeOrder) |
| `includeUnmatchedLast`| boolean  | No       | Whether to include unmatched files last (default: false) |
| `version`             | string   | No       | Version information for this LLM file (overrides global version) |

#### Use Cases

##### Language-Specific Documentation

Create separate files for different programming languages:

```js
customLLMFiles: [
  {
    filename: 'llms-python.txt',
    includePatterns: ['api/python/**/*.md', 'guides/python/*.md'],
    fullContent: true,
    title: 'Python API Documentation'
  },
  {
    filename: 'llms-javascript.txt',
    includePatterns: ['api/javascript/**/*.md', 'guides/javascript/*.md'],
    fullContent: true,
    title: 'JavaScript API Documentation'
  }
]
```

##### Content Type Separation

Separate tutorials from API reference:

```js
customLLMFiles: [
  {
    filename: 'llms-tutorials.txt',
    includePatterns: ['tutorials/**/*.md', 'guides/**/*.md'],
    fullContent: true,
    title: 'Tutorials and Guides'
  },
  {
    filename: 'llms-api.txt',
    includePatterns: ['api/**/*.md', 'reference/**/*.md'],
    fullContent: true,
    title: 'API Reference'
  }
]
```

##### Beginner-Friendly Documentation

Create a beginner-focused file with carefully ordered content:

```js
customLLMFiles: [
  {
    filename: 'llms-getting-started.txt',
    includePatterns: ['**/*.md'],
    ignorePatterns: ['advanced/**/*.md', 'internal/**/*.md'],
    orderPatterns: [
      'introduction.md',
      'getting-started/*.md',
      'tutorials/basic/*.md',
      'examples/simple/*.md'
    ],
    fullContent: true,
    title: 'Getting Started Guide',
    description: 'Beginner-friendly documentation with essential concepts'
  }
]
```

##### Versioned Documentation

Include version information in your documentation files:

```js
plugins: [
  [
    'docusaurus-plugin-llms',
    {
      // Global version applies to all files
      version: '2.0.0',
      
      // Custom LLM files with specific versions
      customLLMFiles: [
        {
          filename: 'api-reference.txt',
          title: 'API Reference Documentation',
          description: 'Complete API reference for developers',
          includePatterns: ['**/api/**/*.md', '**/reference/**/*.md'],
          fullContent: true,
          version: '1.0.0'  // Overrides global version
        },
        {
          filename: 'tutorials.txt',
          title: 'Tutorials and Guides',
          description: 'Step-by-step tutorials and guides',
          includePatterns: ['**/tutorials/**/*.md', '**/guides/**/*.md'],
          fullContent: true,
          version: '0.9.5-beta'  // Overrides global version
        }
      ]
    }
  ],
]
```

The generated files will include the version information under the description:

```
# API Reference Documentation

> Complete API reference for developers

Version: 1.0.0

This file contains all documentation content in a single document following the llmstxt.org standard.
```

## Content Cleaning Options

The plugin provides advanced content cleaning options to optimize your documentation for LLM consumption by removing unnecessary elements that can clutter the output.

### Import Statement Removal (`excludeImports`)

The `excludeImports` option removes JavaScript/TypeScript import statements from your MDX files, which are typically not useful for LLMs and can create noise in the generated documentation.

#### When to Use
- Your documentation uses MDX files with React components
- You have many import statements for UI components
- You want cleaner, more readable output for LLMs

#### Example

**Before** (with `excludeImports: false`):
```markdown
import ApiTabs from "@theme/ApiTabs";
import DiscriminatorTabs from "@theme/DiscriminatorTabs";
import MethodEndpoint from "@theme/ApiExplorer/MethodEndpoint";
import SecuritySchemes from "@theme/ApiExplorer/SecuritySchemes";
import MimeTabs from "@theme/MimeTabs";
import ParamsItem from "@theme/ParamsItem";

# Create User Account

This endpoint creates a new user account...
```

**After** (with `excludeImports: true`):
```markdown
# Create User Account

This endpoint creates a new user account...
```

#### Configuration
```js
{
  excludeImports: true, // Remove all import statements
}
```

### Duplicate Heading Removal (`removeDuplicateHeadings`)

The `removeDuplicateHeadings` option removes redundant content that simply repeats the heading text immediately after the heading, which is common in auto-generated API documentation.

#### When to Use
- Your documentation has redundant content that repeats heading text
- You have auto-generated API docs with minimal content
- You want to eliminate repetitive patterns for cleaner LLM consumption

#### Example

**Before** (with `removeDuplicateHeadings: false`):
```markdown
# Create Deliverable

Create Deliverable

---

# Update User Profile

Update User Profile

---
```

**After** (with `removeDuplicateHeadings: true`):
```markdown
# Create Deliverable

---

# Update User Profile

---
```

#### Configuration
```js
{
  removeDuplicateHeadings: true, // Remove redundant heading text
}
```

### Combined Content Cleaning

For optimal LLM-friendly output, you can combine both options:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        // Enable both content cleaning options for optimal LLM output
        excludeImports: true,
        removeDuplicateHeadings: true,
        
        // Other configuration options...
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        docsDir: 'docs',
      },
    ],
  ],
};
```

### Content Cleaning by Use Case

#### Minimal Cleanup (Default Behavior)
```js
{
  excludeImports: false,
  removeDuplicateHeadings: false
}
```
- Preserves all original content
- Suitable when you want to keep import statements for reference
- Good for documentation that doesn't have redundant patterns

#### Import Cleanup Only
```js
{
  excludeImports: true,
  removeDuplicateHeadings: false
}
```
- Removes import statements but keeps all content
- Good for MDX-heavy documentation sites
- Maintains content structure while removing technical imports

#### Full Cleanup (Recommended for LLMs)
```js
{
  excludeImports: true,
  removeDuplicateHeadings: true
}
```
- Maximum cleanup for LLM consumption
- Removes both imports and redundant content
- Recommended for API documentation and auto-generated content
- Produces the cleanest, most concise output

## Best Practices

### For API Documentation
If you have auto-generated API documentation (like OpenAPI docs), enable both cleaning options:

```js
{
  excludeImports: true,           // Remove React component imports
  removeDuplicateHeadings: true,  // Remove redundant API endpoint descriptions
  generateLLMsFullTxt: true,      // Create comprehensive single file
}
```

### For Tutorial Content
For hand-written tutorials and guides, you might want selective cleaning:

```js
{
  excludeImports: true,           // Remove any MDX imports
  removeDuplicateHeadings: false, // Keep all content as written
  includeOrder: [                // Organize content logically
    'getting-started/*',
    'tutorials/*',
    'advanced/*'
  ]
}
```

### For Multi-Language Documentation
Create separate clean files for different programming languages:

```js
{
  excludeImports: true,
  removeDuplicateHeadings: true,
  customLLMFiles: [
    {
      filename: 'llms-python.txt',
      includePatterns: ['**/python/**/*.md'],
      fullContent: true,
      title: 'Python Documentation'
    },
    {
      filename: 'llms-javascript.txt', 
      includePatterns: ['**/javascript/**/*.md'],
      fullContent: true,
      title: 'JavaScript Documentation'
    }
  ]
}
```

### Performance Considerations
- Content cleaning adds minimal processing overhead
- Both options work on the content after HTML tag removal
- No impact on your site's build performance
- Cleaning happens only during the LLM file generation phase

### Backward Compatibility
Both options default to `false`, ensuring existing configurations continue to work without changes. Only users who explicitly enable these features will see the cleaned output.

## How It Works

This plugin automatically generates the following files during the build process:

- **llms.txt**: Contains links to all sections of your documentation
- **llms-full.txt**: Contains all documentation content in a single file
- **Custom LLM files**: Additional files based on your custom configurations

These files follow the [llmstxt standard](https://llmstxt.org/), making your documentation optimized for use with Large Language Models (LLMs).


## Implementation Details

The plugin:

1. Scans your `docs` directory recursively for all Markdown files
2. Optionally includes blog content
3. Orders documents according to specified glob patterns (if provided)
4. Extracts metadata, titles, and content from each file
5. Creates proper URL links to each document section
6. Applies path transformations according to configuration (removing or adding path segments)
7. Generates a table of contents in `llms.txt`
8. Combines all documentation content in `llms-full.txt`
9. Creates custom LLM files based on specified configurations
10. Provides statistics about the generated documentation

## Testing

The plugin includes comprehensive tests in the `tests` directory:

- **Unit tests**: Test the path transformation functionality in isolation
- **Integration tests**: Simulate a Docusaurus build with various configurations

To run the tests:

```bash
# Run all tests
npm test

# Run just the unit tests
npm run test:unit

# Run just the integration tests
npm run test:integration
```

For more detailed testing instructions, see [tests/TESTING.md](tests/TESTING.md).

## Future Enhancements

Planned features for future versions:

- Advanced glob pattern matching for file filtering
- Support for i18n content
- Specific content tags for LLM-only sections

## License
This project is licensed under the MIT License.

