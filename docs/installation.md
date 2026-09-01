# Installation

`docusaurus-plugin-llms` generates LLM-friendly documentation files for your Docusaurus site, following the [llmstxt standard](https://llmstxt.org/). This page covers installing the package and registering it with a minimal, zero-config setup.

## Install the package

Install the plugin as a dev dependency with your package manager of choice.

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

That's all you need. The plugin works out of the box with no options: it reads from the `docs` directory and, by default, generates both `llms.txt` (a links file) and `llms-full.txt` (all content in one file). To customize this behavior, see [configuration](./configuration.md).

## Verify it works

The plugin runs in the `postBuild` lifecycle hook, so it only runs during a production build, not during `docusaurus start`. Build your site to generate the files:

```bash
npm run build
```

When the build finishes, check that `llms.txt` exists in the build output:

```bash
cat build/llms.txt
```

You should see a file that starts with your site title and description, followed by links to your documentation pages. If you left `generateLLMsFullTxt` at its default of `true`, you'll also find `build/llms-full.txt` with the full content inlined.
