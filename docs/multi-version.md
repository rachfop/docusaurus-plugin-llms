---
description: Publish a separate llms.txt and llms-full.txt for each documentation version, with links scoped to that version's routes.
---

# Multi-version output

The `versions` option publishes a separate set of LLM files for each documentation version your site serves. The plugin runs once per version and writes each version's `llms.txt` (and any custom LLM files) under its own subdirectory, with links scoped to that version's routes. Without `versions`, the plugin writes one set of files at the site root.

## When to use it

Use `versions` when one site serves several doc versions from different route prefixes. A common setup keeps a `nightly` build at the site root and a `stable` build under `/stable`. Each version gets its own `llms.txt` at `/llms.txt` and `/stable/llms.txt`, and the links inside each file resolve to that version's URLs. The root `llms.txt` links only to root pages, and `/stable/llms.txt` links only to `/stable/` pages.

The top-level `version` option is a separate feature: it writes a `Version:` label into the generated files and produces one set of files. See [custom LLM files](./content-generation.md#generate-custom-llm-files) for the `version` label and per-file overrides.

## The `versions` option

The `versions` option accepts either an explicit array of version objects or the string `'auto'`. Its type is `VersionConfig[] | 'auto'`, and it defaults to `undefined`.

Each version object accepts these fields:

| Field            | Type                      | Default                    | Description                                                                                              |
| ---------------- | ------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `name`           | `string` (required)       | none                       | Version identifier (for example `'nightly'`, `'stable'`, or `'0.0.1'`). Must be unique across the array. |
| `label`          | `string`                  | `name`                     | Human-readable label written into the `Version:` line of the generated files.                            |
| `docsDir`        | `string \| DocsSection[]` | top-level `docsDir`        | Source docs directory (or sections) for this version, relative to the site directory.                    |
| `path`           | `string`                  | `name`                     | Output subdirectory and route prefix. Use `''` for the site root.                                        |
| `customLLMFiles` | `CustomLLMFile[]`         | top-level `customLLMFiles` | Per-version custom LLM files.                                                                            |
| `includeOrder`   | `string[]`                | top-level `includeOrder`   | Per-version include order.                                                                               |

Any field left unset on a version falls back to the matching top-level plugin option, so you declare shared settings like `customLLMFiles` and `includeOrder` once and override them per version.

The `path` field sets both the output subdirectory under the build directory and the route prefix that the version's links must resolve to. A version with `path: 'stable'` writes its files to `<outDir>/stable/` and its links resolve to `/stable/...` URLs. A version with `path: ''` writes to the site root.

## Explicit versions

List each version with its source directory and output `path`. This config generates `/llms.txt` from the current docs and `/stable/llms.txt` from a versioned snapshot:

```js
plugins: [
  [
    'docusaurus-plugin-llms',
    {
      // Shared defaults inherited by every version:
      customLLMFiles: [/* llms-python.txt, ... */],

      versions: [
        { name: 'nightly', label: 'Nightly', docsDir: 'docs', path: '' },
        { name: 'stable', label: 'v2.0', docsDir: 'versioned_docs/version-2.0', path: 'stable' },
      ],
    },
  ],
];
```

Each version writes `llms.txt` (and any `customLLMFiles`) under `<path>/`, so this example produces `/llms.txt` and `/stable/llms.txt`. The `stable` files link to `/stable/...` URLs, and the root version's links stay at the root.

The array must contain at least one version, every `name` must be unique, and no two versions may resolve to the same `path`. The plugin throws a configuration error at build time if any of these constraints is violated.

## Automatic detection

Set `versions: 'auto'` to derive the version list automatically from Docusaurus docs versioning:

```js
plugins: [
  [
    'docusaurus-plugin-llms',
    {
      customLLMFiles: [/* ... */],
      versions: 'auto',
    },
  ],
];
```

In auto mode the plugin builds the list from two sources:

- The current (unversioned) docs, added as a version named `current`. Its `docsDir` defaults to your top-level `docsDir` (or `'docs'`), and its `path` defaults to the site root.
- Every entry in `versions.json`, each sourced from `versioned_docs/version-<id>/`. The version `name` is the id, its `docsDir` is `versioned_docs/version-<id>`, and its `path` defaults to the id.

When your Docusaurus docs plugin config sets a version's `label` or `path`, the plugin uses those values. Without a configured label, the current docs are labeled `current`, so the root `llms.txt` reads `Version: current`. To change it, set `versions.current.label` in the docs plugin config. This works whether the docs plugin is configured through a preset or listed in `plugins`. If `versions.json` is absent, the plugin generates only the current docs.

## Output layout and version identity

Every version writes its files under `<outDir>/<path>/`. With the explicit example above, the build directory looks like this:

```
build/
├── llms.txt                 # nightly (root) links file
├── llms-full.txt            # nightly full-content file
└── stable/
    ├── llms.txt             # stable links file
    └── llms-full.txt        # stable full-content file
```

Each generated file names its version: the plugin writes a `Version:` line with the version's `label` (or `name`) under the file's description. The `Version:` line and the per-version subdirectory identify which version a file belongs to.

## Add versions to an existing site

To keep your current root output and add a version alongside it, declare the current docs as a version with `path: ''`, then add the other versions:

```js
versions: [
  { name: 'current', docsDir: 'docs',                       path: '' },
  { name: '2.0',     docsDir: 'versioned_docs/version-2.0', path: '2.0' },
],
```

Every version inherits the top-level options it doesn't override. For those options, see [configuration options](./configuration.md).
