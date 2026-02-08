/**
 * NULL AND UNDEFINED HANDLING GUIDE
 *
 * This file documents the standardized patterns for null/undefined handling
 * across the docusaurus-plugin-llms codebase.
 *
 * PRINCIPLES:
 * 1. Be explicit about null/undefined checks - avoid loose truthy checks
 * 2. Use optional chaining for safe property access on optional values
 * 3. Validate required parameters early with explicit checks
 * 4. Distinguish between "missing" (undefined/null) and "falsy" (0, '', false)
 *
 * PATTERNS:
 */

// ============================================================================
// PATTERN 1: Checking for null OR undefined (most common)
// ============================================================================

/**
 * Use when you need to check if a value exists (not null and not undefined).
 * This is the most common check for optional parameters or properties.
 */
function checkIfDefined_GOOD(value: string | undefined | null): void {
  if (value !== undefined && value !== null) {
    // Value is defined and not null
    console.log(value.toUpperCase());
  }
}

/**
 * AVOID: Loose truthy check - this catches 0, '', false, NaN
 */
function checkIfDefined_BAD(value: string | undefined | null): void {
  if (value) {
    // PROBLEM: This rejects empty strings, 0, false, etc.
    console.log(value.toUpperCase());
  }
}

// ============================================================================
// PATTERN 2: Optional chaining for safe property access
// ============================================================================

/**
 * Use optional chaining when accessing properties on values that might be
 * null or undefined. This avoids TypeError exceptions.
 */
function safePropertyAccess_GOOD(obj: { prop?: string } | undefined): void {
  const value = obj?.prop;
  if (value !== undefined && value !== null) {
    console.log(value);
  }
}

/**
 * AVOID: Manual null checks before property access (verbose)
 */
function safePropertyAccess_BAD(obj: { prop?: string } | undefined): void {
  if (obj && obj.prop) {
    // Verbose and misses the case where prop is explicitly false/0
    console.log(obj.prop);
  }
}

// ============================================================================
// PATTERN 3: Type-specific validation with explicit null checks
// ============================================================================

/**
 * Use when validating optional parameters that must be a specific type if provided.
 * Check both that the value is defined AND that it has the correct type.
 */
function validateOptionalString_GOOD(value: unknown): void {
  if (value !== undefined && value !== null) {
    if (typeof value !== 'string') {
      throw new Error('Value must be a string if provided');
    }
    // Now we know value is a string
    console.log(value.trim());
  }
}

/**
 * Can be combined into a single check when appropriate
 */
function validateOptionalString_GOOD_COMPACT(value: unknown): void {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error('Value must be a string if provided');
  }
}

// ============================================================================
// PATTERN 4: Non-empty string validation
// ============================================================================

/**
 * Use when you need a string that is not only defined but also not empty.
 * This is common for required fields that have been parsed from user input.
 */
function validateNonEmptyString_GOOD(value: string | undefined | null): void {
  if (typeof value === 'string' && value.trim() !== '') {
    // Value is a non-empty string
    console.log(value);
  } else {
    throw new Error('Value must be a non-empty string');
  }
}

/**
 * AVOID: Loose check that doesn't validate the type
 */
function validateNonEmptyString_BAD(value: string | undefined | null): void {
  if (value && value.trim()) {
    // PROBLEM: Assumes value has .trim() method
    console.log(value);
  }
}

// ============================================================================
// PATTERN 5: Array validation
// ============================================================================

/**
 * Use explicit checks for arrays, checking both existence and array type.
 */
function validateOptionalArray_GOOD(value: unknown): void {
  if (value !== undefined && value !== null) {
    if (!Array.isArray(value)) {
      throw new Error('Value must be an array if provided');
    }
    // Now we know value is an array
    console.log(value.length);
  }
}

/**
 * Check for non-empty arrays using optional chaining and length check
 */
function checkNonEmptyArray_GOOD(value: string[] | undefined): void {
  if (value?.length) {
    // Array exists and has at least one element
    console.log(value[0]);
  }
}

/**
 * AVOID: Loose truthy check on arrays - empty arrays are truthy!
 */
function checkNonEmptyArray_BAD(value: string[] | undefined): void {
  if (value && value.length > 0) {
    // Works but is verbose compared to optional chaining
    console.log(value[0]);
  }
}

// ============================================================================
// PATTERN 6: Object validation
// ============================================================================

