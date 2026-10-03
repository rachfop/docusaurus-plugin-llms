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
| `routePrefix`    | `string`                  | `path`                     | Route prefix the version's links resolve under. Use `''` when the sections' `routeBasePath` holds it.    |
| `customLLMFiles` | `CustomLLMFile[]`         | top-level `customLLMFiles` | Per-version custom LLM files.                                                                            |
| `includeOrder`   | `string[]`                | top-level `includeOrder`   | Per-version include order.                                                                               |

Any field left unset on a version falls back to the matching top-level plugin option, so you declare shared settings like `customLLMFiles` and `includeOrder` once and override them per version.

The `path` field sets both the output subdirectory under the build directory and the route prefix that the version's links must resolve to. A version with `path: 'stable'` writes its files to `<outDir>/stable/` and its links resolve to `/stable/...` URLs. A version with `path: ''` writes to the site root. Set `routePrefix` when the route prefix differs from the output subdirectory; see [versions inside the route base path](#versions-inside-the-route-base-path).

Each version's `docsDir`, `customLLMFiles`, and `includeOrder` get the same checks as the top-level options, and an invalid value throws a configuration error when the plugin loads. If one version fails while its files are generated, the plugin logs an error naming that version and generates the remaining versions.

With `includeBlog: true`, blog posts appear in the files of the version written at the site root, or of the first version when no version writes to the root.

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

### Versions inside the route base path

Docusaurus serves a docs version at `/<routeBasePath>/<versionPath>/`, so a default site serves its last version at `/docs/...` and the current docs at `/docs/next/...`. To describe that layout explicitly, give each version a section whose `routeBasePath` includes the version segment, and set `routePrefix: ''`:

```js
versions: [
  {
    name: '1.0',
    docsDir: [{ path: 'versioned_docs/version-1.0', routeBasePath: 'docs' }],
    path: '',
  },
  {
    name: 'current',
    docsDir: [{ path: 'docs', routeBasePath: 'docs/next' }],
    path: 'next',
    routePrefix: '',
  },
],
```

This writes `/llms.txt` with links to `/docs/...` pages and `/next/llms.txt` with links to `/docs/next/...` pages. [Automatic detection](#automatic-detection) produces the same layout from the Docusaurus config.

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

Auto mode reads the docs plugin options (from the preset's `docs` options or a `@docusaurus/plugin-content-docs` entry in `plugins`) and builds the versions the way Docusaurus does:

- The versions are the current docs plus every entry in `versions.json`. The current docs are named `current` and read from the docs plugin's `path` (or your top-level `docsDir`); a versioned entry `<id>` reads from `versioned_docs/version-<id>/`.
- `includeCurrentVersion: false` leaves out the current docs, `onlyIncludeVersions` keeps only the listed versions, and `disableVersioning: true` keeps only the current docs.
- The last version is `lastVersion` when set, otherwise the first included entry in `versions.json`, otherwise `current`.
- Each version's path is its `versions.<name>.path` when set. Otherwise the last version's path is `''`, the current docs' path is `'next'`, and any other version's path is its name.

A version with path `<versionPath>` links to pages under `/<routeBasePath>/<versionPath>/` and writes its files to `<outDir>/<versionPath>/`. The last version has an empty path by default, so its files are the root `llms.txt` and `llms-full.txt`. On a default site with `versions.json` set to `["1.0"]`, the build directory looks like this:

```
build/
├── llms.txt                 # 1.0, links to /docs/...
├── llms-full.txt
└── next/
    ├── llms.txt             # current, links to /docs/next/...
    └── llms-full.txt
```

Each version's label follows Docusaurus: its `versions.<name>.label` from the docs plugin config when set, otherwise `Next` for the current docs and the version name for any other version. If `versions.json` is absent, the plugin generates only the current docs.

## Output layout and version identity

Every version writes its files under `<outDir>/<path>/`. With the [explicit example](#explicit-versions), the build directory looks like this:

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
