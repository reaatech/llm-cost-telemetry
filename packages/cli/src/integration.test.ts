/**
 * Integration tests — CLI commands
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetManager } from '@reaatech/llm-cost-telemetry-aggregation';
import { generateReport, formatReport } from './commands/report.command.js';
import { checkBudget, formatBudgetStatus } from './commands/check.command.js';
import {
  buildExportPayload,
  triggerExport,
  formatExportResult,
  type ExporterInterface,
} from './commands/export.command.js';
import type { ExportResult as BaseExportResult } from '@reaatech/llm-cost-telemetry-exporters';
import type { CostRecord } from '@reaatech/llm-cost-telemetry';
import { createSampleSpan, TEST_BUDGET_CONFIG } from './fixtures.js';

describe('Integration: CLI report command', () => {
  it('generates a JSON report', async () => {
    const span = createSampleSpan({
      tenant: 'cli-test',
      feature: 'cli-feature',
      costUsd: 0.01,
      inputTokens: 100,
      outputTokens: 50,
      telemetry: { tenant: 'cli-test', feature: 'cli-feature' },
    });

    const summary = await generateReport([span], {
      period: 'day',
      format: 'json',
      groupBy: ['tenant'],
    });

    expect(summary.totalCostUsd).toBeGreaterThanOrEqual(0.01);
    expect(summary.totalCalls).toBeGreaterThanOrEqual(1);
  });

  it('generates a table report with dimensions', async () => {
    const span = createSampleSpan({
      tenant: 'cli-test',
      feature: 'cli-feature',
      costUsd: 0.01,
      inputTokens: 100,
      outputTokens: 50,
      telemetry: { tenant: 'cli-test', feature: 'cli-feature', route: '/api/test' },
    });

    const summary = await generateReport([span], {
      period: 'day',
      format: 'table',
      groupBy: ['tenant', 'feature', 'route'],
    });

    const formatted = formatReport(summary, 'table');
    expect(formatted).toContain('Cost Report');
    expect(formatted).toContain('Total Cost:');
    expect(formatted).toContain('By tenant');
  });

  it('generates a report with start and end dates', async () => {
    const summary = await generateReport([createSampleSpan({ costUsd: 0.01 })], {
      period: 'day',
      format: 'json',
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-31T23:59:59Z',
    });

    expect(summary.periodStart).toBeDefined();
    expect(summary.periodEnd).toBeDefined();
  });

  it('generates a table report without byDimension', async () => {
    const summary = await generateReport([createSampleSpan({ costUsd: 0.01 })], {
      period: 'day',
      format: 'table',
    });

    const formatted = formatReport(summary, 'table');
    expect(formatted).toContain('Cost Report');
  });

  it('filters by tenant', async () => {
    const summary = await generateReport(
      [
        createSampleSpan({ tenant: 'tenant-a', costUsd: 0.01, telemetry: { tenant: 'tenant-a' } }),
        createSampleSpan({ tenant: 'tenant-b', costUsd: 0.02, telemetry: { tenant: 'tenant-b' } }),
      ],
      {
        period: 'day',
        format: 'json',
        tenant: 'tenant-a',
      },
    );

    expect(summary.totalCostUsd).toBe(0.01);
  });
});

describe('Integration: CLI check command', () => {
  let budgetManager: BudgetManager;

  beforeEach(() => {
    budgetManager = new BudgetManager(TEST_BUDGET_CONFIG);
  });

  it('checks budget status for a tenant', async () => {
    const status = await checkBudget(budgetManager, {
      tenant: 'tenant-a',
      threshold: 0.8,
    });

    expect(status.tenant).toBe('tenant-a');
    expect(status.withinBudget).toBe(true);
  });

  it('formats budget status as JSON', async () => {
    const status = await checkBudget(budgetManager, {
      tenant: 'tenant-a',
      threshold: 0.8,
    });

    const formatted = formatBudgetStatus(status, 'json');
    const parsed = JSON.parse(formatted);
    expect(parsed.tenant).toBe('tenant-a');
    expect(parsed.daily).toHaveProperty('limit');
    expect(parsed.monthly).toHaveProperty('limit');
  });

  it('formats budget status as text', async () => {
    const status = await checkBudget(budgetManager, {
      tenant: 'tenant-a',
      threshold: 0.8,
    });

    const formatted = formatBudgetStatus(status, 'text');
    expect(formatted).toContain('Budget Status:');
    expect(formatted).toContain('tenant-a');
  });

  it('marks budget as exceeded when threshold is crossed', async () => {
    await budgetManager.record({ tenant: 'tenant-a', cost: 45.0 });

    const status = await checkBudget(budgetManager, {
      tenant: 'tenant-a',
      threshold: 0.8,
    });

    expect(status.dailyPercentage).toBeGreaterThan(80);
    expect(status.withinBudget).toBe(false);
  });
});

describe('Integration: CLI export command', () => {
  it('builds export payload from spans', () => {
    const records = buildExportPayload([
      createSampleSpan({
        telemetry: { tenant: 'tenant-a', feature: 'chat', route: '/api/chat' },
      }),
    ]);

    expect(records.length).toBeGreaterThan(0);
  });

  it('triggers export and formats result', async () => {
    const mockExporter: ExporterInterface = {
      name: 'mock',
      exportRecords: async (_records: CostRecord[]): Promise<BaseExportResult> => ({
        success: 2,
        failed: 0,
      }),
    };

    const records: CostRecord[] = [
      { id: '1', totalCostUsd: 0.01, totalInputTokens: 100, totalOutputTokens: 50, totalCalls: 1 },
    ];

    const result = await triggerExport(mockExporter, records, {
      exporter: 'cloudwatch',
      period: 'hour',
    });

    expect(result.success).toBe(true);
    expect(result.recordsExported).toBe(2);
    expect(result.exporter).toBe('mock');
  });

  it('formats export result as JSON', async () => {
    const result = {
      exporter: 'cloudwatch',
      period: 'hour',
      recordsExported: 5,
      success: true,
      durationMs: 100,
      errors: [],
    };

    const formatted = formatExportResult(result, 'json');
    const parsed = JSON.parse(formatted);
    expect(parsed.exporter).toBe('cloudwatch');
    expect(parsed.recordsExported).toBe(5);
  });

  it('formats export result as text', async () => {
    const result = {
      exporter: 'phoenix',
      period: 'day',
      recordsExported: 10,
      success: false,
      durationMs: 200,
      errors: ['Connection failed'],
    };

    const formatted = formatExportResult(result, 'text');
    expect(formatted).toContain('Export Result');
    expect(formatted).toContain('FAILED');
    expect(formatted).toContain('Connection failed');
  });

  it('handles exporter errors', async () => {
    const mockExporter: ExporterInterface = {
      name: 'error-mock',
      exportRecords: async () => {
        throw new Error('Export failed');
      },
    };

    const result = await triggerExport(mockExporter, [], {
      exporter: 'phoenix',
      period: 'day',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});
