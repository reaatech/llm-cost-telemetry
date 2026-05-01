import type { CostSpan } from '@reaatech/llm-cost-telemetry';
/**
 * Structured logging with PII redaction
 */
import pino from 'pino';

const PII_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[a-zA-Z0-9\-_]+/g,
  /api[_-]?key["\s:=]+[a-zA-Z0-9\-_]+/gi,
  /password["\s:=]+[^\s,}"]+/gi,
  /secret["\s:=]+[^\s,}"]+/gi,
  /token["\s:=]+[a-zA-Z0-9\-_]{20,}/gi,
];

const REDACTED = '[REDACTED]';

function redactPII(value: string): string {
  let result = value;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }
  return result;
}

function redactObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return redactPII(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item));
  }
  if (obj && typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = redactObject(value);
    }
    return result;
  }
  return obj;
}

export interface LoggerOptions {
  level?: string;
  name?: string;
}

const DEFAULT_OPTIONS: LoggerOptions = {
  level: 'info',
  name: 'llm-cost-telemetry',
};

export class CostLogger {
  private logger: pino.Logger;

  constructor(options: LoggerOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.logger = pino({
      level: opts.level,
      name: opts.name,
    });
  }

  private buildSpanFields(costSpan: CostSpan): Record<string, unknown> {
    return {
      span_id: costSpan.spanId || costSpan.id,
      trace_id: costSpan.traceId,
      provider: costSpan.provider,
      model: costSpan.model,
      input_tokens: costSpan.inputTokens,
      output_tokens: costSpan.outputTokens,
      total_tokens: costSpan.totalTokens,
      cost_usd: costSpan.costUsd,
      tenant: costSpan.telemetry?.tenant ?? costSpan.tenant,
      feature: costSpan.telemetry?.feature ?? costSpan.feature,
      route: costSpan.telemetry?.route ?? costSpan.route,
      status: costSpan.status,
      duration_ms: costSpan.durationMs,
      ...(costSpan.errorMessage ? { error: costSpan.errorMessage } : {}),
    };
  }

  logCostSpan(costSpan: CostSpan): void {
    const fields = this.buildSpanFields(costSpan);
    const redacted = redactObject(fields as Record<string, unknown>);
    this.logger.info(redacted, 'Cost span recorded');
  }

  logAggregation(record: {
    dimension: string;
    value: string;
    totalUsd: number;
    totalCalls: number;
    window?: string;
  }): void {
    this.logger.info(
      {
        dimension: record.dimension,
        value: record.value,
        total_usd: record.totalUsd,
        total_calls: record.totalCalls,
        window: record.window,
      },
      'Cost aggregation computed',
    );
  }

  logBudgetAlert(status: {
    tenant: string;
    threshold: number;
    percentage: number;
    action: string;
  }): void {
    this.logger.warn(
      {
        tenant: status.tenant,
        threshold: status.threshold,
        percentage: status.percentage,
        action: status.action,
      },
      'Budget alert triggered',
    );
  }

  logExport(exporter: string, count: number, durationMs: number, success: boolean): void {
    this.logger.info(
      {
        exporter,
        count,
        duration_ms: durationMs,
        success,
      },
      `Export ${success ? 'succeeded' : 'failed'}`,
    );
  }

  logError(error: Error | unknown, context?: Record<string, unknown>): void {
    const err =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: String(error) };
    const fields = context ? (redactObject(context) as Record<string, unknown>) : {};
    this.logger.error({ ...fields, error: err }, 'Error occurred');
  }

  logInfo(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.logger.info(redactObject(data), message);
    } else {
      this.logger.info(message);
    }
  }

  logDebug(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.logger.debug(redactObject(data), message);
    } else {
      this.logger.debug(message);
    }
  }

  logWarn(message: string, data?: Record<string, unknown>): void {
    if (data) {
      this.logger.warn(redactObject(data), message);
    } else {
      this.logger.warn(message);
    }
  }
}

let defaultLogger: CostLogger | null = null;

export function getLogger(options?: LoggerOptions): CostLogger {
  if (!defaultLogger) {
    defaultLogger = new CostLogger({
      level: process.env.LOG_LEVEL ?? 'info',
      ...options,
    });
  }
  return defaultLogger;
}
