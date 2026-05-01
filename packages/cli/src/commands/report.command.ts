/**
 * Report command — Generate cost reports
 */
import { CostAggregator, type AggregationDimension } from '@reaatech/llm-cost-telemetry-aggregation';
import type { CostSpan, CostSummary, TimeWindow } from '@reaatech/llm-cost-telemetry';

export interface ReportOptions {
  tenant?: string;
  period: TimeWindow;
  format: 'json' | 'table';
  start?: string;
  end?: string;
  groupBy?: string[];
}

export async function generateReport(
  spans: CostSpan[],
  options: ReportOptions,
): Promise<CostSummary> {
  const aggregator = new CostAggregator({
    dimensions: ['tenant', 'feature', 'route', 'provider', 'model'],
    timeWindows: ['minute', 'hour', 'day', 'week', 'month'],
  });
  for (const span of spans) {
    aggregator.add(span);
  }

  const summary = aggregator.getSummary({
    period: options.period,
    groupBy: (options.groupBy as AggregationDimension[]) ?? ['tenant'],
    tenant: options.tenant,
  });

  if (options.start) {
    summary.periodStart = new Date(options.start);
  }
  if (options.end) {
    summary.periodEnd = new Date(options.end);
  }

  return summary;
}

export function formatReport(summary: CostSummary, format: 'json' | 'table'): string {
  if (format === 'json') {
    return JSON.stringify(summary, replacer, 2);
  }

  const lines: string[] = [];
  lines.push('');
  lines.push('=== Cost Report ===');
  lines.push(`Period: ${summary.period ?? 'N/A'}`);
  if (summary.periodStart) {
    lines.push(`From: ${new Date(summary.periodStart).toISOString()}`);
  }
  if (summary.periodEnd) {
    lines.push(`To:   ${new Date(summary.periodEnd).toISOString()}`);
  }
  lines.push('');
  lines.push(`Total Cost:     $${(summary.totalCostUsd ?? summary.totalUsd ?? 0).toFixed(6)}`);
  lines.push(`Total Calls:    ${summary.totalCalls ?? summary.totalApiCalls ?? 0}`);
  lines.push(`Input Tokens:   ${summary.totalInputTokens ?? 0}`);
  lines.push(`Output Tokens:  ${summary.totalOutputTokens ?? 0}`);
  lines.push(`Avg Cost/Call:  $${(summary.avgCostPerCall ?? 0).toFixed(6)}`);

  if (summary.byDimension) {
    for (const [dim, data] of Object.entries(summary.byDimension) as Array<
      [string, { totalCost: number; totalCalls: number }]
    >) {
      lines.push('');
      lines.push(`--- By ${dim} ---`);
      lines.push(`  Total Cost:  $${data.totalCost.toFixed(6)}`);
      lines.push(`  Total Calls: ${data.totalCalls}`);
    }
  }

  return lines.join('\n');
}

function replacer(key: string, value: unknown): unknown {
  if (typeof value === 'number' && key.endsWith('Usd')) {
    return parseFloat(value.toFixed(6));
  }
  return value;
}
