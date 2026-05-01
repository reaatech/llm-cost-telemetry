import {
  batchArray,
  calculateCostFromTokens,
  clamp,
  deepClone,
  deepMerge,
  formatISODate,
  generateId,
  getEnvBool,
  getEnvFloat,
  getEnvInt,
  getEnvVar,
  getWindowEnd,
  getWindowStart,
  isEmpty,
  now,
  nowMs,
  parseISODate,
  percentage,
  retryWithBackoff,
  roundTo,
  sanitizeLabel,
  simpleHash,
  sleep,
} from '@reaatech/llm-cost-telemetry';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Utils', () => {
  describe('generateId', () => {
    it('should return a UUID string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('now', () => {
    it('should return a Date close to now', () => {
      const before = Date.now();
      const result = now();
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('nowMs', () => {
    it('should return a number close to Date.now()', () => {
      const result = nowMs();
      expect(typeof result).toBe('number');
      expect(Math.abs(result - Date.now())).toBeLessThan(100);
    });
  });

  describe('sleep', () => {
    it('should resolve after given milliseconds', async () => {
      const start = Date.now();
      await sleep(10);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(5);
    });
  });

  describe('getWindowStart', () => {
    it('should return start of minute', () => {
      const date = new Date('2024-01-15T10:30:45.500Z');
      const start = getWindowStart(date, 'minute');
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it('should return start of hour', () => {
      const date = new Date('2024-01-15T10:30:45.500Z');
      const start = getWindowStart(date, 'hour');
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
    });

    it('should return start of day', () => {
      const date = new Date('2024-01-15T10:30:45.500Z');
      const start = getWindowStart(date, 'day');
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
    });

    it('should return start of week', () => {
      const date = new Date('2024-01-17T10:30:45.500Z');
      const start = getWindowStart(date, 'week');
      expect(start.getHours()).toBe(0);
      expect(start.getDay()).toBe(0);
    });

    it('should return start of month', () => {
      const date = new Date('2024-01-15T10:30:45.500Z');
      const start = getWindowStart(date, 'month');
      expect(start.getDate()).toBe(1);
      expect(start.getHours()).toBe(0);
    });
  });

  describe('getWindowEnd', () => {
    it('should return end of minute', () => {
      const date = new Date('2024-01-15T10:30:45.500Z');
      const end = getWindowEnd(date, 'minute');
      expect(end.getMinutes()).toBe(31);
      expect(end.getSeconds()).toBe(0);
    });

    it('should return end of hour', () => {
      const date = new Date('2024-01-15T10:30:45.500Z');
      const end = getWindowEnd(date, 'hour');
      expect(end.getUTCHours()).toBe(11);
      expect(end.getMinutes()).toBe(0);
    });

    it('should return end of day', () => {
      const date = new Date('2024-01-15T10:30:45.500Z');
      const end = getWindowEnd(date, 'day');
      expect(end.getDate()).toBe(16);
    });

    it('should return end of week', () => {
      const date = new Date('2024-01-17T10:30:45.500Z');
      const end = getWindowEnd(date, 'week');
      const start = getWindowStart(date, 'week');
      expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should return end of month', () => {
      const date = new Date('2024-01-15T10:30:45.500Z');
      const end = getWindowEnd(date, 'month');
      expect(end.getMonth()).toBe(1);
    });
  });

  describe('formatISODate', () => {
    it('should format date as ISO string', () => {
      const date = new Date('2024-01-15T10:30:45.500Z');
      const result = formatISODate(date);
      expect(result).toContain('2024');
    });
  });

  describe('parseISODate', () => {
    it('should parse ISO string to Date', () => {
      const result = parseISODate('2024-01-15T10:30:45.500Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('should clamp to min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should clamp to max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('percentage', () => {
    it('should calculate percentage', () => {
      expect(percentage(25, 100)).toBe(25);
    });

    it('should return 0 for zero total', () => {
      expect(percentage(25, 0)).toBe(0);
    });
  });

  describe('roundTo', () => {
    it('should round to 2 decimal places', () => {
      expect(roundTo(Math.PI, 2)).toBe(3.14);
    });

    it('should round to 0 decimal places', () => {
      expect(roundTo(3.5, 0)).toBe(4);
    });
  });

  describe('calculateCostFromTokens', () => {
    it('should calculate cost from tokens and price per million', () => {
      const cost = calculateCostFromTokens(1_000_000, 5.0);
      expect(cost).toBe(5.0);
    });

    it('should handle zero tokens', () => {
      const cost = calculateCostFromTokens(0, 5.0);
      expect(cost).toBe(0);
    });
  });

  describe('deepClone', () => {
    it('should deep clone an object', () => {
      const obj = { a: 1, b: { c: 2 } };
      const clone = deepClone(obj);
      expect(clone).toEqual(obj);
      expect(clone).not.toBe(obj);
      expect(clone.b).not.toBe(obj.b);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty object', () => {
      expect(isEmpty({})).toBe(true);
    });

    it('should return false for non-empty object', () => {
      expect(isEmpty({ a: 1 })).toBe(false);
    });
  });

  describe('deepMerge', () => {
    it('should merge objects deeply', () => {
      const target = { a: 1, b: { c: 2, d: 3 } };
      const source = { b: { c: 99 } } as unknown;
      const result = deepMerge(target, source);
      expect(result.a).toBe(1);
      expect(result.b.c).toBe(99);
      expect(result.b.d).toBe(3);
    });

    it('should overwrite arrays', () => {
      const target = { a: [1, 2] };
      const source = { a: [3] };
      const result = deepMerge(target, source);
      expect(result.a).toEqual([3]);
    });

    it('should overwrite primitive values', () => {
      const target = { a: 1 };
      const source = { a: 2 };
      const result = deepMerge(target, source);
      expect(result.a).toBe(2);
    });
  });

  describe('retryWithBackoff', () => {
    it('should return result on first success', async () => {
      const result = await retryWithBackoff(() => Promise.resolve('ok'), {
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
        backoffMultiplier: 2,
      });
      expect(result).toBe('ok');
    });

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const result = await retryWithBackoff(
        () => {
          attempts++;
          if (attempts < 3) throw new Error('fail');
          return Promise.resolve('ok');
        },
        {
          maxRetries: 3,
          initialDelayMs: 1,
          maxDelayMs: 10,
          backoffMultiplier: 2,
        },
      );
      expect(result).toBe('ok');
      expect(attempts).toBe(3);
    });

    it('should throw after exhausting retries', async () => {
      await expect(
        retryWithBackoff(() => Promise.reject(new Error('always fail')), {
          maxRetries: 2,
          initialDelayMs: 1,
          maxDelayMs: 10,
          backoffMultiplier: 2,
        }),
      ).rejects.toThrow('always fail');
    });
  });

  describe('batchArray', () => {
    it('should batch array into chunks', () => {
      const result = batchArray([1, 2, 3, 4, 5], 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle empty array', () => {
      const result = batchArray([], 2);
      expect(result).toEqual([]);
    });

    it('should handle batch size larger than array', () => {
      const result = batchArray([1, 2], 10);
      expect(result).toEqual([[1, 2]]);
    });
  });

  describe('sanitizeLabel', () => {
    it('should replace invalid characters with underscore', () => {
      expect(sanitizeLabel('hello world!')).toBe('hello_world_');
    });

    it('should keep valid characters', () => {
      expect(sanitizeLabel('hello-world_123')).toBe('hello-world_123');
    });
  });

  describe('simpleHash', () => {
    it('should return a hash string', () => {
      const hash = simpleHash('hello');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce consistent hashes', () => {
      expect(simpleHash('test')).toBe(simpleHash('test'));
    });

    it('should produce different hashes for different inputs', () => {
      expect(simpleHash('a')).not.toBe(simpleHash('b'));
    });
  });

  describe('environment variable helpers', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('getEnvVar', () => {
      it('should return env var value', () => {
        process.env.TEST_VAR = 'hello';
        expect(getEnvVar('TEST_VAR')).toBe('hello');
      });

      it('should return default when not set', () => {
        expect(getEnvVar('NONEXISTENT', 'default')).toBe('default');
      });

      it('should return undefined when not set and no default', () => {
        expect(getEnvVar('NONEXISTENT')).toBeUndefined();
      });
    });

    describe('getEnvInt', () => {
      it('should parse integer env var', () => {
        process.env.TEST_INT = '42';
        expect(getEnvInt('TEST_INT', 0)).toBe(42);
      });

      it('should return default when not set', () => {
        expect(getEnvInt('NONEXISTENT', 99)).toBe(99);
      });

      it('should return default for non-numeric value', () => {
        process.env.TEST_INT = 'not-a-number';
        expect(getEnvInt('TEST_INT', 99)).toBe(99);
      });
    });

    describe('getEnvFloat', () => {
      it('should parse float env var', () => {
        process.env.TEST_FLOAT = '3.14';
        expect(getEnvFloat('TEST_FLOAT', 0)).toBe(3.14);
      });

      it('should return default when not set', () => {
        expect(getEnvFloat('NONEXISTENT', 1.5)).toBe(1.5);
      });

      it('should return default for non-numeric value', () => {
        process.env.TEST_FLOAT = 'not-a-number';
        expect(getEnvFloat('TEST_FLOAT', 1.5)).toBe(1.5);
      });
    });

    describe('getEnvBool', () => {
      it('should parse "true" as true', () => {
        process.env.TEST_BOOL = 'true';
        expect(getEnvBool('TEST_BOOL', false)).toBe(true);
      });

      it('should parse "1" as true', () => {
        process.env.TEST_BOOL = '1';
        expect(getEnvBool('TEST_BOOL', false)).toBe(true);
      });

      it('should parse "false" as false', () => {
        process.env.TEST_BOOL = 'false';
        expect(getEnvBool('TEST_BOOL', true)).toBe(false);
      });

      it('should return default when not set', () => {
        expect(getEnvBool('NONEXISTENT', true)).toBe(true);
        expect(getEnvBool('NONEXISTENT', false)).toBe(false);
      });
    });
  });
});
