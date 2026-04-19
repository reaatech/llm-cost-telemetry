/**
 * Export command — Manual export trigger
 */
import { CostAggregator } from '../../aggregation/aggregator.js';
import type { CostRecord } from '../../types/index.js';
import type { CostSpan } from '../../types/index.js';
import type { ExportResult as BaseExportResult } from '../../exporters/base.js';

export interface ExportOptions {
  exporter: 'cloudwatch' | 'cloud-monitoring' | 'phoenix';
  period: 'hour' | 'day';
}

export interface ExportResult {
  exporter: string;
  period: string;
  recordsExported: number;
  success: boolean;
  durationMs: number;
  errors: string[];
}

export interface ExporterInterface {
  exportRecords(records: CostRecord[]): Promise<BaseExportResult>;
  name: string;
}

export function buildExportPayload(spans: CostSpan[]): CostRecord[] {
  const aggregator = new CostAggregator({
    dimensions: ['tenant', 'feature', 'route', 'provider', 'model'],
    timeWindows: ['minute', 'hour', 'day', 'week', 'month'],
  });

  for (const span of spans) {
    aggregator.add(span);
  }

  return aggregator.getAll();
}

export async function triggerExport(
  exporter: ExporterInterface,
  records: CostRecord[],
  options: ExportOptions,
): Promise<ExportResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    const result = await exporter.exportRecords(records);

    return {
      exporter: exporter.name ?? options.exporter,
      period: options.period,
      recordsExported: result.success,
      success: result.failed === 0,
      durationMs: Date.now() - startTime,
      errors: result.error ? [result.error] : [],
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      exporter: options.exporter,
      period: options.period,
      recordsExported: 0,
      success: false,
      durationMs: Date.now() - startTime,
      errors,
    };
  }
}

export function formatExportResult(result: ExportResult, format: 'json' | 'text' = 'json'): string {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  const lines: string[] = [];
  lines.push('');
  lines.push('=== Export Result ===');
  lines.push(`Exporter: ${result.exporter}`);
  lines.push(`Period:   ${result.period}`);
  lines.push(`Status:   ${result.success ? 'SUCCESS' : 'FAILED'}`);
  lines.push(`Records:  ${result.recordsExported}`);
  lines.push(`Duration: ${result.durationMs}ms`);

  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const err of result.errors) {
      lines.push(`  - ${err}`);
    }
  }

  return lines.join('\n');
}
