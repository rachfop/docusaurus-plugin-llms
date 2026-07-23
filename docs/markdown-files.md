# Generating individual Markdown files

By default, the plugin generates `llms.txt` with links that point at your original documentation pages. The [llmstxt.org specification](https://llmstxt.org/) prefers links that point at Markdown versions of each page. Setting `generateMarkdownFiles: true` makes the plugin write a clean `.md` file for every document and rewrite the `llms.txt` links to point at those files instead.

This page explains what `generateMarkdownFiles` produces, how it names and lays out the files, what each file contains, and the options that shape the output. For the links file itself, see [llms.txt output](./overview.md). For content cleaning options that also apply here, see [content cleaning](./content-cleaning.md).

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
        generateMarkdownFiles: true,  // write individual .md files
        generateLLMsTxt: true,        // index file that links to them
        excludeImports: true,         // strip MDX import statements
        removeDuplicateHeadings: true, // drop redundant heading text
        includeOrder: ['getting-started/*', 'guides/*', 'api/*'],
      },
    ],
  ],
};
```

`generateMarkdownFiles` works alongside the other options. Content cleaning (`excludeImports`, `removeDuplicateHeadings`), ordering (`includeOrder`), path transformation, and `customLLMFiles` all apply to the generated files.

## Linking with `addMdExtension`

`addMdExtension` is a `boolean` that defaults to `true`. It appends `.md` to the link URLs in `llms.txt` so they resolve to the Markdown files rather than the HTML pages, per the llmstxt.org spec. It only has an effect when `generateMarkdownFiles` is enabled, since the `.md` files have to exist for the links to resolve.

A Docusaurus page served at `https://example.com/docs/getting-started/` becomes this link:

```
- [Getting Started](https://example.com/docs/getting-started.md)
```

Trailing slashes are stripped before the extension is applied, and a URL that already ends in `.md` isn't doubled. To keep the original Docusaurus URLs, set the option to `false`:

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

So if your HTML is at `https://yoursite.com/docs/server/config.html`, the default puts the Markdown at `https://yoursite.com/docs/server/config.md`.

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

1. **Front matter `slug`**: if the document sets a `slug`, it becomes the output path. A slug containing `/` creates the matching directory structure; a simple slug replaces just the filename.
2. **Front matter `id`**: if there's no `slug` but there is an `id`, it's used the same way.
3. **Resolved page URL**: otherwise the path comes from the document's built URL (or its source file path if the URL isn't available). Numeric ordering prefixes like `01-` are stripped from each path segment.
4. **Sanitized title**: only as a last resort, when the path would otherwise be empty, the document title is sanitized into a filename (lowercased, unsafe characters and whitespace replaced with `-`).

Paths are made unique by appending a counter (`config-2.md`, `config-3.md`, and so on) when two documents would otherwise collide. A root page with slug `/` is written as `index.md`.

## What each file contains

Every generated file is built from the document's title, description, and processed content:

- The **title** becomes an H1 heading.
- The **description**, when present, follows as a blockquote, matching the llmstxt.org format.
- The **processed content** comes next, with any content cleaning already applied.

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

## Common configurations

To follow the llmstxt.org spec closely and skip the combined file, generate the index and the individual files only:

```js
{
  generateMarkdownFiles: true,
  generateLLMsTxt: true,
  generateLLMsFullTxt: false,
}
```

To keep both the original HTML links and the Markdown files, point the standard links file at a separate filename with `llmsTxtFilename`:

```js
{
  generateLLMsTxt: true,       // links to original pages
  generateMarkdownFiles: true, // also generate individual markdown files
  llmsTxtFilename: 'llms-original.txt',
}
```

`generateMarkdownFiles` defaults to `false`, so existing configurations are unaffected until you opt in.
