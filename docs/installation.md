---
description: Install docusaurus-plugin-llms, register it in docusaurus.config.js, and confirm the build writes llms.txt.
---

# Installation

Install the package, register it in `docusaurus.config.js`, and run a production build to generate `llms.txt` and `llms-full.txt`.

## Install the package

Install the plugin as a dev dependency with your package manager.

With npm:

```bash
npm install docusaurus-plugin-llms --save-dev
```

With yarn:

```bash
yarn add --dev docusaurus-plugin-llms
```

With pnpm:

```bash
pnpm add --save-dev docusaurus-plugin-llms
```

## Register the plugin

Add the plugin to the `plugins` array in your `docusaurus.config.js`:

```js
module.exports = {
  // ... your existing Docusaurus config
  plugins: [
    'docusaurus-plugin-llms',
    // ... your other plugins
  ],
};
```

With no options, the plugin reads from the `docs` directory and generates both `llms.txt` (a links file) and `llms-full.txt` (all content in one file). To change what it generates, see [configuration options](./configuration.md).

## Verify it works

The plugin runs in the `postBuild` lifecycle hook, so it generates files during a production build. Build your site:

```bash
npm run build
```

When the build finishes, check that `llms.txt` exists in the build output:

```bash
cat build/llms.txt
```

The file starts with your site title and tagline, followed by a link to each documentation page. `build/llms-full.txt` holds the full content of every page. To control the description shown next to each link, see [page titles and descriptions](./overview.md#page-titles-and-descriptions).
