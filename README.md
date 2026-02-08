# 📜 docusaurus-plugin-llms

A Docusaurus plugin for generating LLM-friendly documentation following the [llmstxt standard](https://llmstxt.org/).

[![npm version](https://img.shields.io/npm/v/docusaurus-plugin-llms.svg)](https://www.npmjs.com/package/docusaurus-plugin-llms)
[![npm downloads](https://img.shields.io/npm/dm/docusaurus-plugin-llms.svg)](https://www.npmjs.com/package/docusaurus-plugin-llms)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/rachfop?style=flat&logo=githubsponsors&label=Sponsor&labelColor=gray&color=pink)](https://github.com/sponsors/rachfop)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
        // Generate individual markdown files following llmstxt.org specification
        generateMarkdownFiles: true,
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
| `generateMarkdownFiles`          | boolean  | `false`           | Generate individual markdown files and link to them from llms.txt |
| `keepFrontMatter`                | string[] | []                | Preserve selected front matter items when generating individual markdown files |
| `preserveDirectoryStructure`     | boolean  | `true`            | Preserve full directory structure in generated markdown files (e.g., `docs/server/config.md` instead of `server/config.md`) |
| `processingBatchSize`            | number   | `100`             | Batch size for processing documents to prevent out-of-memory errors on large sites |
| `rootContent`                    | string   | (see below)       | Custom content to include at the root level of llms.txt       |
| `fullRootContent`                | string   | (see below)       | Custom content to include at the root level of llms-full.txt  |
| `logLevel`                       | string   | `'normal'`        | Logging level for plugin output: `'quiet'`, `'normal'`, or `'verbose'` |

### Custom Root Content

The `rootContent` and `fullRootContent` options allow you to customize the introductory content that appears in your generated files, following the llmstxt.org standard which allows "zero or more markdown sections (e.g. paragraphs, lists, etc) of any type except headings" after the title and description.

#### Default Content

If not specified, the plugin uses these defaults:
- **llms.txt**: "This file contains links to documentation sections following the llmstxt.org standard."
- **llms-full.txt**: "This file contains all documentation content in a single document following the llmstxt.org standard."

#### Custom Content Examples

**Example 1**: Add project-specific context
```js
rootContent: `Welcome to the MyProject documentation.

This documentation covers:
- Installation and setup
- API reference
- Advanced usage guides
- Troubleshooting

For the latest updates, visit https://myproject.dev/changelog`
```

**Example 2**: Add technical specifications
```js
fullRootContent: `Complete offline documentation bundle for MyProject v2.0.

**Format**: Markdown with code examples
**Languages**: JavaScript, TypeScript, Python
**Last Generated**: ${new Date().toISOString()}

> Note: Some features require authentication tokens.
> See the Authentication section for details.`
```

**Example 3**: Add navigation hints for AI assistants
```js
rootContent: `This documentation is optimized for AI assistants and LLMs.

Quick navigation:
- For API endpoints, search for "API:"
- For code examples, search for "Example:"
- For configuration, search for "Config:"

All code examples are MIT licensed unless otherwise noted.`
```

#### Custom Root Content for Custom LLM Files

You can also specify root content for each custom LLM file:

```js
customLLMFiles: [
  {
    filename: 'llms-api.txt',
    includePatterns: ['api/**/*.md'],
    fullContent: true,
    title: 'API Documentation',
    rootContent: `Complete API reference for all REST endpoints.
    
Authentication required for all endpoints except /health.
Base URL: https://api.example.com/v2`
  }
]
```

### Batch Processing for Large Sites

The plugin includes batch processing to prevent out-of-memory errors when processing very large documentation sites. By default, documents are processed in batches of 100, but you can configure this using the `processingBatchSize` option.

**When to adjust batch size:**
- **Large sites (1000+ documents)**: Reduce batch size (e.g., `50`) to lower memory usage
- **Small sites (< 100 documents)**: Default value is fine
- **Memory-constrained environments**: Reduce batch size to prevent OOM errors
- **High-memory systems**: Increase batch size (e.g., `200`) for faster processing

**Example configuration:**
```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        processingBatchSize: 50, // Process 50 documents at a time
        // ... other options
      },
    ],
  ],
};
```

**How it works:**
- Documents are processed in chunks of the specified batch size
- Each batch is processed sequentially to control memory usage
- Document order is preserved across batches
- Progress is logged when processing multiple batches (in verbose mode)

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

The document ordering feature allows you to control the sequence in which files appear in the generated output.

#### Pattern Matching Behavior

Patterns in `includeOrder`, `ignoreFiles`, and `customLLMFiles.includePatterns` are matched against **both** site-relative and docs-relative paths for maximum flexibility:

- **Site-relative path**: The path relative to your site root (e.g., `docs/quickstart/file.md`)
- **Docs-relative path**: The path relative to your docs directory (e.g., `quickstart/file.md`)

This means both of these patterns will match the same file:
```js
includeOrder: [
  'docs/quickstart/*',      // Matches site-relative path
  'quickstart/*'            // Matches docs-relative path (more intuitive!)
]
```

**Recommended approach**: Use docs-relative paths (without the `docs/` prefix) as they are more intuitive and portable across different configurations.

**Example 1**: Basic Section Ordering
```js
includeOrder: [
  'getting-started/*',  // Matches docs/getting-started/*.md
  'guides/*',           // Matches docs/guides/*.md
  'api/*',              // Matches docs/api/*.md
  'advanced/*'          // Matches docs/advanced/*.md
]
```
Result: Files will appear in the generated output following this section order.

**Example 2**: Strict Inclusion List
```js
includeOrder: [
  'public-docs/**/*.md'  // Matches docs/public-docs/**/*.md
],
includeUnmatchedLast: false
```
Result: Only files matching 'public-docs/**/*.md' are included, all others are excluded.

**Example 3**: Detailed Ordering with Specific Files First
```js
includeOrder: [
  'getting-started/installation.md',    // Specific file first
  'getting-started/quick-start.md',     // Another specific file
  'getting-started/*.md',               // Rest of getting-started
  'api/core/*.md',                      // Core API docs
  'api/plugins/*.md',                   // Plugin API docs
  'api/**/*.md'                         // All other API docs
]
```
Result: Installation and quick-start guides appear first, followed by other getting-started files, then API documentation in a specific order.

**Example 4**: Nested Directory Patterns
```js
includeOrder: [
  'tutorials/beginner/**/*',    // All beginner tutorials (deeply nested)
  'tutorials/intermediate/*',   // Intermediate tutorials (one level)
  'tutorials/**/*'              // All other tutorials
]
```
Result: Beginner tutorials appear first (regardless of nesting depth), then intermediate, then everything else.

### Docusaurus Partials Support

The plugin fully supports [Docusaurus partials](https://docusaurus.io/docs/markdown-features/react#importing-markdown) - reusable MDX content files that can be imported into other documents.

#### How It Works

1. **Partial files** (MDX files starting with underscore, e.g., `_shared-config.mdx`) are automatically excluded from the generated `llms*.txt` files
2. **Import statements** for partials are resolved and the content is inlined when processing documents

#### Example

Given a partial file `_api-config.mdx`:
```mdx
## API Configuration

Set your API endpoint:
```javascript
const API_URL = 'https://api.example.com';
```
```

And a document that imports it:
```mdx
---
title: Getting Started
---

# Getting Started Guide

import ApiConfig from './_api-config.mdx';

<ApiConfig />

Now you can make API calls...
```

The plugin will:
- Exclude `_api-config.mdx` from `llms.txt`
- Replace the import and `<ApiConfig />` with the actual content in the processed document

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

## Logging Configuration

The plugin includes a configurable logging system that allows you to control the amount of output during the build process.

### Log Levels

The plugin supports three logging levels:

- **quiet**: Suppresses all output except errors
- **normal** (default): Shows standard informational messages and warnings
- **verbose**: Shows detailed progress information including file-by-file processing

### Configuration

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        logLevel: 'verbose', // Options: 'quiet', 'normal', 'verbose'
        // Other configuration options...
      },
    ],
  ],
};
```

### Log Level Details

#### Quiet Mode (`logLevel: 'quiet'`)

Only errors are displayed. Use this for clean builds in CI/CD environments or when you don't need build feedback.

```js
{
  logLevel: 'quiet'
}
```

Output:
```
[docusaurus-plugin-llms] ERROR: Error generating LLM documentation: ...
```

#### Normal Mode (`logLevel: 'normal'`) - Default

Shows standard progress messages, warnings, and errors. This is the recommended setting for most users.

```js
{
  logLevel: 'normal' // or omit - this is the default
}
```

Output:
```
[docusaurus-plugin-llms] Generating LLM-friendly documentation...
[docusaurus-plugin-llms] Generating individual markdown files...
[docusaurus-plugin-llms] Generated: /path/to/llms.txt
[docusaurus-plugin-llms] Generated: /path/to/llms-full.txt
[docusaurus-plugin-llms] Stats: 42 total available documents processed
```

#### Verbose Mode (`logLevel: 'verbose'`)

Shows detailed information about every file being processed. Use this for debugging or when you need detailed feedback.

```js
{
  logLevel: 'verbose'
}
```

Output:
```
[docusaurus-plugin-llms] Generating LLM-friendly documentation...
[docusaurus-plugin-llms] Generating file: /path/to/llms.txt, version: undefined
[docusaurus-plugin-llms] Processed 42 documentation files for standard LLM files
[docusaurus-plugin-llms] Generating individual markdown files...
[docusaurus-plugin-llms] Generated markdown file: getting-started.md
[docusaurus-plugin-llms] Generated markdown file: api/reference.md
[docusaurus-plugin-llms] Generated: /path/to/llms.txt
[docusaurus-plugin-llms] Generated: /path/to/llms-full.txt
[docusaurus-plugin-llms] Stats: 42 total available documents processed
```

### Use Cases

#### Development

Use normal or verbose mode during development to see what's being generated:

```js
{
  logLevel: 'verbose',
  generateMarkdownFiles: true
}
```

#### Production/CI

Use quiet mode in production builds or CI/CD to reduce log noise:

```js
{
  logLevel: 'quiet',
  generateLLMsTxt: true,
  generateLLMsFullTxt: true
}
```

#### Debugging

Use verbose mode when troubleshooting issues:

```js
{
  logLevel: 'verbose',
  excludeImports: true,
  removeDuplicateHeadings: true
}
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

## Markdown File Generation (`generateMarkdownFiles`)

The `generateMarkdownFiles` option enables the plugin to generate individual markdown files for each documentation page, following the [llmstxt.org specification](https://llmstxt.org/) more closely. When enabled, this creates separate `.md` files for LLM consumption instead of linking to your original documentation pages.

### How It Works

**Default Behavior (generateMarkdownFiles: false)**:
- Generates `llms.txt` with links to your original documentation pages
- Example: `[Getting Started](https://yoursite.com/docs/getting-started)`

**With generateMarkdownFiles: true**:
- Generates individual markdown files (e.g., `getting-started.md`, `api-reference.md`)
- Generates `llms.txt` with links to these generated markdown files  
- Example: `[Getting Started](https://yoursite.com/getting-started.md)`

### Key Benefits

1. **Standards Compliance**: Follows the llmstxt.org specification by providing individual markdown files rather than linking to HTML pages
2. **LLM Optimization**: Generated files contain clean, processed markdown optimized for LLM consumption
3. **Self-Contained**: All necessary content is available in markdown format without requiring HTML parsing
4. **Flexible Naming**: Automatically generates readable filenames based on document titles

### Configuration Example

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        generateMarkdownFiles: true,  // Enable individual markdown file generation
        generateLLMsTxt: true,        // Generate index file linking to markdown files
        excludeImports: true,         // Clean up import statements  
        removeDuplicateHeadings: true, // Remove redundant content
        
        // Other options work normally
        includeOrder: ['getting-started/*', 'guides/*', 'api/*'],
        pathTransformation: {
          ignorePaths: ['docs']
        }
      }
    ]
  ]
}
```

### Directory Structure Options

#### Preserving Directory Structure (`preserveDirectoryStructure`)

By default (`preserveDirectoryStructure: true`), generated markdown files maintain the same directory structure as your HTML output, making them accessible at matching URL paths:

**With `preserveDirectoryStructure: true` (default)**:
```
docs/server/config.md → build/docs/server/config.md
```

**With `preserveDirectoryStructure: false`**:
```
docs/server/config.md → build/server/config.md
```

This is particularly useful when you want markdown files to sit alongside HTML files in the build output, allowing them to be served from the same URL path with a `.md` extension.

**Example configuration**:
```js
{
  generateMarkdownFiles: true,
  preserveDirectoryStructure: true,  // Default: matches HTML output structure
  docsDir: 'docs'
}
```

With this configuration, if your HTML is at `https://yoursite.com/docs/server/config.html`, the markdown will be at `https://yoursite.com/docs/server/config.md`.

