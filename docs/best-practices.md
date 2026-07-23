# Best practices

This page collects recommended option combinations for common documentation
shapes, plus notes on performance and backward compatibility. All the options
mentioned here are covered in detail on the [options](./configuration.md) and
[content cleaning](./content-cleaning.md) pages.

## API documentation

Auto-generated API docs (OpenAPI output, for example) tend to carry React
component imports and short sections that just repeat their own heading. Turn on
both content-cleaning options and generate a single full-content file so an LLM
can read the whole reference at once:

```js
{
  excludeImports: true,           // Remove React component imports
  removeDuplicateHeadings: true,  // Remove redundant API endpoint descriptions
  generateLLMsFullTxt: true,      // Create one comprehensive file
}
```

Both `excludeImports` and `removeDuplicateHeadings` are `boolean` and default to
`false`, so you have to opt in.

## Tutorial content

For hand-written tutorials and guides, clean up MDX imports but leave the prose
alone, since duplicate-heading removal can strip content you wrote on purpose.
Use `includeOrder` to put the reading sequence in a sensible order:

```js
{
  excludeImports: true,           // Remove any MDX imports
  removeDuplicateHeadings: false, // Keep all content as written
  includeOrder: [                 // Organize content logically
    'getting-started/*',
    'tutorials/*',
    'advanced/*',
  ],
}
```

`includeOrder` is a `string[]` of glob patterns and defaults to `[]`. Files that
don't match any pattern are appended at the end, because `includeUnmatchedLast`
defaults to `true`. Set it to `false` if you want `includeOrder` to act as a
strict allowlist.

## Multi-language documentation

If your docs cover more than one programming language, generate a separate
clean file per language with `customLLMFiles`. Each entry needs a `filename`, an
`includePatterns` array, and a `fullContent` flag:

```js
{
  excludeImports: true,
  removeDuplicateHeadings: true,
  customLLMFiles: [
    {
      filename: 'llms-python.txt',
      includePatterns: ['**/python/**/*.md'],
      fullContent: true,
      title: 'Python Documentation',
    },
    {
      filename: 'llms-javascript.txt',
      includePatterns: ['**/javascript/**/*.md'],
      fullContent: true,
      title: 'JavaScript Documentation',
    },
  ],
}
```

`customLLMFiles` is an array and defaults to `[]`. See [custom LLM
files](./content-generation.md) for the full field reference, including
`ignorePatterns`, `orderPatterns`, and per-file `version`.

## Performance considerations

Content cleaning is cheap. A few things worth knowing:

- Both cleaning options add minimal processing overhead.
- Cleaning runs on the content after HTML tag removal.
- The work happens only during LLM file generation in the `postBuild` hook, so
  there's no effect on the rest of your site's build.

For very large sites, tune `processingBatchSize` (a `number`, default `100`) to
control memory use. Lower it (for example `50`) on memory-constrained runners or
sites with 1000+ documents; raise it on high-memory systems for faster
processing. See [large sites](./ordering-and-paths.md) for details.

## Backward compatibility

Every option that changes output defaults to off or to the previous behavior, so
existing configurations keep working untouched:

- `excludeImports` and `removeDuplicateHeadings` default to `false`. Only
  configs that explicitly enable them see cleaned output.
- `generateMarkdownFiles` defaults to `false`, so the plugin links to your
  original pages unless you opt in.
- `rewriteImageUrls` defaults to `false`, preserving the original relative image
  paths.

You only get the new behavior when you turn it on.
