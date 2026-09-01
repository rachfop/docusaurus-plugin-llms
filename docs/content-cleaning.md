# Content cleaning

Documentation written for humans often carries markup that adds noise for a language model: MDX import statements, HTML wrappers, and auto-generated content that just echoes its own heading. The plugin can strip these before writing `llms.txt`, `llms-full.txt`, and any individual markdown files, so the output stays compact and readable.

Some cleaning always happens. Regardless of your options, the plugin removes common HTML tags (`<div>`, `<span>`, `<img>`, and so on) and MDX/JSX component tags (PascalCase elements like `<Tabs>` or `<Admonition>`), keeping their inner text. Docusaurus's `<TabItem>` gets special handling: its `label` (or `value`, when no label is set) is emitted as a bold line before the tab body, so tabbed sections keep their structure in the generated markdown. Other PascalCase tags you can exempt from stripping with the `preserveComponents` option, described below. The remaining cleaning options are opt-in: `excludeImports`, `removeDuplicateHeadings`, and `rewriteImageUrls`. Each defaults to `false`, so existing configurations keep their current output until you enable them.

Cleaning runs after code blocks are masked out, so fenced code and inline code are never touched. An `import` line or an HTML snippet shown inside a code sample stays exactly as written.

## Import statement removal (`excludeImports`)

`excludeImports` is a `boolean` (default `false`). When `true`, it removes JavaScript and TypeScript `import` statements from your MDX content. These lines are rarely useful to an LLM and add clutter, especially in API docs that pull in many theme components.

The option strips the common `import` forms: named imports, default imports, namespace imports (`import * as ...`), and side-effect imports (`import "...";`). Given an MDX file that starts with a block of component imports:

```markdown
import ApiTabs from "@theme/ApiTabs";
import DiscriminatorTabs from "@theme/DiscriminatorTabs";
import MethodEndpoint from "@theme/ApiExplorer/MethodEndpoint";
import MimeTabs from "@theme/MimeTabs";

# Create user account

This endpoint creates a new user account...
```

With `excludeImports: true`, the generated output drops the import lines and keeps the content:

```markdown
# Create user account

This endpoint creates a new user account...
```

To enable it:

```js
{
  excludeImports: true,
}
```

Import lines inside a fenced code block are left alone, since the masking step protects code samples. This option pairs naturally with [Docusaurus partials](https://docusaurus.io/docs/markdown-features/react#importing-markdown), whose imports are resolved and inlined during processing.

## Duplicate heading removal (`removeDuplicateHeadings`)

`removeDuplicateHeadings` is a `boolean` (default `false`). When `true`, it removes a line that repeats its heading text immediately below the heading. This pattern is common in auto-generated API docs, where each entry renders both a heading and a body line containing the same text.

The removal is deliberately narrow: the plugin only drops the next non-empty line after a heading when that line exactly matches the heading text and is not itself a heading. Blank lines between the heading and the repeated text are preserved, and a lower-level heading of the same wording is never removed. Given a file where each entry duplicates its title:

```markdown
# Create deliverable

Create deliverable

---

# Update user profile

Update user profile

---
```

With `removeDuplicateHeadings: true`, the echoed lines are gone:

```markdown
# Create deliverable

---

# Update user profile

---
```

To enable it:

```js
{
  removeDuplicateHeadings: true,
}
```

## Preserving component tags (`preserveComponents`)

`preserveComponents` is a `string[]` (default `[]`). By default the plugin strips every MDX/JSX component tag (PascalCase elements) and keeps only the inner text. For components that render meaningful content on their own, such as a swizzled `<PackageManagerTabs>` or a custom `<ModelDownload>` that expands into real instructions, stripping loses information. List those component names and their tags (and the props on them) pass through untouched:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        preserveComponents: ['PackageManagerTabs', 'ModelDownload'],
      },
    ],
  ],
};
```

Given MDX like:

```markdown
<PackageManagerTabs command="add my-package" />
```

The generated output keeps the tag as-is, so an LLM reading it still sees the command the component would render. Matching is exact on the component name (opening and closing tags), so `<Keep>` is preserved without affecting `<KeepAll>`.

Two special cases run regardless of this option:

- `<TabItem>` is never preserved as a raw tag. Instead, its `label` (or `value` when no label is set) is emitted as a bold line before the tab body, so a tabbed section degrades into a readable plain-markdown outline. This needs no configuration.
- Tags inside fenced code blocks or inline code spans are never touched by any cleaning step, including this one.

## Combined content cleaning

You can enable both options together for the cleanest output:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        excludeImports: true,
        removeDuplicateHeadings: true,

        // Other options work normally:
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        docsDir: 'docs',
      },
    ],
  ],
};
```

## Content cleaning by use case

Pick the combination that matches your content:

- Minimal cleanup (the default): set both options to `false` to preserve all original content, including import statements. This suits hand-written docs without redundant patterns.

- Import cleanup only: set `excludeImports: true` and `removeDuplicateHeadings: false`. This removes technical imports from MDX-heavy sites while keeping every line of prose intact.

- Full cleanup: set both to `true`. This is the recommended setting for API reference and other auto-generated content, since it removes both imports and echoed heading text for the most concise output.

Here's the full-cleanup configuration:

```js
{
  excludeImports: true,
  removeDuplicateHeadings: true,
}
```

## Image URL rewriting (`rewriteImageUrls`)

`rewriteImageUrls` is a `boolean` (default `false`). Docusaurus source files reference images with paths relative to the source file:

```md
![Architecture diagram](./img/arch.png)
![Deployment flow](../img/deploy.png)
```

During a build, Docusaurus copies these images to `build/assets/images/` with a content hash appended to the filename (for example, `arch-1a2b3c4d5e6f7890.png`). The generated markdown and `llms-full.txt` still hold the original relative paths, which an LLM reading the served files can't resolve against an absolute URL.

When `rewriteImageUrls: true`, the plugin scans `build/assets/images/` after the build and rewrites each relative image reference to the absolute hashed URL. A reference like this:

```md
![Architecture diagram](./img/arch.png)
```

becomes an absolute URL pointing at the hashed file:

```md
![Architecture diagram](https://yoursite.com/assets/images/arch-1a2b3c4d5e6f7890.png)
```

To enable it, typically alongside `generateMarkdownFiles`:

```js
module.exports = {
  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        generateMarkdownFiles: true,
        rewriteImageUrls: true,
      },
    ],
  ],
};
```

### How rewriting works

The plugin resolves each reference by basename:

1. After the build, it scans `build/assets/images/` and builds a lookup map from each original basename to its list of hashed build paths.
2. For every relative image reference in the generated content, it extracts the basename and looks it up in the map.
3. On a single match, it rewrites the path directly.
4. On multiple matches (two images share a filename), it reads the source file and compares its bytes against each candidate, using the exact match.
5. On no match (a placeholder image, or a file in an unprocessed section), it keeps the original relative path.

### Limitations

A few constraints follow from scanning the build output:

- Only images that Docusaurus actually bundled into `build/assets/images/` are rewritten. An image no rendered page references isn't in the build and can't be rewritten.
- Rewriting applies to both individual `.md` files (when `generateMarkdownFiles: true`) and `llms-full.txt`.
- The option defaults to `false` to preserve backward compatibility.

## Related pages

- [Installation](./installation.md)
