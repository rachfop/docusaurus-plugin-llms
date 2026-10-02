# Testing the docusaurus-plugin-llms

This document provides guidance on how to test the Docusaurus plugin.

## Running All Tests

The quickest way to run the full test suite (build + unit + integration):

```bash
npm test
```

## Unit Testing

### Path Transformation

1. `tests/test-path-transforms.js` - Unit tests for the path transformation function
2. `tests/test-path-transformation.js` - Integration tests that simulate a Docusaurus build

To test just the path transformation logic:

```bash
node tests/test-path-transforms.js
```

This will run a series of test cases against the path transformation function and verify the results.

### Running Integration Tests

To run the integration tests that simulate a Docusaurus build:

```bash
# Build the plugin first
npm run build

# Then run the tests
node tests/test-path-transformation.js
```

This creates a test directory structure, runs the plugin with various configurations, and outputs the results for verification.

### Route Resolution

The plugin resolves file paths to URLs using suffix-based matching against Docusaurus's `routesPaths`. The following test files cover this behavior:

1. `tests/test-route-resolution-helpers.js` - Integration tests through `processFilesWithPatterns`, including regression tests for issues #30 (trailing slash) and #31 (doubled `docs/docs/` paths)
2. `tests/test-refactored-route-helpers.js` - Unit tests for suffix matching, directory collapsing, and numbered prefix removal
3. `tests/test-numbered-prefixes.js` - Focused tests for numbered prefix scenarios

These are standalone test files not included in `npm run test:unit`. Run them directly:

```bash
node tests/test-route-resolution-helpers.js
node tests/test-refactored-route-helpers.js
node tests/test-numbered-prefixes.js
```

## Testing in a Real Docusaurus Project

To test the plugin in a real Docusaurus project:

1. **Create a new Docusaurus site**:

   ```bash
   npx @docusaurus/init@latest init my-test-site classic
   cd my-test-site
   ```

2. **Link your plugin for local development**:

   From your plugin directory:

   ```bash
   npm link
   ```

   From your Docusaurus project:

   ```bash
   npm link docusaurus-plugin-llms
   ```

3. **Add the plugin to your docusaurus.config.js**:

   ```js
   module.exports = {
     // ... other config
     plugins: [
       [
         'docusaurus-plugin-llms',
         {
           // Test your path transformation options
           pathTransformation: {
             ignorePaths: ['api'],
             addPaths: ['reference'],
           },
         },
       ],
     ],
   };
   ```

4. **Build the Docusaurus site**:

   ```bash
   npm run build
   ```

5. **Check the output**:

   After building, check the `build` directory for the generated `llms.txt` and `llms-full.txt` files. Verify that the URLs are transformed according to your configuration.

## Verifying URL Transformations

> **Note:** Path transformations are now only applied as a fallback when a file cannot be matched to a known Docusaurus route. In most configurations, URLs are resolved automatically via suffix-based route matching.

When testing path transformations, verify that:

1. **ignorePaths**: Path segments specified are removed from the URLs
2. **addPaths**: Path segments are added to the URLs when they don't already exist
3. **Combined transformations**: Both operations work correctly together

Example paths to test:

- `docs/getting-started.md` → should become → `getting-started` (with ignorePaths: ['docs'])
- `docs/api/method.md` → should become → `reference/api/method` (with ignorePaths: ['docs'], addPaths: ['reference'])

## Troubleshooting

If you encounter issues with path transformations:

1. Check the regex in the `applyPathTransformations` function
2. Verify that the path segments are properly formatted (no leading/trailing slashes)
3. Run the unit tests to isolate potential issues
