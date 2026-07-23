# 📜 docusaurus-plugin-llms

A Docusaurus plugin for generating LLM-friendly documentation following the [llmstxt standard](https://llmstxt.org/).

[![npm version](https://img.shields.io/npm/v/docusaurus-plugin-llms.svg)](https://www.npmjs.com/package/docusaurus-plugin-llms)
[![npm downloads](https://img.shields.io/npm/dm/docusaurus-plugin-llms.svg)](https://www.npmjs.com/package/docusaurus-plugin-llms)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/rachfop?style=flat&logo=githubsponsors&label=Sponsor&labelColor=gray&color=pink)](https://github.com/sponsors/rachfop)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

During a production build, this plugin scans your Docusaurus docs and writes an `llms.txt` file linking every documentation section plus an `llms-full.txt` file bundling all your content into one document. That lets LLMs consume your docs without parsing HTML. It works with zero configuration and stays out of your way until you need to customize it.

## Features

- Generates `llms.txt` with section links and `llms-full.txt` with all content in one file.
- Optionally writes individual `.md` files per page for closer llmstxt.org compliance.
- Controls document order and transforms URLs with glob patterns.
- Cleans content for LLMs: strips HTML, removes import statements, and drops duplicate headings.
- Rewrites relative image paths to absolute build-output URLs.
- Supports custom LLM files, multi-instance docs, and multi-version output.

## Quick start

Install the plugin as a dev dependency:

```bash
npm install docusaurus-plugin-llms --save-dev
```

Register it in `docusaurus.config.js`:

```js
module.exports = {
  // ... your existing Docusaurus config
  plugins: [
    'docusaurus-plugin-llms',
    // ... your other plugins
  ],
};
```

On your next `npm run build`, the plugin writes `llms.txt` and `llms-full.txt` into the build output.

## Documentation

- [Overview](./docs/overview.md) — what the plugin generates and how it runs.
- [Installation](./docs/installation.md) — install the package and register it with a zero-config setup.
- [Configuration options](./docs/configuration.md) — the full reference for every option the plugin accepts.
- [Generating content](./docs/content-generation.md) — multiple doc sections, custom root content, custom LLM files, and partials.
- [Generating individual Markdown files](./docs/markdown-files.md) — what `generateMarkdownFiles` produces and how files are named and laid out.
- [Content cleaning](./docs/content-cleaning.md) — strip HTML, remove imports, drop duplicate headings, and rewrite image URLs.
- [Ordering and path transformation](./docs/ordering-and-paths.md) — control document order, transform URLs, and tune batch processing.
- [Multi-version output](./docs/multi-version.md) — publish a separate set of LLM files per documentation version.
- [Best practices](./docs/best-practices.md) — recommended option combinations for common documentation shapes.

## License

This project is licensed under the MIT License.
