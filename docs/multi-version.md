# Multi-version output

If your site keeps more than one documentation version live at once, you can publish a separate set of LLM files for each one. The `versions` option runs the plugin's full generation pipeline once per version, writing each version's `llms.txt` (and any custom LLM files) under its own subdirectory with links scoped to that version's routes.

Omitting `versions` preserves the default single-root behavior, so this is a purely additive, opt-in feature.

## When to use it

Reach for `versions` when the same site serves multiple doc versions from different route prefixes. A common setup keeps a `nightly` build at the site root and a `stable` build under `/stable`. Each version gets its own `llms.txt` at `/llms.txt` and `/stable/llms.txt`, and the links inside each file resolve to that version's URLs. The root version's links never leak into a versioned subtree, and a versioned file's links never point back at the root.

Don't confuse `versions` with the top-level `version` option. `version` only stamps a `Version:` label into the body of the generated files; it doesn't produce more than one set of files. See [custom LLM files](./content-generation.md) for the `version` label and per-file overrides.

## The `versions` option

The `versions` option accepts either an explicit array of version objects or the string `'auto'`. Its type is `VersionConfig[] | 'auto'`, and it defaults to `undefined`.

Each version object in the array has the following shape:

| Field            | Type              | Default              | Description                                                   |
|------------------|-------------------|----------------------|---------------------------------------------------------------|
| `name`           | `string` (required) | —                  | Version identifier (e.g. `'nightly'`, `'stable'`, `'0.0.1'`). Must be unique across the array. |
| `label`          | `string`          | `name`               | Human-readable label written into the `Version:` line of the generated files. |
| `docsDir`        | `string \| DocsSection[]` | top-level `docsDir` | Source docs directory (or sections) for this version, relative to the site directory. |
| `path`           | `string`          | `name`               | Output subdirectory and route prefix. Use `''` for the site root. |
| `customLLMFiles` | `CustomLLMFile[]` | top-level `customLLMFiles` | Per-version custom LLM files. |
| `includeOrder`   | `string[]`        | top-level `includeOrder` | Per-version include order. |

Any field left unset on a version falls back to the matching top-level plugin option. That's why shared settings like `customLLMFiles` and `includeOrder` only need to be declared once unless a version overrides them.

The `path` field does double duty: it's both the output subdirectory under the build directory and the route prefix that the version's links must resolve to. A version with `path: 'stable'` writes its files to `<outDir>/stable/` and its links resolve to `/stable/...` URLs. A version with `path: ''` writes to the site root.

## Explicit versions

List each version with its source directory and output `path`. The following config generates `/llms.txt` from the current docs and `/stable/llms.txt` from a versioned snapshot:

```js
plugins: [
  [
    'docusaurus-plugin-llms',
    {
      // Shared defaults inherited by every version:
      customLLMFiles: [ /* llms-python.txt, ... */ ],

      versions: [
        { name: 'nightly', label: 'Nightly', docsDir: 'docs',                     path: '' },
        { name: 'stable',  label: 'v26.4',   docsDir: 'versioned_docs/version-1', path: 'stable' },
      ],
    },
  ],
];
```

Each version writes `llms.txt` (and any `customLLMFiles`) under `<path>/`, so this example produces `/llms.txt` and `/stable/llms.txt`. The `stable` files link to `/stable/...` URLs, and the root version's links stay at the root.

The array must contain at least one version, every `name` must be unique, and no two versions may resolve to the same `path`. The plugin throws a configuration error at build time if any of these constraints is violated.

## Automatic detection

Set `versions: 'auto'` to derive the version list from Docusaurus docs versioning instead of writing it out by hand:

```js
plugins: [
  [
    'docusaurus-plugin-llms',
    {
      customLLMFiles: [ /* ... */ ],
      versions: 'auto',
    },
  ],
];
```

In auto mode the plugin builds the list from two sources:

- The current (unversioned) docs, added as a version named `current`. Its `docsDir` defaults to your top-level `docsDir` (or `'docs'`), and its `path` defaults to the site root.
- Every entry in `versions.json`, each sourced from `versioned_docs/version-<id>/`. The version `name` is the id, its `docsDir` is `versioned_docs/version-<id>`, and its `path` defaults to the id.

When a version's `label` or `path` is set in your Docusaurus docs plugin config (whether the docs plugin is configured through a preset or listed directly in `plugins`), the plugin reads those values and uses them. Detection is best effort: if `versions.json` is absent, only the current docs are generated.

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

Each generated file carries its version identity in its body: when a version's `label` (or `name`) is set, the plugin writes a `Version:` line under the file's description, following the [llmstxt.org](https://llmstxt.org/) convention. That line plus the per-version subdirectory are how you tell one version's output apart from another's.

## Migrating from single-version

If you don't set `versions`, nothing changes. The plugin generates one set of files at the site root exactly as before, using your top-level `docsDir`, `customLLMFiles`, and `includeOrder`. Adopting `versions` is a one-way addition: move your existing docs into a version with `path: ''` to keep the root output, then add further versions alongside it. For the base options that every version inherits, see [configuration options](./configuration.md).
