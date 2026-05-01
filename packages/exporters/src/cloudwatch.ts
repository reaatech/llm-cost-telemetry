/**
 * AWS CloudWatch exporter for cost telemetry
 * Exports metrics to CloudWatch using PutMetricData API
 */
import type { PutMetricDataCommandInput } from '@aws-sdk/client-cloudwatch';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import type { CostRecord, CostSpan, RetryConfig } from '@reaatech/llm-cost-telemetry';
import { getLogger } from '@reaatech/llm-cost-telemetry-observability';
import { BaseExporter, type ExportResult } from './base.js';

/**
 * CloudWatch exporter options
 */
export interface CloudWatchExporterOptions {
  /** Whether the exporter is enabled */
  enabled?: boolean;
  /** Batch size for exports */
  batchSize?: number;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** AWS region */
  region?: string;
  /** CloudWatch namespace */
  namespace?: string;
  /** Enable EMF format for CloudWatch Logs Insights */
  emfEnabled?: boolean;
  /** Log group name for EMF */
  logGroupName?: string;
  /** AWS access key ID */
  accessKeyId?: string;
  /** AWS secret access key */
  secretAccessKey?: string;
}

/**
 * Default CloudWatch exporter options
 */
const DEFAULT_OPTIONS: Partial<CloudWatchExporterOptions> = {
  namespace: 'LLM/Costs',
  region: 'us-east-1',
  emfEnabled: true,
};

/**
 * AWS CloudWatch exporter
 */
export class CloudWatchExporter extends BaseExporter {
  private client: CloudWatchClient;
  private exporterOptions: CloudWatchExporterOptions;

  get name(): string {
    return 'cloudwatch';
  }

  constructor(options: Partial<CloudWatchExporterOptions> = {}) {
    // Extract base exporter options
    const { enabled, batchSize, retry, ...exporterSpecificOptions } = options;
    super({ enabled, batchSize, retry });
    this.exporterOptions = { ...DEFAULT_OPTIONS, ...exporterSpecificOptions };

    this.client = new CloudWatchClient({
      region: this.exporterOptions.region,
      ...(this.exporterOptions.accessKeyId && this.exporterOptions.secretAccessKey
        ? {
            credentials: {
              accessKeyId: this.exporterOptions.accessKeyId as string,
              secretAccessKey: this.exporterOptions.secretAccessKey as string,
            },
          }
        : {}),
    });
  }

  /**
   * Export cost spans to CloudWatch
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
        const input: PutMetricDataCommandInput = {
          Namespace: this.exporterOptions.namespace ?? 'LLM/Costs',
          MetricData: batch.map((span) => ({
            MetricName: 'LLMCost',
            Dimensions: [
              { Name: 'Provider', Value: span.provider },
              { Name: 'Model', Value: span.model },
              ...(span.telemetry?.tenant ? [{ Name: 'Tenant', Value: span.telemetry.tenant }] : []),
              ...(span.telemetry?.feature
                ? [{ Name: 'Feature', Value: span.telemetry.feature }]
                : []),
              ...(span.telemetry?.route ? [{ Name: 'Route', Value: span.telemetry.route }] : []),
            ],
            Timestamp: span.endTime ? new Date(span.endTime) : undefined,
            Value: span.costUsd,
            Unit: 'None',
          })),
        };

        await this.client.send(new PutMetricDataCommand(input));
        success += batch.length;
      } catch (error) {
        failed += batch.length;
        getLogger().logError(error, { exporter: 'cloudwatch' });
      }
    }

    return { success, failed };
  }

  /**
   * Export aggregated cost records to CloudWatch
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
        const input: PutMetricDataCommandInput = {
          Namespace: this.exporterOptions.namespace ?? 'LLM/Costs',
          MetricData: batch.map((record) => ({
            MetricName: 'LLMAggregatedCost',
            Dimensions: [
              { Name: 'Dimension', Value: record.dimension },
              { Name: 'Value', Value: record.value },
              { Name: 'Window', Value: record.window },
            ],
            Timestamp: record.windowStart ? new Date(record.windowStart) : undefined,
            Value: record.totalCostUsd,
            Unit: 'None',
          })),
        };

        await this.client.send(new PutMetricDataCommand(input));
        success += batch.length;
      } catch (_error) {
        failed += batch.length;
      }
    }

    return { success, failed };
  }
}
