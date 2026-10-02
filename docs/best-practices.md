---
description: Recommended option combinations for API reference, tutorials, and multi-language docs, plus checks for the deployed output.
---

# Best practices

This page lists option settings for API reference, tutorials, and
multi-language docs, plus notes on deployment, build time, and memory. For each option's
full reference, see [configuration options](./configuration.md) and
[content cleaning](./content-cleaning.md).

## API documentation

Auto-generated API docs (OpenAPI output, for example) carry React component
imports and short sections that repeat their own heading. Turn on
both content-cleaning options and generate a single full-content file so an LLM
can read the whole reference at once:

```js
{
  excludeImports: true,           // Remove React component imports
  removeDuplicateHeadings: true,  // Remove lines that repeat an endpoint heading
  generateLLMsFullTxt: true,      // Write every page to one file
}
```

Both `excludeImports` and `removeDuplicateHeadings` are `boolean` and default to
`false`, so you have to opt in.

## Tutorial content

For hand-written tutorials and guides, clean up MDX imports but leave the prose
alone, since duplicate-heading removal can strip content you wrote on purpose.
Use `includeOrder` to set the reading order:

```js
{
  excludeImports: true,           // Remove any MDX imports
  removeDuplicateHeadings: false, // Keep all content as written
  includeOrder: [                 // Reading order
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
file per language with `customLLMFiles`. Each entry needs a `filename`, an
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

## Validating the deployed output

The plugin builds `llms.txt` from your site's build routes and can't see the
deployed site. Host redirect rules, `trailingSlash` settings, and docs restructures can
break the served `llms.txt` after a successful build, leaving an empty file or
dead links.

[llms-txt-check](https://github.com/portdeveloper/llms-txt-check) checks the
deployed file against what your site serves:

```yaml
- run: npx llms-txt-check https://your-docs-site.com
```

It exits nonzero when the file or any listed URL stops serving, so the deploy
step fails when a route breaks. Run it as a final step in your deploy pipeline,
after the site is live.

## Build time and memory

The plugin does all its work in the `postBuild` hook, after Docusaurus has
built the site, and the cleaning options add little time to that step.

The plugin holds every processed document in memory while it writes
`llms-full.txt`, so memory use grows with the size of your docs. On a
memory-constrained runner, give Node.js more heap with
`NODE_OPTIONS=--max-old-space-size=4096`.
