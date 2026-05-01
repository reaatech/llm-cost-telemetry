/**
 * Unit tests for structured logger
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CostLogger, getLogger } from '@reaatech/llm-cost-telemetry-observability';

describe('CostLogger', () => {
  let logger: CostLogger;

  beforeEach(() => {
    logger = new CostLogger({ level: 'silent' });
  });

  it('creates a logger instance', () => {
    expect(logger).toBeInstanceOf(CostLogger);
  });

  it('creates a logger with custom options', () => {
    const customLogger = new CostLogger({ level: 'debug', name: 'custom' });
    expect(customLogger).toBeInstanceOf(CostLogger);
  });

  it('returns singleton from getLogger', () => {
    const logger1 = getLogger({ level: 'silent' });
    const logger2 = getLogger({ level: 'silent' });
    expect(logger1).toBe(logger2);
  });

  it('logs cost span without throwing', () => {
    expect(() => {
      logger.logCostSpan({
        spanId: 'test-123',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.005,
      });
    }).not.toThrow();
  });

  it('logs cost span using id when spanId is not set', () => {
    expect(() => {
      logger.logCostSpan({
        id: 'test-456',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.005,
      });
    }).not.toThrow();
  });

  it('logs cost span with error message', () => {
    expect(() => {
      logger.logCostSpan({
        spanId: 'test-err',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.005,
        status: 'error',
        errorMessage: 'Rate limit exceeded',
      });
    }).not.toThrow();
  });

  it('logs cost span with telemetry context', () => {
    expect(() => {
      logger.logCostSpan({
        spanId: 'test-tel',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.005,
        telemetry: { tenant: 'acme', feature: 'chat', route: '/api/chat' },
      });
    }).not.toThrow();
  });

  it('logs cost span with legacy tenant/feature/route fields', () => {
    expect(() => {
      logger.logCostSpan({
        spanId: 'test-legacy',
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.005,
        tenant: 'legacy-tenant',
        feature: 'legacy-feature',
        route: '/legacy',
      });
    }).not.toThrow();
  });

  it('logs aggregation without throwing', () => {
    expect(() => {
      logger.logAggregation({
        dimension: 'tenant',
        value: 'test-tenant',
        totalUsd: 1.23,
        totalCalls: 10,
        window: 'day',
      });
    }).not.toThrow();
  });

  it('logs aggregation without window', () => {
    expect(() => {
      logger.logAggregation({
        dimension: 'feature',
        value: 'test-feature',
        totalUsd: 2.5,
        totalCalls: 20,
      });
    }).not.toThrow();
  });

  it('logs budget alert without throwing', () => {
    expect(() => {
      logger.logBudgetAlert({
        tenant: 'test-tenant',
        threshold: 0.8,
        percentage: 85,
        action: 'notify',
      });
    }).not.toThrow();
  });

  it('logs export success without throwing', () => {
    expect(() => {
      logger.logExport('cloudwatch', 10, 150, true);
    }).not.toThrow();
  });

  it('logs export failure without throwing', () => {
    expect(() => {
      logger.logExport('phoenix', 0, 200, false);
    }).not.toThrow();
  });

  it('logs Error objects without throwing', () => {
    expect(() => {
      logger.logError(new Error('Test error'));
    }).not.toThrow();
  });

  it('logs non-Error objects without throwing', () => {
    expect(() => {
      logger.logError('String error message');
    }).not.toThrow();
  });

  it('logs error with context without throwing', () => {
    expect(() => {
      logger.logError(new Error('With context'), {
        tenant: 'acme',
        key: 'sk-abcdefghijklmnopqrstuvwxyz',
      });
    }).not.toThrow();
  });

  it('logs info without data', () => {
    expect(() => {
      logger.logInfo('Test message');
    }).not.toThrow();
  });

  it('logs info with data', () => {
    expect(() => {
      logger.logInfo('Test message', { key: 'value' });
    }).not.toThrow();
  });

  it('logs debug without data', () => {
    expect(() => {
      logger.logDebug('Test debug');
    }).not.toThrow();
  });

  it('logs debug with data', () => {
    expect(() => {
      logger.logDebug('Test debug', { debugKey: 'debugValue' });
    }).not.toThrow();
  });

  it('logs warn without data', () => {
    expect(() => {
      logger.logWarn('Test warning');
    }).not.toThrow();
  });

  it('logs warn with data', () => {
    expect(() => {
      logger.logWarn('Test warning', { warnKey: 'warnValue' });
    }).not.toThrow();
  });

  it('redacts API keys from objects', () => {
    expect(() => {
      logger.logInfo('Test', { apiKey: 'sk-abcdefghijklmnopqrstuvwxyz12' });
    }).not.toThrow();
  });

  it('redacts Bearer tokens from objects', () => {
    expect(() => {
      logger.logInfo('Test', { auth: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' });
    }).not.toThrow();
  });

  it('redacts nested objects', () => {
    expect(() => {
      logger.logInfo('Test', {
        nested: {
          deep: {
            secret: 'sk-abcdefghijklmnopqrstuvwxyz123456',
          },
        },
      });
    }).not.toThrow();
  });

  it('preserves non-string values in redaction', () => {
    expect(() => {
      logger.logInfo('Test', { count: 42, flag: true, arr: [1, 2, 3] });
    }).not.toThrow();
  });
});
