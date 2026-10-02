---
description: Set the order of documents with glob patterns, rewrite URLs for files that match no route, and set the batch size for progress logging.
---

# Ordering and path transformation

These options set the order documents appear in, rewrite the URLs of files that match no Docusaurus route, and tune batch processing for large sites. All of them are optional.

For the full option list, see [configuration options](./configuration.md). For per-file variants of the ordering options, see [custom LLM files](./content-generation.md#generate-custom-llm-files).

## Document ordering

By default the plugin emits documents in the order it discovers them. To impose a specific sequence, set `includeOrder` (type `string[]`, default `[]`) to an array of glob patterns. The plugin walks the patterns in order, and for each pattern it appends every matching file that hasn't already been placed. A file is emitted once, under the first pattern it matches, so earlier patterns win.

This example groups documents into sections that appear in the listed order:

```js
includeOrder: ['getting-started/*', 'guides/*', 'api/*', 'advanced/*'];
```

Because each file is claimed by the first pattern it matches, you can list specific files before a wildcard to pin them to the top of their group:

```js
includeOrder: [
  'getting-started/installation.md', // this specific file first
  'getting-started/quick-start.md', // then this one
  'getting-started/*.md', // then the rest of getting-started
  'api/core/*.md',
  'api/**/*.md', // all remaining API docs
];
```

### Patterns match site-relative and docs-relative paths

Patterns in `includeOrder`, `ignoreFiles`, and a custom file's `includePatterns` are each tested against two forms of the file path:

- The site-relative path, relative to your site root, such as `docs/quickstart/file.md`.
- The docs-relative path, relative to your `docsDir`, such as `quickstart/file.md`.

A pattern matches if it matches either form, so both `docs/quickstart/*` and `quickstart/*` select the same files. The docs-relative form keeps working if you rename or move `docsDir`, so prefer it.

### Handling files that don't match

`includeUnmatchedLast` (type `boolean`, default `true`) controls what happens to files that no `includeOrder` pattern matched. When it's `true`, those files are appended after the ordered ones, so nothing is dropped. When it's `false`, `includeOrder` becomes a strict allowlist and unmatched files are excluded entirely.

This configuration includes only the files under `public-docs/` and drops everything else:

```js
includeOrder: [
  'public-docs/**/*.md',
],
includeUnmatchedLast: false
```

Nesting depth follows the glob you write. `tutorials/beginner/**/*` matches beginner tutorials at any depth, while `tutorials/intermediate/*` matches only the immediate children of that directory:

```js
includeOrder: [
  'tutorials/beginner/**/*', // all beginner tutorials, any depth
  'tutorials/intermediate/*', // intermediate tutorials, one level
  'tutorials/**/*', // everything else under tutorials
];
```

Custom LLM files have their own `orderPatterns` and `includeUnmatchedLast` fields. See [custom LLM files](./content-generation.md#generate-custom-llm-files) for details.

## Path transformation

The plugin resolves each document's URL by matching the file path against the routes Docusaurus built, which it receives through the `postBuild` hook. `pathTransformation` applies only to files that match no known route, so most sites don't need it.

`pathTransformation` (type `object`, default `undefined`) takes two arrays, each defaulting to `[]`:

- `pathTransformation.ignorePaths` (type `string[]`): path segments to remove from the URL when they're present, including the section's route base path.
- `pathTransformation.addPaths` (type `string[]`): path segments to add after the route base path when they aren't already there.

The examples below use `docsDir: 'docs'`.

To strip a leading `docs` segment so it doesn't appear in the URL, use `ignorePaths`:

```js
pathTransformation: {
  ignorePaths: ['docs'],
}
```

With that setting, the file `docs/manual/decorators.md` resolves to `https://example.com/manual/decorators`.

To add a segment such as `api`, use `addPaths`:

```js
pathTransformation: {
  addPaths: ['api'],
}
```

That turns `docs/manual/decorators.md` into `https://example.com/docs/api/manual/decorators`. The route base path `docs` stays in front.

To replace the route base path, combine both. The plugin removes the ignored segments first, then adds the new ones:

```js
pathTransformation: {
  ignorePaths: ['docs'],
  addPaths: ['api'],
}
```

That maps `docs/manual/decorators.md` to `https://example.com/api/manual/decorators`. Both arrays accept multiple segments.

## Batch processing for large sites

`processingBatchSize` (type `number`, default `100`) sets how many documents the plugin assembles into `llms-full.txt` per batch. Batches run one after another, and document order is preserved across batch boundaries.

The plugin reads and processes every document before batching starts, so the batch size doesn't change peak memory use or the output. It changes how often verbose mode logs progress: with more than one batch, the plugin logs a line per batch. Set it to a positive integer.

This configuration logs progress every 50 documents:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        logLevel: 'verbose',
        processingBatchSize: 50,
      },
    ],
  ],
};
```

For more on verbose mode, see [logging](./configuration.md#logging).