/**
 * Use explicit null check for objects since typeof null === 'object'
 */
function validateOptionalObject_GOOD(value: unknown): void {
  if (value !== undefined && value !== null) {
    if (typeof value !== 'object') {
      throw new Error('Value must be an object if provided');
    }
    // Now we know value is an object (not null)
  }
}

/**
 * CRITICAL: Always check for null when using typeof to validate objects
 */
function validateOptionalObject_BAD(value: unknown): void {
  if (value !== undefined) {
    if (typeof value !== 'object') {
      // PROBLEM: typeof null === 'object', so null passes this check!
      throw new Error('Value must be an object if provided');
    }
  }
}

// ============================================================================
// PATTERN 7: Boolean validation
// ============================================================================

/**
 * Use explicit type check for booleans, not truthiness.
 * This distinguishes between missing (undefined) and false.
 */
function validateOptionalBoolean_GOOD(value: unknown): void {
  if (value !== undefined && value !== null && typeof value !== 'boolean') {
    throw new Error('Value must be a boolean if provided');
  }
  // Can safely use value as boolean | undefined | null
}

/**
 * When you need to treat undefined as a specific boolean value
 */
function withDefaultBoolean_GOOD(value: boolean | undefined): boolean {
  // Explicit: undefined becomes true, false stays false
  return value !== false;
}

/**
 * AVOID: Coercing to boolean implicitly
 */
function withDefaultBoolean_BAD(value: boolean | undefined): boolean {
  // PROBLEM: value = 0 or '' would also become false
  return !!value;
}

// ============================================================================
// PATTERN 8: Default values with nullish coalescing
// ============================================================================

/**
 * Use nullish coalescing (??) for default values.
 * This only replaces null/undefined, not other falsy values.
 */
function withDefault_GOOD(value: string | undefined | null): string {
  return value ?? 'default';
}

/**
 * AVOID: Logical OR for defaults - it replaces ALL falsy values
 */
function withDefault_BAD(value: string | undefined | null): string {
  // PROBLEM: value = '' or 0 would also use the default
  return value || 'default';
}

// ============================================================================
// PATTERN 9: Early validation for required parameters
// ============================================================================

/**
 * Validate required parameters at function entry with explicit checks.
 */
function requireParameter_GOOD(value: string | undefined | null): void {
  if (value === undefined || value === null) {
    throw new Error('Parameter is required');
  }
  // Now TypeScript knows value is string
  console.log(value.toUpperCase());
}

/**
 * AVOID: Loose validation that doesn't distinguish null/undefined from falsy
 */
function requireParameter_BAD(value: string | undefined | null): void {
  if (!value) {
    // PROBLEM: Also throws for empty string, 0, false
    throw new Error('Parameter is required');
  }
  console.log(value.toUpperCase());
}

// ============================================================================
// PATTERN 10: Converting truthy checks to explicit checks
// ============================================================================

/**
 * When checking if a value should be used (but preserving falsy values)
 */
function explicitCheck_GOOD(value: string | number | boolean | undefined | null): void {
  if (value !== undefined && value !== null) {
    // Now can use value = 0, '', false safely
    console.log(value);
  }
}

/**
 * AVOID: Truthy check when falsy values are valid
 */
function explicitCheck_BAD(value: string | number | boolean | undefined | null): void {
  if (value) {
    // PROBLEM: Rejects value = 0, '', false
    console.log(value);
  }
}

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * QUICK REFERENCE:
 *
 * 1. Optional parameter check:
 *    if (value !== undefined && value !== null) { ... }
 *
 * 2. Safe property access:
 *    const prop = obj?.property
 *
 * 3. Type validation with null check:
 *    if (typeof value !== 'object' || value === null) { throw ... }
 *
 * 4. Non-empty string:
 *    if (typeof value === 'string' && value.trim() !== '') { ... }
 *
 * 5. Non-empty array:
 *    if (value?.length) { ... }
 *
 * 6. Default values:
 *    const result = value ?? defaultValue
 *
 * 7. Boolean with default:
 *    const enabled = value !== false  // undefined and null become true
 *
 * 8. Required parameter:
 *    if (value === undefined || value === null) { throw ... }
 *
 * AVOID:
 * - if (value) { ... }  // Too loose, catches falsy values
 * - value || defaultValue  // Replaces ALL falsy values, not just null/undefined
 * - !value  // Too loose for validation
 */
