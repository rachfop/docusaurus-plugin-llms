---
description: Combine several docs sections in one llms.txt, add custom root content, generate custom LLM files, and inline Docusaurus partials.
---

# Generating content

These options shape what goes into the generated files: multiple documentation sections, custom root content, extra custom LLM files, and Docusaurus partials. To install the plugin first, see [installation](./installation.md).

## Configure multiple documentation sections

The `docsDir` option accepts either a `string` (a single base directory, default `'docs'`) or an array of `DocsSection` objects. Use the array form for multi-instance setups, for example a main `docs` instance alongside a separate `api` instance. Each section resolves against its own route base path and gets its own heading in `llms.txt`.

To generate a single `llms.txt` from two instances with distinct headings, pass an array:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        docsDir: [
          { path: 'docs', routeBasePath: 'docs', label: 'Guides' },
          { path: 'api', routeBasePath: 'api', label: 'API Reference' },
        ],
      },
    ],
  ],
};
```

Set `routeBasePath` to the value in the matching Docusaurus docs plugin config, without the site `baseUrl`. A section with no `label` uses its `path` as the heading. For every `DocsSection` field, see [documentation sections](./configuration.md#documentation-sections).

## Inject custom root content

The llmstxt.org standard allows Markdown content without headings (paragraphs, lists, and so on) between the title and description and the body. The `rootContent` and `fullRootContent` options, both of type `string`, set that introductory content.

- `rootContent` is inserted into `llms.txt`, after the title and description and before the table of contents.
- `fullRootContent` is inserted into `llms-full.txt`, after the title and description and before the content sections.

If you don't set them, the plugin uses these defaults:

- `llms.txt`: `This file contains links to documentation sections following the llmstxt.org standard.`
- `llms-full.txt`: `This file contains all documentation content in a single document following the llmstxt.org standard.`

To add project-specific context to `llms.txt`, set `rootContent` to a Markdown string:

```js
{
  rootContent: `Welcome to the MyProject documentation.

This documentation covers:
- Installation and setup
- API reference
- Advanced usage guides
- Troubleshooting

For the latest updates, visit https://myproject.dev/changelog`,
}
```

Because these values are plain JavaScript strings, you can compute them at build time, for example to stamp in a generation timestamp:

```js
{
  fullRootContent: `Complete offline documentation bundle for MyProject v2.0.

**Format**: Markdown with code examples
**Last Generated**: ${new Date().toISOString()}

> Note: Some features require authentication tokens.`,
}
```

Custom LLM files accept their own `rootContent` too. See the next section.

## Generate custom LLM files

The `customLLMFiles` option generates extra LLM files, each scoped to part of your docs, alongside `llms.txt` and `llms-full.txt`. It takes an array of `CustomLLMFile` objects (default `[]`). Each object needs a `filename`, an `includePatterns` array of globs, and a `fullContent` flag: `true` writes full content like `llms-full.txt`, `false` writes links like `llms.txt`. For the optional fields, including `ignorePatterns`, `orderPatterns`, and `version`, see [custom LLM files](./configuration.md#custom-llm-files).

To split documentation by programming language, define one file per language:

```js
{
  customLLMFiles: [
    {
      filename: 'llms-python.txt',
      includePatterns: ['api/python/**/*.md', 'guides/python/*.md'],
      fullContent: true,
      title: 'Python API Documentation',
      description: 'Complete reference for Python API',
    },
    {
      filename: 'llms-tutorials.txt',
      includePatterns: ['tutorials/**/*.md'],
      fullContent: false,
      title: 'Tutorial Documentation',
      description: 'All tutorials in a single file',
    },
  ],
}
```

The `includePatterns`, `orderPatterns`, and `ignorePatterns` globs match against both the site-relative path (for example `docs/quickstart/file.md`) and the docs-relative path (for example `quickstart/file.md`), so docs-relative patterns are usually the more portable choice.

To build a curated file with explicit ordering and exclusions, combine `ignorePatterns` and `orderPatterns`:

```js
{
  customLLMFiles: [
    {
      filename: 'llms-getting-started.txt',
      includePatterns: ['**/*.md'],
      ignorePatterns: ['advanced/**/*.md', 'internal/**/*.md'],
      orderPatterns: [
        'introduction.md',
        'getting-started/*.md',
        'tutorials/basic/*.md',
      ],
      fullContent: true,
      title: 'Getting Started Guide',
      description: 'Beginner-friendly documentation with essential concepts',
    },
  ],
}
```

You can also give a custom file its own introductory text with `rootContent`:

```js
{
  customLLMFiles: [
    {
      filename: 'llms-api.txt',
      includePatterns: ['api/**/*.md'],
      fullContent: true,
      title: 'API Documentation',
      rootContent: `Complete API reference for all REST endpoints.

Authentication required for all endpoints except /health.
Base URL: https://api.example.com/v2`,
    },
  ],
}
```

Set a per-file `version` to override the global `version` label. When present, the version appears on a `Version:` line under the description:

```
# API Reference Documentation

> Complete API reference for developers

Version: 1.0.0

This file contains all documentation content in a single document following the llmstxt.org standard.
```

## How partials are resolved

The plugin supports [Docusaurus partials](https://docusaurus.io/docs/markdown-features/react#importing-markdown), the reusable MDX files imported into other documents. Partials are handled with no extra configuration:

- Files whose name starts with an underscore (for example `_shared-config.mdx`) are partials. The plugin skips them when it collects pages, so they appear only where another page imports them.
- Every import of a `.md` or `.mdx` file is resolved, and the imported content is inlined into the importing document before it's processed.

Import paths that start with `@site/` resolve against the site directory. Other `@alias/` paths resolve against the site directory too, as `<site>/alias/...`. Relative paths resolve against the importing file. The plugin reports a circular import as an error and drops that import.

Given a partial file `_api-config.mdx`:

````mdx
## API Configuration

Set your API endpoint:

```javascript
const API_URL = 'https://api.example.com';
```
````

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

The plugin excludes `_api-config.mdx` from `llms.txt` and replaces both the `import` statement and the `<ApiConfig />` tag with the partial's content in the processed document.
