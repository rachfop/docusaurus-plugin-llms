# Null/Undefined Handling Standardization

This document details the standardization of null/undefined handling patterns across the docusaurus-plugin-llms codebase.

## Problem

The codebase has inconsistent null/undefined handling:
- Mix of `if (value)`, `if (value !== null)`, `if (value !== undefined)`
- Loose truthy checks that catch falsy values (0, '', false)
- Inconsistent use of optional chaining
- Type validation that doesn't account for `typeof null === 'object'`

## Solution

Establish and apply consistent patterns across all source files.

## Patterns

### 1. Checking for null OR undefined
```typescript
// GOOD: Explicit check
if (value !== undefined && value !== null) {
  // Value is defined
}

// BAD: Loose truthy check
if (value) {
  // Rejects 0, '', false, NaN
}
```

### 2. Optional chaining for safe property access
```typescript
// GOOD: Optional chaining
const prop = obj?.property;
if (prop !== undefined && prop !== null) {
  use(prop);
}

// BAD: Manual checks
if (obj && obj.property) {
  use(obj.property);
}
```

### 3. Type validation with explicit null checks
```typescript
// GOOD: Explicit null check for objects
if (value !== undefined && value !== null) {
  if (typeof value !== 'object') {
    throw new Error('Must be object');
  }
}

// BAD: Missing null check
if (value !== undefined) {
  if (typeof value !== 'object') {
    // PROBLEM: typeof null === 'object'
  }
}
```

### 4. Non-empty string validation
```typescript
// GOOD: Explicit check
if (typeof value === 'string' && value.trim() !== '') {
  use(value);
}

// BAD: Loose check
if (value && value.trim()) {
  // Assumes value has .trim() method
}
```

### 5. Boolean checks
```typescript
// GOOD: Explicit boolean check
if (value === true) {
  // Only when explicitly true
}

// or

if (value !== false) {
  // When not explicitly false (includes undefined/null)
}

// BAD: Truthy check for booleans
if (value) {
  // Confusing for booleans
}
```

### 6. Default values with nullish coalescing
```typescript
// GOOD: Nullish coalescing
const result = value ?? defaultValue;

// BAD: Logical OR
const result = value || defaultValue;
// Replaces 0, '', false too
```

## Files Requiring Changes

### src/processor.ts

#### Lines 52-74: Frontmatter validation
**Current:**
```typescript
if (data.title !== undefined && typeof data.title === 'string') {
  if (!data.title.trim()) {
```

**Should be:**
```typescript
// Pattern: Type-specific validation with explicit null checks
if (data.title !== undefined && data.title !== null && typeof data.title === 'string') {
  if (data.title.trim() === '') {
```

**Rationale:** Explicitly check for null and use explicit empty string comparison.

#### Line 86: resolvedUrl check
**Current:**
```typescript
if (resolvedUrl) {
```

**Should be:**
```typescript
// Pattern: Explicit null/undefined check for optional parameters
if (resolvedUrl !== undefined && resolvedUrl !== null) {
```

**Rationale:** Explicit check prevents issues if resolvedUrl is empty string (valid URL).

#### Line 121: pathPrefix check
**Current:**
```typescript
if (pathPrefix && pathTransformation?.ignorePaths?.includes(pathPrefix)) {
```

**Should be:**
```typescript
// Pattern: Optional chaining with explicit checks
if (pathPrefix !== undefined && pathPrefix !== null && pathPrefix !== '' &&
    pathTransformation?.ignorePaths?.includes(pathPrefix)) {
```

**Rationale:** Be explicit about what we're checking (not just truthy).

#### Line 170: data.description check
**Current:**
```typescript
if (data.description) {
```

**Should be:**
```typescript
// Pattern: Explicit check for non-empty string
if (data.description !== undefined && data.description !== null &&
    typeof data.description === 'string' && data.description.trim() !== '') {
```

**Rationale:** Validate type and ensure non-empty string.

#### Line 195: description check
**Current:**
```typescript
if (description) {
```

**Should be:**
```typescript
// Pattern: Explicit non-empty string check
if (description !== undefined && description !== null && description !== '') {
```

**Rationale:** Explicit check for non-empty string.

#### Line 330: includeUnmatched check
**Current:**
```typescript
if (includeUnmatched) {
```

**Should be:**
```typescript
// Pattern: Explicit boolean check (distinguishes false from undefined)
if (includeUnmatched === true) {
```

**Rationale:** Make it clear we want explicitly true, not just truthy.

#### Line 350: context.routeMap check
**Current:**
```typescript
if (context.routeMap) {
```