### Generated File Structure

With `generateMarkdownFiles: true`, your output directory will contain:

```
build/
├── llms.txt              # Index file with links to generated markdown files
├── llms-full.txt         # Full content file (if enabled)
├── docs/                 # Preserves directory structure (default)
│   ├── getting-started.md
│   ├── api/
│   │   └── reference.md
│   └── server/
│       └── config.md
└── ...                   # Other generated markdown files
```

Or with `preserveDirectoryStructure: false`:

```
build/
├── llms.txt              # Index file with links to generated markdown files
├── llms-full.txt         # Full content file (if enabled)
├── getting-started.md    # Flat structure (old behavior)
├── api/
│   └── reference.md
└── server/
    └── config.md
```

### Filename Generation

The plugin generates readable filenames using this priority:

1. **Document Title**: Converted to kebab-case (e.g., "Getting Started" → `getting-started.md`)
2. **URL Path**: If title is unavailable, uses the document's URL path
3. **Uniqueness**: Automatically appends numbers for duplicate names (e.g., `getting-started-1.md`)

### Content Processing

Generated markdown files include:

- **Document title** as H1 heading
- **Document description** as blockquote (following llmstxt.org format)
- **Processed content** with optional cleaning (import removal, duplicate heading removal)
- **Proper markdown formatting** optimized for LLM consumption

