/**
 * GCP Cloud Monitoring exporter for cost telemetry
 * Exports metrics to Cloud Monitoring using Time Series API
 */
import { MetricServiceClient } from '@google-cloud/monitoring';
import { BaseExporter, type ExportResult } from './base.js';
import type { CostSpan, CostRecord, RetryConfig } from '../types/index.js';
import { getLogger } from '../otel/logger.js';

/**
 * Cloud Monitoring exporter options
 */
export interface CloudMonitoringExporterOptions {
  /** Whether the exporter is enabled */
  enabled?: boolean;
  /** Batch size for exports */
  batchSize?: number;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** GCP project ID */
  projectId?: string;
  /** Metric type prefix */
  metricTypePrefix?: string;
  /** Resource type for metrics */
  resourceType?: string;
}

/**
 * Default Cloud Monitoring exporter options
 */
const DEFAULT_OPTIONS: Partial<CloudMonitoringExporterOptions> = {
  metricTypePrefix: 'custom.googleapis.com/llm',
  resourceType: 'gce_instance',
};

/**
 * GCP Cloud Monitoring exporter
 */
export class CloudMonitoringExporter extends BaseExporter {
  private client: MetricServiceClient;
  private exporterOptions: CloudMonitoringExporterOptions;
  private projectName: string;

  get name(): string {
    return 'cloud-monitoring';
  }

  constructor(options: Partial<CloudMonitoringExporterOptions> = {}) {
    // Extract base exporter options
    const { enabled, batchSize, retry, ...exporterSpecificOptions } = options;
    super({ enabled, batchSize, retry });
    this.exporterOptions = { ...DEFAULT_OPTIONS, ...exporterSpecificOptions };

    this.client = new MetricServiceClient({
      ...(this.exporterOptions.projectId ? { projectId: this.exporterOptions.projectId } : {}),
    });

    this.projectName = this.exporterOptions.projectId
      ? `projects/${this.exporterOptions.projectId}`
      : 'projects/your-project-id';
  }

  /**
   * Export cost spans to Cloud Monitoring
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
        const timeSeries = batch.map((span) => ({
          metric: {
            type: `${this.exporterOptions.metricTypePrefix}/cost`,
            labels: {
              provider: span.provider,
              model: span.model,
              ...(span.telemetry?.tenant ? { tenant: span.telemetry.tenant } : {}),
              ...(span.telemetry?.feature ? { feature: span.telemetry.feature } : {}),
              ...(span.telemetry?.route ? { route: span.telemetry.route } : {}),
            },
          },
          resource: {
            type: this.exporterOptions.resourceType,
            labels: {
              project_id: this.exporterOptions.projectId || '',
            },
          },
          metricKind: 'GAUGE' as const,
          valueType: 'DOUBLE' as const,
          points: [
            {
              interval: {
                endTime: {
                  seconds: (span.endTime?.getTime?.() ?? 0) / 1000,
                  nanos: ((span.endTime?.getMilliseconds?.() ?? 0) % 1000) * 1000000,
                },
              },
              value: {
                doubleValue: span.costUsd,
              },
            },
          ],
        }));

        await this.client.createTimeSeries({
          name: this.projectName,
          timeSeries,
        });

        success += batch.length;
      } catch (error) {
        failed += batch.length;
        getLogger().logError(error, { exporter: 'cloud-monitoring' });
      }
    }

    return { success, failed };
  }

  /**
   * Export aggregated cost records to Cloud Monitoring
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
        const timeSeries = batch.map((record) => ({
          metric: {
            type: `${this.exporterOptions.metricTypePrefix}/aggregated_cost`,
            labels: {
              dimension: record.dimension ?? '',
              value: record.value ?? '',
              window: typeof record.window === 'string' ? record.window : '',
            },
          },
          resource: {
            type: this.exporterOptions.resourceType,
            labels: {
              project_id: this.exporterOptions.projectId || '',
            },
          },
          metricKind: 'GAUGE' as const,
          valueType: 'DOUBLE' as const,
          points: [
            {
              interval: {
                endTime: {
                  seconds:
                    (record.windowStart instanceof Date
                      ? record.windowStart.getTime()
                      : new Date(record.windowStart ?? 0).getTime()) / 1000,
                  nanos:
                    ((record.windowStart instanceof Date
                      ? record.windowStart.getMilliseconds()
                      : new Date(record.windowStart ?? 0).getMilliseconds()) %
                      1000) *
                    1000000,
                },
              },
              value: {
                doubleValue: record.totalCostUsd,
              },
            },
          ],
        }));

        await this.client.createTimeSeries({
          name: this.projectName,
          timeSeries,
        });

        success += batch.length;
      } catch (_error) {
        failed += batch.length;
      }
    }

    return { success, failed };
  }
}
