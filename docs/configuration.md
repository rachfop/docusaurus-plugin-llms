# Configuration options

This page is the full reference for every option `docusaurus-plugin-llms` accepts. If you're setting the plugin up for the first time, start with [installation](./installation.md); the plugin works with zero config, so you only need the options below when you want to change its defaults.

You pass options as the second element of the plugin tuple in `docusaurus.config.js`:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        generateLLMsTxt: true,
        docsDir: 'docs',
        ignoreFiles: ['advanced/*', 'private/*'],
        title: 'My Project Documentation',
        description: 'Complete reference documentation for My Project',
      },
    ],
  ],
};
```

## Output files

These options control which files the plugin writes and what they're named.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `generateLLMsTxt` | `boolean` | `true` | Whether to generate the `llms.txt` links file. |
| `generateLLMsFullTxt` | `boolean` | `true` | Whether to generate the `llms-full.txt` full-content file. |
| `llmsTxtFilename` | `string` | `'llms.txt'` | Custom file name for the links file. |
| `llmsFullTxtFilename` | `string` | `'llms-full.txt'` | Custom file name for the full-content file. |
| `generateMarkdownFiles` | `boolean` | `false` | Generate an individual `.md` file per page and link to those from `llms.txt` instead of the original docs. |
| `preserveDirectoryStructure` | `boolean` | `true` | Preserve the source directory structure in generated markdown files (for example `docs/server/config.md` rather than `server/config.md`). Only applies when `generateMarkdownFiles` is `true`. |
| `keepFrontMatter` | `string[]` | none | Front matter keys to preserve in generated markdown files. Only applies when `generateMarkdownFiles` is `true`. |

## Content sources

These options select which files the plugin reads and in what order.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `docsDir` | `string \| DocsSection[]` | `'docs'` | Documentation source. A string base directory, or an array of section objects for multi-instance setups. See [Documentation sections](#documentation-sections). |
| `ignoreFiles` | `string[]` | `[]` | Glob patterns for files to skip. |
| `includeBlog` | `boolean` | `false` | Whether to include blog content. |
| `includeOrder` | `string[]` | `[]` | Glob patterns controlling the order files are processed in. |
| `includeUnmatchedLast` | `boolean` | `true` | Whether to append files that match no `includeOrder` pattern at the end. Set to `false` to make `includeOrder` a strict inclusion list. |
| `processingBatchSize` | `number` | `100` | Batch size for processing large document sets, to bound memory use on big sites. |

## Content and metadata

These options set the title, description, and inline content of the generated files.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | Site title | Custom title used in generated files. |
| `description` | `string` | Site tagline | Custom description used in generated files. |
| `version` | `string` | `undefined` | Global version label stamped into all generated files. |
| `rootContent` | `string` | Standard llmstxt.org blurb | Custom content inserted at the root of `llms.txt`, after the title and description and before the table of contents. |
| `fullRootContent` | `string` | Standard llmstxt.org blurb | Custom content inserted at the root of `llms-full.txt`, after the title and description and before the content sections. |

## Content cleaning

These options strip noise from the source markdown before it's written.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `excludeImports` | `boolean` | `false` | Remove `import` statements from generated content. |
| `removeDuplicateHeadings` | `boolean` | `false` | Remove content that just repeats the heading text immediately below it. |

## URL construction

These options control the links the plugin emits.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `addMdExtension` | `boolean` | `true` | Append `.md` to link URLs in `llms.txt`, per the llmstxt.org spec. |
| `useRelativeUrls` | `boolean` | `false` | Emit origin-relative links (for example `/docs/page.md`) instead of absolute URLs. Useful for subpath deployments where the site `url` can't be pinned. |
| `rewriteImageUrls` | `boolean` | `false` | Rewrite relative image references to absolute hashed build-output URLs so LLMs can resolve them. |
| `pathTransformation` | `object` | `undefined` | Fallback path rewriting for URL construction. See [Path transformation](#path-transformation). |

The `pathTransformation` object has two fields:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `ignorePaths` | `string[]` | `[]` | Path segments to remove when constructing URLs. |
| `addPaths` | `string[]` | `[]` | Path segments to prepend when constructing URLs, if not already present. |

## Advanced

These options handle multi-file, multi-version, and diagnostic behavior.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `customLLMFiles` | `CustomLLMFile[]` | `[]` | Additional LLM files for specific documentation sections. See [Custom LLM files](#custom-llm-files). |
| `versions` | `VersionConfig[] \| 'auto'` | `undefined` | Generate a version-scoped set of files per documentation version. `'auto'` detects versions from Docusaurus docs versioning. See [Versions](#versions). |
| `logLevel` | `'quiet' \| 'normal' \| 'verbose'` | `'normal'` | Amount of build output the plugin prints. See [Logging](#logging). |
| `warnOnIgnoredFiles` | `boolean` | `false` | Whether to warn about files that are skipped because they have no extension or an unsupported one. |

## Documentation sections

`docsDir` accepts either a string (a single base directory) or an array of `DocsSection` objects. Use the array form for multi-instance setups, so each section resolves against its own route base path and can carry its own heading in `llms.txt`.

Each section object has this shape:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | `string` | yes | Filesystem path to the section, relative to the site directory (for example `'docs'`, `'api'`). |
| `routeBasePath` | `string` | yes | The Docusaurus `routeBasePath` the section is served under (for example `'docs'`, `'api'`). |
| `label` | `string` | no | Optional heading shown for the section in `llms.txt`. |

When `docsDir` is a string, it's treated as a single section whose `routeBasePath` matches the directory name.

## Custom LLM files

Each entry in `customLLMFiles` is a `CustomLLMFile` object with these fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `filename` | `string` | yes | Name of the output file (for example `'llms-python.txt'`). |
| `includePatterns` | `string[]` | yes | Glob patterns for files to include. |
| `fullContent` | `boolean` | yes | `true` for full content like `llms-full.txt`, `false` for links only like `llms.txt`. |
| `title` | `string` | no | Custom title for this file. Defaults to the site title. |
| `description` | `string` | no | Custom description for this file. Defaults to the site description. |
| `ignorePatterns` | `string[]` | no | Additional patterns to exclude, combined with the global `ignoreFiles`. |
| `orderPatterns` | `string[]` | no | Order patterns for this file, like `includeOrder`. |
| `includeUnmatchedLast` | `boolean` | no | Whether to append unmatched files last. Defaults to `false`. |
| `version` | `string` | no | Version label for this file, overriding the global `version`. |
| `rootContent` | `string` | no | Custom content inserted at the root of this file, after the title and description. |

## Versions

Set `versions` to publish a separate set of LLM files per documentation version, each written under its own subdirectory with links scoped to that version's routes. Provide an explicit array of `VersionConfig` objects, or `'auto'` to detect versions from Docusaurus docs versioning (`versions.json` plus `versioned_docs/`). Any field left unset on a version falls back to the matching top-level option.

Each `VersionConfig` entry accepts:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | required | Version identifier (for example `'nightly'`, `'stable'`, `'0.0.1'`). |
| `label` | `string` | `name` | Label written into the `Version:` line of generated files. |
| `docsDir` | `string \| DocsSection[]` | top-level `docsDir` | Source docs directory or sections for this version. |
| `path` | `string` | `name` | Output subdirectory and route prefix. Use `''` for the site root. |
| `customLLMFiles` | `CustomLLMFile[]` | top-level value | Per-version custom LLM files. |
| `includeOrder` | `string[]` | top-level value | Per-version include order. |

## Path transformation

The plugin resolves URLs by matching file paths against Docusaurus's actual routes, so `pathTransformation` is only applied as a fallback when a file can't be matched to a known route. In most setups you don't need it. When you do, `ignorePaths` strips segments from the constructed URL and `addPaths` prepends them:

```js
pathTransformation: {
  ignorePaths: ['docs'],
  addPaths: ['api'],
}
```

With that config, the file `/content/docs/manual/decorators.md` resolves to `https://example.com/api/manual/decorators`.

## Logging

The `logLevel` option controls how much the plugin prints during the build. It takes one of three values:

- `'quiet'`: suppresses all output except errors. Use it for clean CI/CD builds.
- `'normal'` (default): shows standard progress messages and warnings.
- `'verbose'`: shows file-by-file processing detail. Use it for debugging.

Set the level alongside your other options:

```js
{
  logLevel: 'verbose',
}
```

In `'normal'` mode, output looks like this:

```
[docusaurus-plugin-llms] Generating LLM-friendly documentation...
[docusaurus-plugin-llms] Generated: /path/to/llms.txt
[docusaurus-plugin-llms] Generated: /path/to/llms-full.txt
[docusaurus-plugin-llms] Stats: 42 total available documents processed
```

In `'quiet'` mode, only errors appear:

```
[docusaurus-plugin-llms] ERROR: Error generating LLM documentation: ...
```
