#!/usr/bin/env python3
"""
Apply null/undefined handling standardization to TypeScript files.
This script reads files, applies all fixes, and writes them back in one operation.
"""

import re

# Define all the replacements as (file, old_pattern, new_text) tuples
replacements = [
    # processor.ts - Frontmatter validation
    ('src/processor.ts',
     r'if \(data\.title !== undefined && typeof data\.title === \'string\'\) \{',
     'if (data.title !== undefined && data.title !== null && typeof data.title === \'string\') {'),

    ('src/processor.ts',
     r'if \(!data\.title\.trim\(\)\) \{',
     'if (data.title.trim() === \'\') {'),

    ('src/processor.ts',
     r'if \(data\.description !== undefined && typeof data\.description === \'string\'\) \{',
     'if (data.description !== undefined && data.description !== null && typeof data.description === \'string\') {'),

    ('src/processor.ts',
     r'if \(!data\.description\.trim\(\)\) \{',
     'if (data.description.trim() === \'\') {'),

    ('src/processor.ts',
     r'if \(data\.slug !== undefined && typeof data\.slug === \'string\'\) \{',
     'if (data.slug !== undefined && data.slug !== null && typeof data.slug === \'string\') {'),

    ('src/processor.ts',
     r'if \(!data\.slug\.trim\(\)\) \{',
     'if (data.slug.trim() === \'\') {'),

    ('src/processor.ts',
     r'if \(data\.id !== undefined && typeof data\.id === \'string\'\) \{',
     'if (data.id !== undefined && data.id !== null && typeof data.id === \'string\') {'),

    ('src/processor.ts',
     r'if \(!data\.id\.trim\(\)\) \{',
     'if (data.id.trim() === \'\') {'),

    # processor.ts - resolvedUrl checks
    ('src/processor.ts',
     r'  if \(resolvedUrl\) \{\n    // Use the actual resolved URL',
     '  // Pattern: Explicit null/undefined check for optional parameters\n  if (resolvedUrl !== undefined && resolvedUrl !== null) {\n    // Use the actual resolved URL'),

    # processor.ts - pathPrefix check
    ('src/processor.ts',
     r'if \(pathPrefix && pathTransformation\?\.ignorePaths\?\.includes\(pathPrefix\)\) \{',
     '// Pattern: Optional chaining with explicit checks\n    if (pathPrefix !== undefined && pathPrefix !== null && pathPrefix !== \'\' &&\n        pathTransformation?.ignorePaths?.includes(pathPrefix)) {'),

    # processor.ts - description checks
    ('src/processor.ts',
     r'  // First priority: Use frontmatter description if available\n  if \(data\.description\) \{',
     '  // First priority: Use frontmatter description if available\n  // Pattern: Explicit check for non-empty string\n  if (data.description !== undefined && data.description !== null &&\n      typeof data.description === \'string\' && data.description.trim() !== \'\') {'),

    ('src/processor.ts',
     r'  // Only remove heading markers at the beginning of descriptions or lines\n  // This preserves # characters that are part of the content\n  if \(description\) \{',
     '  // Only remove heading markers at the beginning of descriptions or lines\n  // This preserves # characters that are part of the content\n  // Pattern: Explicit non-empty string check\n  if (description !== undefined && description !== null && description !== \'\') {'),

    # processor.ts - includeUnmatched check
    ('src/processor.ts',
     r'    // Add remaining files if includeUnmatched is true\n    if \(includeUnmatched\) \{',
     '    // Add remaining files if includeUnmatched is true\n    // Pattern: Explicit boolean check (distinguishes false from undefined)\n    if (includeUnmatched === true) {'),

    # processor.ts - routeMap check
    ('src/processor.ts',
     r'        // Try to find the resolved URL for this file from the route map\n        let resolvedUrl: string \| undefined;\n        if \(context\.routeMap\) \{',
     '        // Try to find the resolved URL for this file from the route map\n        let resolvedUrl: string | undefined;\n        // Pattern: Explicit null/undefined check for optional property\n        if (context.routeMap !== undefined && context.routeMap !== null) {'),

    # processor.ts - resolvedUrl checks in route matching
    ('src/processor.ts',
     r'          // ONLY if exact match fails, try numbered prefix removal as fallback\n          if \(!resolvedUrl\) \{',
     '          // ONLY if exact match fails, try numbered prefix removal as fallback\n          // Pattern: Explicit undefined check\n          if (resolvedUrl === undefined) {'),

    ('src/processor.ts',
     r'            // Also handle nested folder structures with numbered prefixes\n            if \(!resolvedUrl\) \{',
     '            // Also handle nested folder structures with numbered prefixes\n            // Pattern: Explicit undefined check\n            if (resolvedUrl === undefined) {'),

    ('src/processor.ts',
     r'                  if \(resolvedUrl\) break;',
     'if (resolvedUrl !== undefined) break;'),

    ('src/processor.ts',
     r'            // If still not found, try to find the best match using the routesPaths array\n            if \(!resolvedUrl && context\.routesPaths\) \{',
     '            // If still not found, try to find the best match using the routesPaths array\n            // Pattern: Explicit undefined check with optional property check\n            if (resolvedUrl === undefined &&\n                context.routesPaths !== undefined && context.routesPaths !== null) {'),

    ('src/processor.ts',
     r'              if \(matchingRoute\) \{',
     '// Pattern: Explicit undefined/null check\n              if (matchingRoute !== undefined && matchingRoute !== null) {'),

    ('src/processor.ts',
     r'          // Log when we successfully resolve a URL using Docusaurus routes\n          if \(resolvedUrl && resolvedUrl !==',
     '          // Log when we successfully resolve a URL using Docusaurus routes\n          // Pattern: Explicit check for defined and different value\n          if (resolvedUrl !== undefined && resolvedUrl !== null &&\n              resolvedUrl !=='),
]

def apply_replacements(file_path, patterns):
    """Apply all patterns for a given file."""
    print(f"Processing {file_path}...")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        changes_made = 0

        for pattern, replacement in patterns:
            new_content = re.sub(pattern, replacement, content, count=1)
            if new_content != content:
                changes_made += 1
                content = new_content

        if changes_made > 0:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  ✓ Applied {changes_made} changes to {file_path}")
        else:
            print(f"  - No changes needed for {file_path}")

    except Exception as e:
        print(f"  ✗ Error processing {file_path}: {e}")

# Group replacements by file
files_to_process = {}
for file_path, old_pattern, new_text in replacements:
    if file_path not in files_to_process:
        files_to_process[file_path] = []
    files_to_process[file_path].append((old_pattern, new_text))

# Apply all replacements
for file_path, patterns in files_to_process.items():
    apply_replacements(file_path, patterns)

print("\n✓ All null/undefined handling fixes applied!")
print("Running build to verify...")

import subprocess
result = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True)
if result.returncode == 0:
    print("✓ Build successful!")
else:
    print("✗ Build failed:")
    print(result.stderr)
