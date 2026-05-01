/**
 * Shared utilities
 */
import { randomUUID } from 'crypto';

/**
 * Generate a unique ID (UUID v4)
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Get current timestamp as Date
 */
export function now(): Date {
  return new Date();
}

/**
 * Get current timestamp in milliseconds
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate the start of the time window for a given date
 */
export function getWindowStart(
  date: Date,
  window: 'minute' | 'hour' | 'day' | 'week' | 'month',
): Date {
  const d = new Date(date);
  switch (window) {
    case 'minute':
      d.setSeconds(0, 0);
      break;
    case 'hour':
      d.setMinutes(0, 0, 0);
      break;
    case 'day':
      d.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek;
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
  }
  return d;
}

/**
 * Calculate the end of the time window for a given date
 */
export function getWindowEnd(
  date: Date,
  window: 'minute' | 'hour' | 'day' | 'week' | 'month',
): Date {
  const start = getWindowStart(date, window);
  const end = new Date(start);
  switch (window) {
    case 'minute':
      end.setMinutes(end.getMinutes() + 1);
      break;
    case 'hour':
      end.setHours(end.getHours() + 1);
      break;
    case 'day':
      end.setDate(end.getDate() + 1);
      break;
    case 'week':
      end.setDate(end.getDate() + 7);
      break;
    case 'month':
      end.setMonth(end.getMonth() + 1);
      break;
  }
  return end;
}

/**
 * Format a date to ISO string without milliseconds
 */
export function formatISODate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse a date from ISO string
 */
export function parseISODate(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate percentage
 */
export function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return (part / total) * 100;
}

/**
 * Round to a given number of decimal places
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate cost from tokens and price per million
 */
export function calculateCostFromTokens(tokens: number, pricePerMillion: number): number {
  return (tokens / 1_000_000) * pricePerMillion;
}

/**
 * Deep clone an object (simple JSON-based)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if an object is empty
 */
export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const targetValue = result[key];
    const sourceValue = source[key];
    if (
      targetValue !== undefined &&
      sourceValue !== undefined &&
      typeof targetValue === 'object' &&
      typeof sourceValue === 'object' &&
      !Array.isArray(targetValue) &&
      !Array.isArray(sourceValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }
  return result;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  },
): Promise<T> {
  let lastError: Error | undefined;
  let delay = options.initialDelayMs;
  const maxAttempts = Math.max(0, options.maxRetries);

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * options.backoffMultiplier, options.maxDelayMs);
      }
    }
  }

  throw lastError ?? new Error('RetryWithBackoff failed');
}

/**
 * Batch an array into chunks of a given size
 */
export function batchArray<T>(arr: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    batches.push(arr.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Sanitize a string for use as a label value (remove invalid characters)
 */
export function sanitizeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Create a hash of a string (simple hash for grouping)
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Extract environment variable with a default
 */
export function getEnvVar(name: string, defaultValue?: string): string | undefined {
  return process.env[name] ?? defaultValue;
}

/**
 * Parse environment variable as integer
 */
export function getEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse environment variable as float
 */
export function getEnvFloat(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse environment variable as boolean
 */
export function getEnvBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}
