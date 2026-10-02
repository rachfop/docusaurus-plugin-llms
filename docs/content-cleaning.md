---
description: Strip HTML, MDX imports, and repeated heading text from generated files, and rewrite relative image URLs.
---

# Content cleaning

Documentation written for humans carries markup that adds noise for a language model: MDX import statements, HTML wrappers, and auto-generated text that repeats its own heading. The plugin strips this markup before it writes `llms-full.txt` and any individual Markdown files.

Some cleaning always runs. The plugin removes common HTML tags (`<div>`, `<span>`, `<img>`, and so on) and MDX/JSX component tags (PascalCase elements like `<Tabs>` or `<Admonition>`), and keeps their inner text. Docusaurus's `<TabItem>` is a special case: the plugin writes its `label` (or `value`, when no label is set) as a bold line before the tab body, so tabbed sections keep their structure. To keep other component tags, list them in [`preserveComponents`](#preserving-component-tags-preservecomponents).

The other cleaning options are opt-in, and each defaults to `false`: `excludeImports`, `removeDuplicateHeadings`, and `rewriteImageUrls`.

Cleaning skips fenced code and inline code, so an `import` line or an HTML snippet inside a code sample is left as written.

## Import statement removal (`excludeImports`)

`excludeImports` is a `boolean` (default `false`). When `true`, it removes JavaScript and TypeScript `import` statements from your MDX content. These lines carry no content for an LLM, and API docs that pull in many theme components can open with a dozen of them.

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

Import lines inside a fenced code block are left alone. Imports of [Docusaurus partials](https://docusaurus.io/docs/markdown-features/react#importing-markdown) are resolved and inlined whether or not this option is set; see [how partials are resolved](./content-generation.md#how-partials-are-resolved).

## Duplicate heading removal (`removeDuplicateHeadings`)

`removeDuplicateHeadings` is a `boolean` (default `false`). When `true`, it removes a line that repeats its heading text immediately below the heading. This pattern is common in auto-generated API docs, where each entry renders both a heading and a body line containing the same text.

The plugin drops the next non-empty line after a heading only when that line matches the heading text and is itself plain text, not a heading. Blank lines between the heading and the repeated text are preserved, and a lower-level heading of the same wording is never removed. Given a file where each entry duplicates its title:

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

## Choose cleaning options by content type

Which options to enable depends on how the docs were written:

- Hand-written guides: leave both options off, or set `excludeImports: true` on MDX-heavy sites. `removeDuplicateHeadings` can drop a line you wrote on purpose.
- API reference and other generated content: set both options to `true` to remove imports and repeated heading text.

The configuration for generated content:

```js
{
  excludeImports: true,
  removeDuplicateHeadings: true,
}
```

For more combinations, see [best practices](./best-practices.md).

## Image URL rewriting (`rewriteImageUrls`)

`rewriteImageUrls` is a `boolean` (default `false`). When `true`, the plugin rewrites relative image references to absolute URLs of the images in the build output. Docusaurus source files reference images with paths relative to the source file:

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
4. On multiple matches (two images share a filename), it compares the source image's bytes against each candidate and uses the one that matches.
5. On no match (a placeholder image, or a file in an unprocessed section), it keeps the original relative path.

### Limitations

Because the plugin works from the build output, rewriting has these limits:

- Only images that Docusaurus bundled into `build/assets/images/` are rewritten. An image that no rendered page references isn't in the build, so its path stays relative.
- Rewriting applies to Markdown image syntax (`![alt](path)`). Cleaning strips HTML `<img>` tags before rewriting runs.
- Rewriting applies to individual `.md` files (when `generateMarkdownFiles: true`), `llms-full.txt`, and full-content custom LLM files.
- With `useRelativeUrls: true`, rewritten image URLs stay absolute.

## Related pages

- [Generating individual Markdown files](./markdown-files.md)
- [Best practices](./best-practices.md)
- [Configuration options](./configuration.md#content-cleaning)
