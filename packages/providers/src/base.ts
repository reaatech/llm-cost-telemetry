/**
 * Base provider wrapper interface
 * All provider wrappers extend this abstract class
 */
import type { CostSpan, Provider, TelemetryContext } from '@reaatech/llm-cost-telemetry';
import { generateId } from '@reaatech/llm-cost-telemetry';

/**
 * Request metadata captured by the wrapper
 */
export interface RequestMetadata {
  /** Model being used */
  model: string;
  /** Request parameters */
  params: unknown;
  /** Telemetry context if provided */
  telemetry?: Partial<TelemetryContext>;
  /** Request start time */
  startTime: Date;
}

/**
 * Response metadata captured by the wrapper
 */
export interface ResponseMetadata {
  /** Input tokens used */
  inputTokens: number;
  /** Output tokens used */
  outputTokens: number;
  /** Cache read tokens (if applicable) */
  cacheReadTokens?: number;
  /** Cache creation tokens (if applicable) */
  cacheCreationTokens?: number;
  /** Response end time */
  endTime: Date;
  /** Any error that occurred */
  error?: Error;
}

/**
 * Callback for when a cost span is recorded
 */
export type SpanCallback = (span: CostSpan) => void;

/**
 * Abstract base class for provider wrappers
 */
export abstract class BaseProviderWrapper<TClient = unknown> {
  /** The wrapped client */
  protected client: TClient;

  /** Callback for cost spans */
  protected onSpanCallback: SpanCallback | null = null;

  /** Default telemetry context */
  protected defaultContext: Partial<TelemetryContext> = {};

  /**
   * Create a new provider wrapper
   */
  constructor(client: TClient) {
    this.client = client;
  }

  /**
   * Get the provider name
   */
  abstract get provider(): Provider;

  /**
   * Set the callback for cost spans
   */
  onSpan(callback: SpanCallback): void {
    this.onSpanCallback = callback;
  }

  /**
   * Set default telemetry context
   */
  setDefaultContext(context: Partial<TelemetryContext>): void {
    this.defaultContext = context;
  }

  /**
   * Create a cost span from request and response metadata
   */
  protected createSpan(request: RequestMetadata, response: ResponseMetadata): CostSpan {
    const duration = response.endTime.getTime() - request.startTime.getTime();

    return {
      id: generateId(),
      provider: this.provider,
      model: request.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      totalTokens: response.inputTokens + response.outputTokens,
      costUsd: 0, // Will be calculated by the cost calculator
      startTime: request.startTime,
      endTime: response.endTime,
      durationMs: Math.max(0, duration),
      cacheReadTokens: response.cacheReadTokens,
      cacheCreationTokens: response.cacheCreationTokens,
      telemetry: {
        ...this.defaultContext,
        ...request.telemetry,
      },
      metadata: {
        estimated: false,
      },
    };
  }

  /**
   * Emit a cost span
   */
  protected emitSpan(span: CostSpan): void {
    if (this.onSpanCallback) {
      try {
        this.onSpanCallback(span);
      } catch {
        // Silently ignore callback errors to avoid breaking successful API calls
      }
    }
  }

  /**
   * Extract telemetry context from request options
   */
  protected extractTelemetryContext(
    options: Record<string, unknown>,
  ): Partial<TelemetryContext> | undefined {
    const telemetry = options.telemetry;
    if (telemetry && typeof telemetry === 'object') {
      const ctx: Partial<TelemetryContext> = {};
      if ('tenant' in telemetry && typeof telemetry.tenant === 'string') {
        ctx.tenant = telemetry.tenant;
      }
      if ('feature' in telemetry && typeof telemetry.feature === 'string') {
        ctx.feature = telemetry.feature;
      }
      if ('route' in telemetry && typeof telemetry.route === 'string') {
        ctx.route = telemetry.route;
      }
      return Object.keys(ctx).length > 0 ? ctx : undefined;
    }
    return undefined;
  }

  /**
   * Dispose of the wrapper and release resources
   */
  dispose(): void {
    this.onSpanCallback = null;
    this.defaultContext = {};
  }

  /**
   * Get the underlying client
   */
  unwrap(): TClient {
    return this.client;
  }
}
