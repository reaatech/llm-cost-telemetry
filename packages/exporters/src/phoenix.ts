import type { CostRecord, CostSpan, RetryConfig } from '@reaatech/llm-cost-telemetry';
import { getLogger } from '@reaatech/llm-cost-telemetry-observability';
/**
 * Grafana Phoenix/Loki exporter for cost telemetry
 * Exports metrics to Loki using the Push API
 */
import { BaseExporter, type ExportResult } from './base.js';

/**
 * Loki log entry format
 */
interface LokiLogEntry {
  labels: string;
  entries: Array<{
    ts: string;
    line: string;
  }>;
}

/**
 * Loki push payload
 */
interface LokiPushPayload {
  streams: LokiLogEntry[];
}

/**
 * Phoenix/Loki exporter options
 */
export interface PhoenixExporterOptions {
  /** Whether the exporter is enabled */
  enabled?: boolean;
  /** Batch size for exports */
  batchSize?: number;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Loki host URL */
  host?: string;
  /** Default labels to add to all logs */
  defaultLabels?: Record<string, string>;
  /** Username for basic auth */
  username?: string;
  /** Password for basic auth */
  password?: string;
  /** Flush interval in milliseconds */
  flushInterval?: number;
}

/**
 * Default Phoenix exporter options
 */
const DEFAULT_OPTIONS: Partial<PhoenixExporterOptions> = {
  host: 'http://localhost:3100',
  defaultLabels: {
    service: 'llm-cost-telemetry',
    environment: 'production',
  },
};

/**
 * Grafana Phoenix/Loki exporter
 */
export class PhoenixExporter extends BaseExporter {
  private phoenixOptions: PhoenixExporterOptions;

  constructor(options: Partial<PhoenixExporterOptions> = {}) {
    super(options);
    this.phoenixOptions = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get the exporter name
   */
  get name(): string {
    return 'phoenix';
  }

  /**
   * Export cost spans to Loki
   */
  async exportSpans(spans: CostSpan[]): Promise<ExportResult> {
    if (spans.length === 0) {
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    const batches = this.batchSpans(spans);

    for (const batch of batches) {
      try {
        const payload = this.createPushPayload(batch, 'span');
        await this.pushToLoki(payload);
        success += batch.length;
      } catch (error) {
        failed += batch.length;
        getLogger().logError(error, { exporter: 'phoenix', type: 'span' });
      }
    }

    return { success, failed };
  }

  /**
   * Export aggregated cost records to Loki
   */
  async exportRecords(records: CostRecord[]): Promise<ExportResult> {
    if (records.length === 0) {
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    const batches = this.batchRecords(records);

    for (const batch of batches) {
      try {
        const payload = this.createPushPayload(batch, 'record');
        await this.pushToLoki(payload);
        success += batch.length;
      } catch (error) {
        failed += batch.length;
        getLogger().logError(error, { exporter: 'phoenix', type: 'record' });
      }
    }

    return { success, failed };
  }

  /**
   * Create Loki push payload from spans or records
   */
  private createPushPayload(
    items: Array<CostSpan | CostRecord>,
    type: 'span' | 'record',
  ): LokiPushPayload {
    const labels: Record<string, string> = {
      ...this.phoenixOptions.defaultLabels,
      type,
    };

    const entries = items.map((item) => {
      const timestamp =
        'endTime' in item && item.endTime
          ? item.endTime
          : 'windowStart' in item && item.windowStart
            ? item.windowStart
            : new Date();
      return {
        ts:
          (timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime()) *
          1000000, // nanoseconds
        line: JSON.stringify(item),
      };
    });

    // Add specific labels based on item type
    if (items.length > 0) {
      const first = items[0];
      if ('provider' in first) {
        labels.provider = (first as CostSpan).provider;
      }
      if ('dimension' in first) {
        labels.dimension = (first as CostRecord).dimension ?? '';
      }
    }

    return {
      streams: [
        {
          labels: this.formatLabels(labels),
          entries: entries.map((e) => ({
            ts: String(e.ts),
            line: e.line,
          })),
        },
      ],
    };
  }

  /**
   * Format labels for Loki
   */
  private formatLabels(labels: Record<string, string>): string {
    return Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
  }

  /**
   * Push payload to Loki
   */
  private async pushToLoki(payload: LokiPushPayload): Promise<void> {
    const url = `${this.phoenixOptions.host}/loki/api/v1/push`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth headers if configured
    if (this.phoenixOptions.username && this.phoenixOptions.password) {
      const auth = Buffer.from(
        `${this.phoenixOptions.username}:${this.phoenixOptions.password}`,
      ).toString('base64');
      headers.Authorization = `Basic ${auth}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to push to Loki: ${response.status} ${response.statusText}`);
    }
  }
}