**Should be:**
```typescript
// Pattern: Explicit null/undefined check for optional property
if (context.routeMap !== undefined && context.routeMap !== null) {
```

**Rationale:** Explicit check for optional property existence.

#### Lines 371, 390, 407, 413, 421, 428: resolvedUrl checks
**Current:**
```typescript
if (!resolvedUrl) {
if (resolvedUrl) break;
if (matchingRoute) {
```

**Should be:**
```typescript
// Pattern: Explicit undefined check
if (resolvedUrl === undefined) {
if (resolvedUrl !== undefined) break;
// Pattern: Explicit undefined/null check
if (matchingRoute !== undefined && matchingRoute !== null) {
```

**Rationale:** Be explicit about checking for undefined vs falsy.

### src/generator.ts

#### Line 69: includeFullContent check
**Current:**
```typescript
if (includeFullContent) {
```

**Should be:**
```typescript
// Pattern: Explicit boolean check
if (includeFullContent === true) {
```

#### Line 91: folderName check
**Current:**
```typescript
if (folderName) {
```

**Should be:**
```typescript
// Pattern: Explicit non-empty string check
if (folderName !== undefined && folderName !== null && folderName !== '') {
```

#### Lines 196, 212: slug and id checks
**Current:**
```typescript
if (slug) { // Only process if slug is not empty after trimming
if (id) { // Only process if id is not empty after trimming
```

**Should be:**
```typescript
// Pattern: Explicit non-empty string check (already trimmed above)
if (slug !== undefined && slug !== null && slug !== '') {
if (id !== undefined && id !== null && id !== '') {
```

#### Lines 374, 387, 401, 455, 516: Feature flag checks
**Current:**
```typescript
if (generateMarkdownFiles) {
if (generateLLMsTxt) {
if (generateLLMsFullTxt) {
if (includeBlog) {
```

**Should be:**
```typescript
// Pattern: Explicit boolean check
if (generateMarkdownFiles === true) {
if (generateLLMsTxt === true) {
if (generateLLMsFullTxt === true) {
if (includeBlog === true) {
```

### src/utils.ts

#### Line 200, 210: warnOnIgnoredFiles checks
**Current:**
```typescript
if (warnOnIgnoredFiles) {
```

**Should be:**
```typescript
// Pattern: Explicit boolean check
if (warnOnIgnoredFiles === true) {
```

#### Line 234, 408: headingMatch checks
**Current:**
```typescript
if (headingMatch) {
```

**Should be:**
```typescript
// Pattern: Explicit null check for regex match result
if (headingMatch !== null) {
```

#### Line 380, 397: Feature flag checks
**Current:**
```typescript
if (excludeImports) {
if (removeDuplicateHeadings) {
```

**Should be:**
```typescript
// Pattern: Explicit boolean check
if (excludeImports === true) {
if (removeDuplicateHeadings === true) {
```

#### Line 468, 486: Array length checks
**Current:**
```typescript
if (pathTransformation.ignorePaths?.length) {
if (pathTransformation.addPaths?.length) {
```

**Should be:**
```typescript
// Pattern: Optional chaining with explicit length check
if (pathTransformation.ignorePaths?.length && pathTransformation.ignorePaths.length > 0) {
if (pathTransformation.addPaths?.length && pathTransformation.addPaths.length > 0) {
```

### src/index.ts

#### Line 302: props?.routes check
**Current:**
```typescript
if (props?.routes) {
```

**Should be:**
```typescript
// Pattern: Optional chaining with explicit array check
if (props?.routes !== undefined && props.routes !== null) {
```

## Benefits

1. **Correctness**: No more accidentally rejecting valid falsy values (0, '', false)
2. **Type Safety**: Explicit checks work better with TypeScript's type narrowing
3. **Clarity**: Code intention is clear - checking for missing vs checking for falsy
4. **Consistency**: Same patterns used throughout the codebase
5. **Maintainability**: Future developers understand the checking patterns

## Implementation Notes

- Add comments marking each pattern type to help developers learn the patterns
- Reference the `null-handling-guide.ts` file for detailed examples
- Apply fixes incrementally by file to verify each change
- Run tests after each file to ensure no regressions

## Testing

After applying fixes:
1. Run `npm run build` to check TypeScript compilation
2. Run full test suite
3. Manually test edge cases (empty strings, 0, false, null, undefined)
4. Verify documentation generation with various configurations

## Related Files

- `src/null-handling-guide.ts` - Comprehensive guide with examples
- `NULL_HANDLING_REFACTOR.md` - This file, implementation plan
