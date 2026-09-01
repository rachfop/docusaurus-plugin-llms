# Generating content

Once the plugin is installed (see [installation](./installation.md)), you can shape what goes into the generated files. This page covers four content-shaping features: configuring multiple documentation sections, injecting custom root content, generating extra custom LLM files, and how Docusaurus partials are resolved.

All of these run during the Docusaurus build (`npm run build`), since the plugin uses the `postBuild` lifecycle hook.

## Configure multiple documentation sections

The `docsDir` option accepts either a `string` (a single base directory, default `'docs'`) or an array of `DocsSection` objects. Use the array form for multi-instance setups, for example a main `docs` instance alongside a separate `api` instance, so each section resolves against its own route base path and can carry its own heading in `llms.txt`.

Each `DocsSection` object has the following fields:

| Field           | Type     | Required | Description                                                                             |
| --------------- | -------- | -------- | --------------------------------------------------------------------------------------- |
| `path`          | `string` | yes      | Filesystem path to the section, relative to the site directory (e.g. `'docs'`, `'api'`) |
| `routeBasePath` | `string` | yes      | The Docusaurus `routeBasePath` the section is served under (e.g. `'docs'`, `'api'`)     |
| `label`         | `string` | no       | Optional heading shown for the section in `llms.txt`                                    |

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

When `docsDir` is a string, it's treated as a single section whose `routeBasePath` matches the directory name.

## Inject custom root content

The llmstxt.org standard allows zero or more Markdown sections (paragraphs, lists, and so on, but no headings) between the title/description and the body. The `rootContent` and `fullRootContent` options let you set that introductory content. Both are of type `string`.

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

Beyond the standard `llms.txt` and `llms-full.txt`, the `customLLMFiles` option generates additional LLM-friendly files scoped to specific parts of your docs. It takes an array of `CustomLLMFile` objects (default `[]`).

Each `CustomLLMFile` object supports these fields:

| Field                  | Type       | Required | Description                                                                                     |
| ---------------------- | ---------- | -------- | ----------------------------------------------------------------------------------------------- |
| `filename`             | `string`   | yes      | Name of the output file (e.g. `'llms-python.txt'`)                                              |
| `includePatterns`      | `string[]` | yes      | Glob patterns for files to include                                                              |
| `fullContent`          | `boolean`  | yes      | `true` for full content (like `llms-full.txt`), `false` for links only (like `llms.txt`)        |
| `title`                | `string`   | no       | Custom title for this file (defaults to the site title)                                         |
| `description`          | `string`   | no       | Custom description for this file (defaults to the site description)                             |
| `ignorePatterns`       | `string[]` | no       | Additional patterns to exclude, combined with the global `ignoreFiles`                          |
| `orderPatterns`        | `string[]` | no       | Order patterns controlling file ordering, similar to the top-level `includeOrder`               |
| `includeUnmatchedLast` | `boolean`  | no       | Whether to append files that don't match any `orderPatterns` (default: `true`)                  |
| `version`              | `string`   | no       | Version label for this file, overriding the global `version`                                    |
| `rootContent`          | `string`   | no       | Custom root content for this file, inserted after the title and description                     |

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

The `includePatterns`, `orderPatterns`, and `ignorePatterns` globs match against both the site-relative path (e.g. `docs/quickstart/file.md`) and the docs-relative path (e.g. `quickstart/file.md`), so docs-relative patterns are usually the more portable choice.

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

- Partial files are excluded from the generated `llms*.txt` files. Any `.md` or `.mdx` file whose name starts with an underscore (for example `_shared-config.mdx`) is skipped during file collection.
- Import statements for partials are resolved and their content is inlined into the importing document before it's processed.

An import is treated as a partial when its path contains an underscore (for example `./_api-config.mdx`) or lives under a `/partials/` directory (for example `@site/src/partials/config.mdx`). The `@site/` alias resolves against the site directory; other paths resolve relative to the importing file. Circular imports are detected and reported rather than followed.

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
