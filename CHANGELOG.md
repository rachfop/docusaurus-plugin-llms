# Changelog

All notable changes to the docusaurus-plugin-llms will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Custom Root Content**: Support for customizable root-level content in generated files
  - New `rootContent` option for customizing the introductory content in `llms.txt`
  - New `fullRootContent` option for customizing the introductory content in `llms-full.txt`
  - Custom root content support for individual custom LLM files
  - Follows llmstxt.org standard allowing markdown sections after title/description
  - Enables project-specific context, technical specifications, and navigation hints

- **Docusaurus Partials Support**: Full support for Docusaurus partial files (MDX files prefixed with underscore)
  - Automatically excludes partial files (e.g., `_shared.mdx`) from being processed as standalone documents
  - Resolves and inlines partial content when imported in other documents
  - Handles both default and named imports: `import Partial from './_partial.mdx'`
  - Replaces JSX usage `<Partial />` with the actual partial content
  - Maintains source markdown approach while supporting partials

### Fixed
- **URL Resolution**: Plugin now uses actual resolved URLs from Docusaurus routes instead of guessing paths
  - Properly handles numbered prefixes in file names (e.g., `1-page.md` → `/docs/page`)
  - Uses Docusaurus's route data from the `postBuild` lifecycle hook
  - Falls back to the original path construction for backward compatibility
  - Adds comprehensive route matching including nested folders with numbered prefixes

### Technical Details
- **Partial Resolution**:
  - Partial files (starting with `_`) are automatically excluded from `readMarkdownFiles`
  - New `resolvePartialImports` function processes import statements and inlines content
  - Supports relative imports and properly resolves file paths
  - Gracefully handles errors with warnings if partials can't be resolved
  
- **Route Resolution**:
  - The plugin now receives route information from Docusaurus via the `postBuild` props
  - Creates a route map from all available routes (including nested routes)
  - Attempts multiple matching strategies to find the correct resolved URL:
    1. Direct route map lookup
    2. Numbered prefix removal at various path levels
    3. Fuzzy matching using `routesPaths` array
    4. Falls back to original path construction if no match found
  - Maintains backward compatibility with older Docusaurus versions or test environments

## [0.1.3] - 2024-05-20

### Added
- Version information support for LLM files
  - Global version setting for all generated files
  - Individual version settings for custom LLM files
  - "Version: X.Y.Z" displayed under description in all generated files
- Version information follows llmstxt.org standards for LLM-friendly documentation

### Benefits
- Provides clear versioning for LLM documentation files
- Helps AI tools and users track which version of documentation they're working with
- Allows content creators to maintain multiple versions of AI-friendly docs

## [0.1.2] - Previous release

Initial release with basic functionality.