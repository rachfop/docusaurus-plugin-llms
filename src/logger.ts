/**
 * Logging utilities for the docusaurus-plugin-llms plugin.
 */

import { AsyncLocalStorage } from 'async_hooks';

/**
 * Logging level enumeration
 */
export enum LogLevel {
  QUIET = 0,
  NORMAL = 1,
  VERBOSE = 2,
}

let currentLogLevel = LogLevel.NORMAL;

/**
 * Level for code running inside `withLogLevel`. Docusaurus runs every plugin's
 * postBuild concurrently, so two plugin instances with different logLevels
 * each need their own level for the whole async run.
 */
const scopedLogLevel = new AsyncLocalStorage<LogLevel>();

function activeLogLevel(): LogLevel {
  return scopedLogLevel.getStore() ?? currentLogLevel;
}

/**
 * Set the logging level for the plugin
 * @param level - The logging level to use
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Run `fn` with `level` as the logging level for every log call it makes,
 * including calls after awaits, without changing the level other code sees.
 */
export function withLogLevel<T>(level: LogLevel, fn: () => T): T {
  return scopedLogLevel.run(level, fn);
}

/**
 * Logger utility for consistent logging across the plugin
 */
export const logger = {
  error: (message: string) => {
    console.error(`[docusaurus-plugin-llms] ERROR: ${message}`);
  },
  warn: (message: string) => {
    if (activeLogLevel() >= LogLevel.NORMAL) {
      console.warn(`[docusaurus-plugin-llms] ${message}`);
    }
  },
  info: (message: string) => {
    if (activeLogLevel() >= LogLevel.NORMAL) {
      console.log(`[docusaurus-plugin-llms] ${message}`);
    }
  },
  verbose: (message: string) => {
    if (activeLogLevel() >= LogLevel.VERBOSE) {
      console.log(`[docusaurus-plugin-llms] ${message}`);
    }
  },
};
