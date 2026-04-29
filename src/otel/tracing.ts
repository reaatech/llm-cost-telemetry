/**
 * OpenTelemetry tracing integration
 */
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import type { Tracer, Span } from '@opentelemetry/api';
import { trace, SpanKind, context, propagation } from '@opentelemetry/api';
import type { TelemetryConfig, CostSpan } from '../types/index.js';

/**
 * Tracing options
 */
export interface TracingOptions extends Partial<TelemetryConfig> {
  /** Service name */
  serviceName?: string;
  /** Service version */
  serviceVersion?: string;
  /** Trace exporter endpoint */
  exporterEndpoint?: string;
  /** Whether to enable tracing */
  enabled?: boolean;
}

/**
 * Default tracing options
 */
const DEFAULT_OPTIONS: Partial<TracingOptions> = {
  serviceName: 'llm-cost-telemetry',
  exporterEndpoint: 'http://localhost:4318/v1/traces',
  enabled: true,
};

/**
 * OpenTelemetry tracing manager
 */
export class TracingManager {
  private provider: NodeTracerProvider | null = null;
  private options: TracingOptions;

  constructor(options: Partial<TracingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private getTracer(): Tracer {
    return this.provider
      ? this.provider.getTracer('llm-cost-telemetry')
      : trace.getTracer('llm-cost-telemetry');
  }

  /**
   * Initialize the tracing provider
   */
  init(): void {
    if (!this.options.enabled) {
      return;
    }

    const resource = resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: this.options.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.options.serviceVersion,
      ...(this.options.resourceAttributes || {}),
    });

    const exporter = new OTLPTraceExporter({
      url: this.options.exporterEndpoint,
    });

    this.provider = new NodeTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    this.provider.register();
  }

  /**
   * Start a span for an LLM call
   */
  startSpan(name: string, attributes: Record<string, string | number | boolean>): Span {
    const span = this.getTracer().startSpan(name, {
      kind: SpanKind.CLIENT,
      attributes,
    });
    return span;
  }

  recordCostSpan(costSpan: CostSpan): void {
    const tracer = this.getTracer();

    tracer.startActiveSpan('llm.call', (activeSpan) => {
      const attributes: Record<string, string | number | boolean> = {
        'gen_ai.system': costSpan.provider,
        'gen_ai.request.model': costSpan.model,
        'gen_ai.usage.input_tokens': costSpan.inputTokens,
        'gen_ai.usage.output_tokens': costSpan.outputTokens,
        'llm.cost_usd': costSpan.costUsd,
      };

      if (costSpan.totalTokens !== undefined) {
        attributes['gen_ai.usage.total_tokens'] = costSpan.totalTokens;
      }
      if (costSpan.durationMs !== undefined) {
        attributes['llm.duration_ms'] = costSpan.durationMs;
      }
      if (costSpan.cacheReadTokens !== undefined) {
        attributes['gen_ai.usage.cache_read_tokens'] = costSpan.cacheReadTokens;
      }
      if (costSpan.cacheCreationTokens !== undefined) {
        attributes['gen_ai.usage.cache_creation_tokens'] = costSpan.cacheCreationTokens;
      }
      if (costSpan.telemetry?.tenant) {
        attributes['llm.tenant'] = costSpan.telemetry.tenant;
      }
      if (costSpan.telemetry?.feature) {
        attributes['llm.feature'] = costSpan.telemetry.feature;
      }
      if (costSpan.telemetry?.route) {
        attributes['llm.route'] = costSpan.telemetry.route;
      }

      activeSpan.setAttributes(attributes);
      activeSpan.end();
    });
  }

  /**
   * Get the current span context for propagation
   */
  getCurrentContext(): string | undefined {
    const ctx = context.active();
    const carrier: Record<string, string> = {};
    propagation.inject(ctx, carrier);
    return carrier.traceparent;
  }

  /**
   * Close the tracing provider
   */
  async close(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
      this.provider = null;
    }
  }

  /**
   * Check if tracing is enabled
   */
  get isEnabled(): boolean {
    return this.options.enabled === true && this.provider !== null;
  }
}
