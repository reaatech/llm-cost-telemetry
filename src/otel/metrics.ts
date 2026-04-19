/**
 * OpenTelemetry metrics integration
 */
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import type { Counter, Histogram, UpDownCounter } from '@opentelemetry/api';
import type { TelemetryConfig, CostSpan } from '../types/index.js';

export interface MetricsOptions extends Partial<TelemetryConfig> {
  serviceName?: string;
  serviceVersion?: string;
  exporterEndpoint?: string;
  exportIntervalMs?: number;
  enabled?: boolean;
}

const DEFAULT_OPTIONS: Partial<MetricsOptions> = {
  serviceName: 'llm-cost-telemetry',
  exporterEndpoint: '',
  exportIntervalMs: 60000,
  enabled: true,
};

export class MetricsManager {
  private provider: MeterProvider | null = null;
  private options: MetricsOptions;

  private tokenCounter: Counter | null = null;
  private costHistogram: Histogram | null = null;
  private callCounter: Counter | null = null;
  private errorCounter: Counter | null = null;
  private budgetGauge: UpDownCounter | null = null;

  constructor(options: Partial<MetricsOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  init(): void {
    if (!this.options.enabled) {
      return;
    }

    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.options.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.options.serviceVersion,
      ...(this.options.resourceAttributes || {}),
    });

    const exporter = this.createExporter();

    const reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: this.options.exportIntervalMs ?? 60000,
    });

    this.provider = new MeterProvider({ resource, readers: [reader] });

    const meter = this.provider.getMeter('llm-cost-telemetry');

    this.tokenCounter = meter.createCounter('gen_ai.client.token.use', {
      description: 'Total number of tokens used',
      unit: 'tokens',
    });

    this.costHistogram = meter.createHistogram('gen_ai.client.operation.duration', {
      description: 'Cost in USD',
      unit: 'usd',
    });

    this.callCounter = meter.createCounter('gen_ai.client.operation.calls', {
      description: 'Number of LLM API calls',
      unit: 'calls',
    });

    this.errorCounter = meter.createCounter('gen_ai.client.operation.errors', {
      description: 'Number of LLM API errors',
      unit: 'errors',
    });

    this.budgetGauge = meter.createUpDownCounter('llm.budget.utilization', {
      description: 'Budget utilization percentage',
      unit: 'percent',
    });
  }

  private createExporter(): PushMetricExporter {
    const endpoint = this.options.exporterEndpoint || this.options.otlpEndpoint;
    if (endpoint) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
        return new OTLPMetricExporter({ url: endpoint });
      } catch {
        // OTLP exporter not installed; fall through to noop
      }
    }
    return {
      export: (metrics, resultCallback) => resultCallback({ code: 0 }),
      shutdown: () => Promise.resolve(),
      forceFlush: () => Promise.resolve(),
    };
  }

  /**
   * Record token usage
   */
  recordTokens(
    inputTokens: number,
    outputTokens: number,
    provider: string,
    model: string,
    tenant?: string,
  ): void {
    if (!this.tokenCounter) return;

    const attributes = {
      'gen_ai.system': provider,
      'gen_ai.request.model': model,
      type: 'input',
      ...(tenant ? { tenant } : {}),
    };

    this.tokenCounter.add(inputTokens, attributes);
    this.tokenCounter.add(outputTokens, { ...attributes, type: 'output' });
  }

  /**
   * Record cost
   */
  recordCost(costUsd: number, provider: string, model: string, tenant?: string): void {
    if (!this.costHistogram) return;

    this.costHistogram.record(costUsd, {
      'gen_ai.system': provider,
      'gen_ai.request.model': model,
      ...(tenant ? { tenant } : {}),
    });
  }

  /**
   * Record an API call
   */
  recordCall(
    provider: string,
    model: string,
    status: 'success' | 'error' = 'success',
    tenant?: string,
  ): void {
    if (!this.callCounter) return;

    this.callCounter.add(1, {
      provider,
      model,
      status,
      ...(tenant ? { tenant } : {}),
    });
  }

  /**
   * Record an error
   */
  recordError(provider: string, model: string, errorType: string, tenant?: string): void {
    if (!this.errorCounter) return;

    this.errorCounter.add(1, {
      provider,
      model,
      error_type: errorType,
      ...(tenant ? { tenant } : {}),
    });
  }

  /**
   * Record budget utilization
   */
  recordBudgetUtilization(tenant: string, percentage: number): void {
    if (!this.budgetGauge) return;

    this.budgetGauge.add(percentage, { tenant });
  }

  /**
   * Record a cost span as metrics
   */
  recordCostSpan(span: CostSpan): void {
    this.recordTokens(
      span.inputTokens,
      span.outputTokens,
      span.provider,
      span.model,
      span.telemetry?.tenant,
    );

    this.recordCost(span.costUsd, span.provider, span.model, span.telemetry?.tenant);

    this.recordCall(span.provider, span.model, 'success', span.telemetry?.tenant);
  }

  /**
   * Close the metrics provider
   */
  async close(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
      this.provider = null;
    }
  }

  /**
   * Check if metrics is enabled
   */
  get isEnabled(): boolean {
    return this.options.enabled === true && this.provider !== null;
  }
}
