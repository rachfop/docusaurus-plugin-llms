# Ordering and path transformation

This page covers three ways to shape the generated output: controlling the order in which documents appear, transforming the URLs the plugin builds from file paths, and tuning batch processing for large sites. All three are optional. The defaults work out of the box, so reach for these options only when you need a specific order, a URL that doesn't match the default route resolution, or memory control on a very large build.

For the full option list, see [available options](./configuration.md). For per-file variants of the ordering options, see [custom LLM files](./content-generation.md).

## Document ordering

By default the plugin emits documents in the order it discovers them. To impose a specific sequence, set `includeOrder` (type `string[]`, default `[]`) to an array of glob patterns. The plugin walks the patterns in order, and for each pattern it appends every matching file that hasn't already been placed. A file is emitted once, under the first pattern it matches, so earlier patterns win.

This example groups documents into sections that appear in the listed order:

```js
includeOrder: [
  'getting-started/*',
  'guides/*',
  'api/*',
  'advanced/*',
]
```

Because each file is claimed by the first pattern it matches, you can list specific files before a wildcard to pin them to the top of their group:

```js
includeOrder: [
  'getting-started/installation.md',   // this specific file first
  'getting-started/quick-start.md',    // then this one
  'getting-started/*.md',              // then the rest of getting-started
  'api/core/*.md',
  'api/**/*.md',                       // all remaining API docs
]
```

### Patterns match site-relative and docs-relative paths

Patterns in `includeOrder`, `ignoreFiles`, and a custom file's `includePatterns` are each tested against two forms of the file path:

- The site-relative path, relative to your site root, such as `docs/quickstart/file.md`.
- The docs-relative path, relative to your `docsDir`, such as `quickstart/file.md`.

A pattern matches if it matches either form, so both `docs/quickstart/*` and `quickstart/*` select the same files. The docs-relative form is usually more intuitive and more portable across configurations, so prefer it unless you have a reason to key off the `docs/` prefix.

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
  'tutorials/beginner/**/*',   // all beginner tutorials, any depth
  'tutorials/intermediate/*',  // intermediate tutorials, one level
  'tutorials/**/*',            // everything else under tutorials
]
```

Custom LLM files accept the same behavior through their own `orderPatterns` and `includeUnmatchedLast` fields. See [custom LLM files](./content-generation.md) for details.

## Path transformation

The plugin resolves each document's URL by suffix-matching the file path against Docusaurus's actual routes, which it receives through the `postBuild` hook. That route matching is correct for the large majority of sites, so in most configurations you don't need `pathTransformation` at all. Path transformation is applied only as a fallback, when a file can't be matched to a known route.

When you do need it, `pathTransformation` (type `object`, default `undefined`) takes two arrays, each defaulting to `[]`:

- `pathTransformation.ignorePaths` (type `string[]`): path segments to remove from the URL when they're present.
- `pathTransformation.addPaths` (type `string[]`): path segments to prepend to the URL when they aren't already there.

To strip a leading `docs` segment so it doesn't appear in the URL, use `ignorePaths`:

```js
pathTransformation: {
  ignorePaths: ['docs'],
}
```

With that setting, the file `/content/docs/manual/decorators.md` resolves to `https://example.com/manual/decorators`.

To prepend a segment such as `api`, use `addPaths`:

```js
pathTransformation: {
  addPaths: ['api'],
}
```

That turns `/content/manual/decorators.md` into `https://example.com/api/manual/decorators`.

You can combine both. The plugin removes the ignored segments first, then prepends the added ones:

```js
pathTransformation: {
  ignorePaths: ['docs'],
  addPaths: ['api'],
}
```

That maps `/content/docs/manual/decorators.md` to `https://example.com/api/manual/decorators`. Both arrays accept multiple segments.

## Batch processing for large sites

The plugin processes documents in batches so that very large sites don't exhaust memory. `processingBatchSize` (type `number`, default `100`) sets how many documents are handled per batch. Batches run one after another, and document order is preserved across batch boundaries, so tuning this value changes memory use and progress reporting but never the output order.

Adjust the batch size to fit your site and build environment:

- Large sites, 1000 or more documents: lower the value, for example `50`, to reduce peak memory.
- Small sites, fewer than 100 documents: the default is fine.
- Memory-constrained environments such as CI runners: lower the value to avoid out-of-memory errors.
- High-memory systems: raise the value, for example `200`, for faster processing.

This configuration processes 50 documents at a time:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        processingBatchSize: 50,
        // ... other options
      },
    ],
  ],
};
```

When more than one batch is needed, per-batch progress is logged in verbose mode. See [logging](./configuration.md) to set `logLevel: 'verbose'`.
