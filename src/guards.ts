/**
 * Type guards, error helpers, and argument validators for the plugin.
 */

/**
 * Type guard to check if a value is defined (not null or undefined)
 * @param value - Value to check
 * @returns True if value is not null or undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if a value is a non-empty string
 * @param value - Value to check
 * @returns True if value is a string with at least one non-whitespace character
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Coerce a finite numeric frontmatter value to its string form, mirroring how
 * Docusaurus (Joi `convert`) treats numeric `slug`/`id`/`title`. YAML parses an
 * unquoted `slug: 2025` as the number 2025, which would otherwise fail the
 * string guards and lose the numeric route.
 * @param value - Raw frontmatter value
 * @returns The value as a string when it is a finite number, otherwise unchanged
 */
export function coerceFrontMatterString(value: unknown): unknown {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : value;
}

/**
 * Type guard to check if a value is a non-empty array
 * @param value - Value to check
 * @returns True if value is an array with at least one element
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Safely extract an error message from an unknown error value
 * @param error - The error value (can be Error, string, or any other type)
 * @returns A string representation of the error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    const stringified = JSON.stringify(error);
    // JSON.stringify returns undefined for undefined values, handle that case
    return stringified !== undefined ? stringified : 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

/**
 * Extract stack trace from unknown error types
 * @param error - The error value (can be Error or any other type)
 * @returns Stack trace if available, undefined otherwise
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates that a value is not null or undefined
 * @param value - The value to validate
 * @param paramName - The parameter name for error messages
 * @returns The validated value
 * @throws ValidationError if the value is null or undefined
 */
export function validateRequired<T>(
  value: T | null | undefined,
  paramName: string
): T {
  if (value === null || value === undefined) {
    throw new ValidationError(`Required parameter '${paramName}' is null or undefined`);
  }
  return value;
}

/**
 * Validates that a value is a string and optionally checks its properties
 * @param value - The value to validate
 * @param paramName - The parameter name for error messages
 * @param options - Validation options for min/max length and pattern
 * @returns The validated string
 * @throws ValidationError if validation fails
 */
export function validateString(
  value: unknown,
  paramName: string,
  options: { minLength?: number; maxLength?: number; pattern?: RegExp } = {}
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`Parameter '${paramName}' must be a string, got ${typeof value}`);
  }

  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new ValidationError(`Parameter '${paramName}' must be at least ${options.minLength} characters`);
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new ValidationError(`Parameter '${paramName}' exceeds maximum length of ${options.maxLength}`);
  }

  if (options.pattern && !options.pattern.test(value)) {
    throw new ValidationError(`Parameter '${paramName}' does not match required pattern`);
  }

  return value;
}

/**
 * Validates that a value is an array and optionally validates elements
 * @param value - The value to validate
 * @param paramName - The parameter name for error messages
 * @param elementValidator - Optional function to validate each element
 * @returns The validated array
 * @throws ValidationError if validation fails
 */
export function validateArray<T>(
  value: unknown,
  paramName: string,
  elementValidator?: (item: unknown) => boolean
): T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`Parameter '${paramName}' must be an array`);
  }

  if (elementValidator) {
    value.forEach((item, index) => {
      if (!elementValidator(item)) {
        throw new ValidationError(`Element at index ${index} in '${paramName}' failed validation`);
      }
    });
  }

  return value as T[];
}
