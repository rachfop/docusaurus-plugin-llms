---
description: What docusaurus-plugin-llms generates from a Docusaurus site and when it runs.
---

# Overview

`docusaurus-plugin-llms` writes text files that describe your Docusaurus docs for language models, in the format the [llmstxt standard](https://llmstxt.org/) defines. During a production build it writes an `llms.txt` file with links to every documentation page and an `llms-full.txt` file that bundles all your content into a single document, so LLMs can read your docs without parsing HTML.

The plugin needs no configuration. It runs in the Docusaurus `postBuild` hook, so it generates files during `npm run build` and not during `docusaurus start`.

## What it does

- Generates `llms.txt` with links to each documentation page.
- Generates `llms-full.txt` with all content in one file.
- Optionally generates individual `.md` files per page, which the llmstxt.org spec recommends.
- Controls document order with glob patterns.
- Includes blog posts when you enable them.
- Generates custom LLM files scoped to specific sections, languages, or content types.
- Cleans content for LLMs: strips HTML, removes import statements, and removes duplicate headings.
- Rewrites relative image paths to absolute build-output URLs.
- Supports multi-instance and multi-version docs setups.
- Reports statistics about the generated output.

## Generated output

With the defaults, the plugin scans the `docs` directory and writes two files to the build output:

```
build/
├── llms.txt        # Links to each documentation page
└── llms-full.txt   # All documentation content in one file
```

The generated `llms.txt` opens with your site title and tagline, followed by a link to each page and that page's description:

```
# My Site

> My site tagline

This file contains links to documentation sections following the llmstxt.org standard.

## Table of Contents

- [Getting Started](https://example.com/docs/getting-started): Install the CLI and run your first build.
- [API Reference](https://example.com/docs/api/reference): Every endpoint, with request and response examples.
```

Links point at your HTML pages. To link to a Markdown copy of each page, as the llmstxt.org spec recommends, see [generating individual Markdown files](./markdown-files.md).

In `llms-full.txt`, each page appears under a `## {title}` heading, with the page's own headings shifted down one level so they nest under it.

The plugin skips pages with `draft: true` in their front matter.

## Page titles and descriptions

Each entry takes its title and description from the source page.

The title comes from the front matter `title`, then the first `#` heading, then the file name.

The description comes from the first of these that exists:

1. The front matter `description`.
2. The first prose paragraph. Code blocks, tables, admonitions, JSX or HTML elements, images, and `import`/`export` lines are skipped.
3. The text of the first heading.

`llms.txt` shows the first line of the description, truncated to 150 characters. For a summary you control, set `description` in each page's front matter:

```markdown
---
description: Install the CLI and run your first build.
---
```

## Translated sites

On a site with [Docusaurus i18n](https://docusaurus.io/docs/i18n/introduction), each locale's build writes its own files to that locale's build directory, such as `build/fr/llms.txt`, with links under the locale's URLs. A page's content comes from its translation in `i18n/<locale>/docusaurus-plugin-content-docs/` (or `i18n/<locale>/docusaurus-plugin-content-blog/` for blog posts). A page with no translation uses its source file, as the Docusaurus build does. A locale with `translate: false` always uses the source files.

## Next steps

- See [installation](./installation.md) to add the plugin to your project.
- See [configuration options](./configuration.md) for the full list of options, including document ordering, custom LLM files, content cleaning, and multi-version output.
