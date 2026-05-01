/**
 * Base exporter interface
 * All exporters extend this abstract class
 */
import type { CostRecord, CostSpan, RetryConfig } from '@reaatech/llm-cost-telemetry';
import { retryWithBackoff } from '@reaatech/llm-cost-telemetry';

/**
 * Export result status
 */
export interface ExportResult {
  /** Number of records successfully exported */
  success: number;
  /** Number of records that failed to export */
  failed: number;
  /** Error message if any */
  error?: string;
}

/**
 * Base exporter options
 */
export interface BaseExporterOptions {
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Batch size for exports */
  batchSize?: number;
  /** Whether to enable the exporter */
  enabled?: boolean;
}

/**
 * Resolved exporter options with defaults applied
 */
export interface ResolvedExporterOptions {
  retry: RetryConfig;
  batchSize: number;
  enabled: boolean;
}

/**
 * Abstract base class for cost exporters
 */
export abstract class BaseExporter {
  protected options: ResolvedExporterOptions;
  private isFlushing = false;
  private closed = false;

  constructor(options: Partial<BaseExporterOptions> = {}) {
    this.options = {
      retry: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        ...options.retry,
      },
      batchSize: options.batchSize ?? 100,
      enabled: options.enabled ?? true,
    };
  }

  /**
   * Get the exporter name
   */
  abstract get name(): string;

  /**
   * Export cost spans to the backend
   */
  abstract exportSpans(spans: CostSpan[]): Promise<ExportResult>;

  /**
   * Export aggregated cost records to the backend
   */
  abstract exportRecords(records: CostRecord[]): Promise<ExportResult>;

  /**
   * Export spans with retry logic
   */
  async exportWithRetry(spans: CostSpan[]): Promise<ExportResult> {
    if (!this.options.enabled || this.closed) {
      return { success: 0, failed: spans.length, error: 'Exporter disabled or closed' };
    }

    if (this.isFlushing) {
      return { success: 0, failed: spans.length, error: 'Exporter is already flushing' };
    }

    this.isFlushing = true;

    try {
      const retryConfig = this.options.retry;
      return await retryWithBackoff(async () => this.exportSpans(spans), {
        maxRetries: retryConfig.maxRetries ?? 3,
        initialDelayMs: retryConfig.initialDelayMs ?? 1000,
        maxDelayMs: retryConfig.maxDelayMs ?? 30000,
        backoffMultiplier: retryConfig.backoffMultiplier ?? 2,
      });
    } catch (error) {
      return {
        success: 0,
        failed: spans.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Check if the exporter is healthy
   */
  async healthCheck(): Promise<boolean> {
    return !this.closed && this.options.enabled;
  }

  /**
   * Close the exporter and release resources
   */
  async close(): Promise<void> {
    this.closed = true;
  }

  /**
   * Check if the exporter is enabled
   */
  get isEnabled(): boolean {
    return this.options.enabled && !this.closed;
  }

  /**
   * Get the batch size
   */
  get batchSize(): number {
    return this.options.batchSize;
  }

  /**
   * Batch spans for export
   */
  protected batchSpans(spans: CostSpan[]): CostSpan[][] {
    const batches: CostSpan[][] = [];
    for (let i = 0; i < spans.length; i += this.batchSize) {
      batches.push(spans.slice(i, i + this.batchSize));
    }
    return batches;
  }

  /**
   * Batch records for export
   */
  protected batchRecords(records: CostRecord[]): CostRecord[][] {
    const batches: CostRecord[][] = [];
    for (let i = 0; i < records.length; i += this.batchSize) {
      batches.push(records.slice(i, i + this.batchSize));
    }
    return batches;
  }
}
