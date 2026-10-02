---
description: Write a Markdown copy of every page next to its HTML and point llms.txt links at those files.
---

# Generating individual Markdown files

The [llmstxt.org specification](https://llmstxt.org/) recommends that `llms.txt` link to a Markdown version of each page. With `generateMarkdownFiles: true`, the plugin writes a `.md` file for every document and points the `llms.txt` links at those files.

This page covers how the plugin names and lays out the files, what each file contains, and the options that shape the output. For the format of `llms.txt` itself, see [generated output](./overview.md#generated-output). For content cleaning options that also apply here, see [content cleaning](./content-cleaning.md).

## What `generateMarkdownFiles` does

`generateMarkdownFiles` is a `boolean` that defaults to `false`. When you leave it off, `llms.txt` links to your HTML pages:

```
- [Getting Started](https://yoursite.com/docs/getting-started)
```

When you turn it on, the plugin writes an individual Markdown file for each document and links to that file instead:

```
- [Getting Started](https://yoursite.com/docs/getting-started.md)
```

The generated files hold clean, processed Markdown with no HTML parsing required, so an LLM can consume them directly. A minimal configuration looks like this:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        generateMarkdownFiles: true, // write individual .md files
        generateLLMsTxt: true, // index file that links to them
        excludeImports: true, // strip MDX import statements
        removeDuplicateHeadings: true, // drop redundant heading text
        includeOrder: ['getting-started/*', 'guides/*', 'api/*'],
      },
    ],
  ],
};
```

`generateMarkdownFiles` works alongside the other options. Content cleaning (`excludeImports`, `removeDuplicateHeadings`), ordering (`includeOrder`), path transformation, and `customLLMFiles` all apply to the generated files.

## Linking with `addMdExtension`

`addMdExtension` is a `boolean` that defaults to `true`. It appends `.md` to the link URLs in `llms.txt` so they resolve to the generated Markdown files. It applies only when `generateMarkdownFiles` is `true`, because the `.md` files must exist for the links to resolve.

A Docusaurus page served at `https://example.com/docs/getting-started/` becomes this link:

```
- [Getting Started](https://example.com/docs/getting-started.md)
```

The plugin strips trailing slashes before it adds the extension, and leaves a URL that already ends in `.md` as it is. To keep the Docusaurus page URLs in `llms.txt` while still generating the files, set the option to `false`:

```js
{
  addMdExtension: false,
}
```

## Where files are written with `preserveDirectoryStructure`

`preserveDirectoryStructure` is a `boolean` that defaults to `true`. It controls whether generated files mirror the directory layout of your build output or are flattened relative to the docs root.

With the default (`true`), a file keeps its directory path so it can sit next to the matching HTML file and be served from the same URL with a `.md` extension:

```
docs/server/config.md → build/docs/server/config.md
```

With `preserveDirectoryStructure: false`, the leading docs directory segment is dropped and the file is flattened:

```
docs/server/config.md → build/server/config.md
```

With the default, a page served at `https://yoursite.com/docs/server/config` gets its Markdown at `https://yoursite.com/docs/server/config.md`.

## Generated file structure

With `generateMarkdownFiles: true` and the default `preserveDirectoryStructure: true`, the build output contains the index files plus a Markdown tree that mirrors your docs:

```
build/
├── llms.txt              # index file linking to the generated markdown files
├── llms-full.txt         # full content file (if generateLLMsFullTxt is enabled)
├── docs/                 # directory structure preserved (default)
│   ├── getting-started.md
│   ├── api/
│   │   └── reference.md
│   └── server/
│       └── config.md
└── ...
```

With `preserveDirectoryStructure: false`, the same files land flattened relative to the docs root:

```
build/
├── llms.txt
├── llms-full.txt
├── getting-started.md
├── api/
│   └── reference.md
└── server/
    └── config.md
```

## How filenames are chosen

The plugin derives each output path from the document's resolved information, in this order:

1. **Front matter `slug`**: if the document sets a `slug`, it becomes the output path. A slug containing `/` creates the matching directory structure; a slug without `/` replaces only the filename.
2. **Front matter `id`**: if there's no `slug` but there is an `id`, it's used the same way.
3. **Resolved page URL**: otherwise the path comes from the document's built URL (or its source file path if the URL isn't available). Numeric ordering prefixes like `01-` are stripped from each path segment. A directory index (`index.md`, `README.md`, or a `<folder>/<folder>.md` file, in any letter case) takes its directory's URL: `docs/guide/README.md` is served at `/docs/guide/`, so its file is `docs/guide.md`.
4. **Sanitized title**: only as a last resort, when the path would otherwise be empty, the document title is sanitized into a filename (lowercased, unsafe characters and whitespace replaced with `-`).

When two documents would get the same path, the plugin appends a counter (`config-2.md`, `config-3.md`, and so on). A page whose URL is the site root is written as `index.md`.

## What each file contains

Every generated file is built from the document's title, description, and processed content:

- The **title** becomes an H1 heading.
- The **description**, when present, follows as a blockquote, matching the llmstxt.org format. For where the description comes from, see [page titles and descriptions](./overview.md#page-titles-and-descriptions).
- The **processed content** comes next, with content cleaning applied. A body paragraph that repeats the description is dropped.

If you list keys in `keepFrontMatter`, the plugin writes a YAML front matter block at the top of each file containing only those keys. `keepFrontMatter` is a `string[]` that defaults to `[]`, and it only takes effect when `generateMarkdownFiles` is enabled. Keys you don't list are dropped.

## Example generated file

A document titled "API Authentication" with a description produces `api-authentication.md` (or a path derived from its slug or URL):

```markdown
# API Authentication

> Learn how to authenticate with our API using various methods

## Overview

This guide covers all authentication methods supported by our API...

## API Key Authentication

Use your API key to authenticate requests:

    const client = new Client({ apiKey: 'your-key' });
```

## Generate only `llms.txt` and the Markdown files

To skip the combined `llms-full.txt`, turn it off and keep the index and the individual files:

```js
{
  generateMarkdownFiles: true,
  generateLLMsTxt: true,
  generateLLMsFullTxt: false,
}
```
