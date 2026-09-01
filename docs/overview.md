# Overview

`docusaurus-plugin-llms` generates LLM-friendly documentation from your Docusaurus site, following the [llmstxt standard](https://llmstxt.org/). During a production build it writes an `llms.txt` file with links to every documentation section and an `llms-full.txt` file that bundles all your content into a single document, so LLMs can consume your docs without parsing HTML.

The plugin works with zero configuration and runs during `npm run build` via the Docusaurus `postBuild` hook. It doesn't run during `docusaurus start`.

## What it does

- Generates `llms.txt` with links to each documentation section.
- Generates `llms-full.txt` with all content in one file.
- Optionally generates individual `.md` files per page for closer llmstxt.org compliance.
- Controls document order with glob patterns.
- Includes blog posts when you want them.
- Generates custom LLM files scoped to specific sections, languages, or content types.
- Cleans content for LLMs: strips HTML, removes import statements, and removes duplicate headings.
- Rewrites relative image paths to absolute build-output URLs.
- Supports multi-instance and multi-version docs setups.
- Reports statistics about the generated output.

## Minimal example

Install the plugin as a dev dependency:

```bash
npm install docusaurus-plugin-llms --save-dev
```

Add it to the `plugins` array in your `docusaurus.config.js`:

```js
module.exports = {
  // ... your existing Docusaurus config
  plugins: [
    'docusaurus-plugin-llms',
    // ... your other plugins
  ],
};
```

Then run your production build:

```bash
npm run build
```

With the defaults, the plugin scans the `docs` directory and writes two files to the build output:

```
build/
├── llms.txt        # Links to each documentation section
└── llms-full.txt   # All documentation content in one file
```

The generated `llms.txt` looks like this:

```
# My Site

> My site tagline

This file contains links to documentation sections following the llmstxt.org standard.

- [Getting Started](https://example.com/docs/getting-started.md)
- [API Reference](https://example.com/docs/api/reference.md)
```

## Next steps

- See [installation](./installation.md) to add the plugin to your project.
- See [configuration](./configuration.md) for the full list of options, including document ordering, custom LLM files, content cleaning, and multi-version output.