### Example Generated File

Input documentation about "API Authentication" would generate `api-authentication.md`:

```markdown
# API Authentication

> Learn how to authenticate with our API using various methods

## Overview

This guide covers all authentication methods supported by our API...

## API Key Authentication

Use your API key to authenticate requests:

```javascript
const client = new Client({ apiKey: 'your-key' });
```
```

### Use Cases

#### Standards-Compliant Documentation
Perfect for projects that want to follow the llmstxt.org specification exactly:

```js
{
  generateMarkdownFiles: true,
  generateLLMsTxt: true,
  generateLLMsFullTxt: false  // Optional: disable if only individual files are needed
}
```

#### LLM Training Data
Generate clean markdown files for LLM training or fine-tuning:

```js
{
  generateMarkdownFiles: true,
  excludeImports: true,
  removeDuplicateHeadings: true,
  customLLMFiles: [
    {
      filename: 'training-data.txt',
      includePatterns: ['**/*.md'],
      fullContent: true
    }
  ]
}
```

#### Multi-Format Output
Generate both original links and markdown files for different use cases:

```js
{
  generateLLMsTxt: true,      // Links to original pages  
  generateMarkdownFiles: true, // Also generate individual markdown files
  llmsTxtFilename: 'llms-original.txt',  // Original links file
  // The markdown-linked version will be in llms.txt
}
```

### Compatibility

- **Fully backward compatible**: Defaults to `false`, existing configurations unchanged
- **Works with all existing options**: Path transformations, custom LLM files, content cleaning
- **Respects ordering**: Generated files maintain the same order as configured with `includeOrder`
- **Custom LLM files**: Also support markdown file generation when the global option is enabled

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

