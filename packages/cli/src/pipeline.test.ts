/**
 * Integration tests — End-to-end cost tracking pipeline
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CostAggregator } from '@reaatech/llm-cost-telemetry-aggregation';
import { CostCollector } from '@reaatech/llm-cost-telemetry-aggregation';
import { BudgetManager } from '@reaatech/llm-cost-telemetry-aggregation';
import { calculateCost } from '@reaatech/llm-cost-telemetry-calculator';
import type { CostSpan } from '@reaatech/llm-cost-telemetry';
import {
  createSampleSpan,
  createMultiProviderSpans,
  TEST_BUDGET_CONFIG,
} from './fixtures.js';

describe('Integration: End-to-end cost tracking pipeline', () => {
  let aggregator: CostAggregator;
  let collector: CostCollector;
  let budgetManager: BudgetManager;
  let flushedSpans: CostSpan[];

  beforeEach(() => {
    flushedSpans = [];
    aggregator = new CostAggregator();
    collector = new CostCollector({
      maxBufferSize: 100,
      flushIntervalMs: 1000,
      onFlush: async (spans) => {
        flushedSpans.push(...spans);
        for (const span of spans) {
          aggregator.add(span);
        }
      },
    });
    budgetManager = new BudgetManager(TEST_BUDGET_CONFIG);
  });

  it('tracks costs from span creation through aggregation', async () => {
    const span = createSampleSpan({
      tenant: 'integration-test',
      costUsd: 0.005,
      inputTokens: 100,
      outputTokens: 50,
      telemetry: {
        tenant: 'integration-test',
        feature: 'test-feature',
        route: '/api/test',
      },
    });

    collector.add(span);
    await collector.flush();

    expect(flushedSpans).toHaveLength(1);
    expect(flushedSpans[0].spanId).toBe(span.spanId);

    const records = aggregator.getAll();
    expect(records.length).toBeGreaterThan(0);

    const summary = aggregator.getSummary({ period: 'day', groupBy: ['tenant'] });
    expect(summary.totalCostUsd).toBeGreaterThanOrEqual(0.005);
    expect(summary.totalCalls).toBeGreaterThanOrEqual(1);
  });

  it('aggregates costs across multiple tenants and features', async () => {
    const spans = createMultiProviderSpans();

    for (const span of spans) {
      collector.add(span);
    }
    await collector.flush();

    const summary = aggregator.getSummary({ period: 'day', groupBy: ['tenant', 'feature'] });
    expect(summary.totalCalls).toBeGreaterThanOrEqual(3);
    expect(summary.byDimension).toHaveProperty('tenant');
    expect(summary.byDimension).toHaveProperty('feature');
  });

  it('enforces budgets during cost tracking', async () => {
    const span = createSampleSpan({
      tenant: 'tenant-a',
      costUsd: 10.0,
    });

    const preCheck = await budgetManager.check({
      tenant: 'tenant-a',
      estimatedCost: 10.0,
    });
    expect(preCheck.withinBudget).toBe(true);

    collector.add(span);
    await collector.flush();

    await budgetManager.record({ tenant: 'tenant-a', cost: 10.0 });

    const postStatus = budgetManager.getStatus('tenant-a');
    expect(postStatus.dailySpent).toBeCloseTo(10.0, 4);
  });

  it('calculates costs accurately for different providers', () => {
    const openaiCost = calculateCost({
      provider: 'openai',
      model: 'gpt-4',
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(openaiCost.costUsd).toBeGreaterThan(0);

    const anthropicCost = calculateCost({
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(anthropicCost.costUsd).toBeGreaterThan(0);

    const googleCost = calculateCost({
      provider: 'google',
      model: 'gemini-pro',
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(googleCost.costUsd).toBeGreaterThanOrEqual(0);
  });
});

describe('Integration: Multi-provider cost calculation', () => {
  it('produces consistent costs across providers for same token counts', () => {
    const tokens = { inputTokens: 10000, outputTokens: 5000 };

    const openai = calculateCost({ provider: 'openai', model: 'gpt-4', ...tokens });
    const anthropic = calculateCost({
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
      ...tokens,
    });
    const google = calculateCost({ provider: 'google', model: 'gemini-pro', ...tokens });

    expect(openai.costUsd).toBeGreaterThan(0);
    expect(anthropic.costUsd).toBeGreaterThan(0);
    expect(google.costUsd).toBeGreaterThanOrEqual(0);

    expect(openai.costUsd).not.toBe(anthropic.costUsd);
    expect(anthropic.costUsd).not.toBe(google.costUsd);
  });

  it('handles cache-aware pricing for Anthropic', () => {
    const withoutCache = calculateCost({
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const withCache = calculateCost({
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 500,
      cacheCreationTokens: 500,
    });

    expect(withCache.costUsd).not.toBe(withoutCache.costUsd);
  });
});

describe('Integration: Exporter mock backend', () => {
  it('exports records through the base exporter interface', async () => {
    const { CloudWatchExporter } = await import('@reaatech/llm-cost-telemetry-exporters');
    const exporter = new CloudWatchExporter({
      enabled: false,
      region: 'us-east-1',
      namespace: 'Test/LLM',
      emfEnabled: false,
      logGroupName: '/test/llm',
      batchSize: 10,
    });

    const records = [
      { id: '1', totalCostUsd: 0.01, totalInputTokens: 100, totalOutputTokens: 50, totalCalls: 1 },
      { id: '2', totalCostUsd: 0.02, totalInputTokens: 200, totalOutputTokens: 100, totalCalls: 2 },
    ];

    const result = await exporter.exportRecords(records);
    expect(result.success).toBe(0);
    expect(result.failed).toBe(2);
  });

  it('handles exporter errors gracefully', async () => {
    const { PhoenixExporter } = await import('@reaatech/llm-cost-telemetry-exporters');
    const exporter = new PhoenixExporter({
      enabled: false,
      host: 'http://invalid-host:9999',
      defaultLabels: { service: 'test' },
      batchSize: 10,
    });

    const records = [
      { id: '1', totalCostUsd: 0.01, totalInputTokens: 100, totalOutputTokens: 50, totalCalls: 1 },
    ];

    const result = await exporter.exportRecords(records);
    expect(result.failed).toBe(1);
  });
});
