/**
 * Unit tests for aggregation engine
 */
import { describe, it, expect } from 'vitest';
import { CostCollector } from '../../src/aggregation/collector.js';
import { CostAggregator } from '../../src/aggregation/aggregator.js';
import type { CostSpan } from '../../src/types/index.js';

/**
 * Helper to create a test span with all required fields
 */
function createTestSpan(overrides: Partial<CostSpan> = {}): CostSpan {
  const now = new Date();
  return {
    id: overrides.id ?? 'test-span',
    spanId: overrides.spanId ?? 'test-span-id',
    timestamp: overrides.timestamp ?? now,
    provider: overrides.provider ?? 'openai',
    model: overrides.model ?? 'gpt-4',
    inputTokens: overrides.inputTokens ?? 100,
    outputTokens: overrides.outputTokens ?? 50,
    totalTokens: overrides.totalTokens ?? 150,
    costUsd: overrides.costUsd ?? 0.01,
    startTime: overrides.startTime ?? now,
    endTime: overrides.endTime ?? now,
    durationMs: overrides.durationMs ?? 100,
    status: overrides.status ?? 'ok',
    telemetry: overrides.telemetry,
    metadata: overrides.metadata ?? { estimated: false },
  };
}

describe('Aggregation Engine', () => {
  describe('CostCollector', () => {
    it('should collect spans in buffer', () => {
      const collector = new CostCollector({ maxBufferSize: 100 });

      const span = createTestSpan({
        id: 'test-1',
        telemetry: { tenant: 'test-tenant' },
      });

      collector.add(span);

      expect(collector.size).toBe(1);
      expect(collector.getSpans()).toHaveLength(1);
    });

    it('should auto-flush when buffer is full', async () => {
      let flushedSpans: CostSpan[] = [];

      const collector = new CostCollector({
        maxBufferSize: 3,
        onFlush: (spans) => {
          flushedSpans = spans;
        },
      });

      for (let i = 0; i < 3; i++) {
        collector.add(createTestSpan({ id: `test-${i}` }));
      }

      // Buffer should be flushed
      expect(flushedSpans).toHaveLength(3);
      expect(collector.size).toBe(0);

      await collector.close();
    });

    it('should throw when adding to closed collector', async () => {
      const collector = new CostCollector();
      await collector.close();

      expect(() => {
        collector.add(createTestSpan({ id: 'test' }));
      }).toThrow('Collector is closed');
    });

    it('should flush remaining spans on close', async () => {
      let flushedSpans: CostSpan[] = [];

      const collector = new CostCollector({
        onFlush: (spans) => {
          flushedSpans = spans;
        },
      });

      collector.add(createTestSpan({ id: 'test-1' }));

      await collector.close();

      expect(flushedSpans).toHaveLength(1);
    });
  });

  describe('CostAggregator', () => {
    it('should aggregate costs by tenant', () => {
      const aggregator = new CostAggregator();

      const span1 = createTestSpan({
        id: 'test-1',
        telemetry: { tenant: 'tenant-a' },
      });

      const span2 = createTestSpan({
        id: 'test-2',
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
        costUsd: 0.02,
        telemetry: { tenant: 'tenant-a' },
      });

      aggregator.add(span1);
      aggregator.add(span2);

      const records = aggregator.getByTenant('tenant-a');
      expect(records.length).toBeGreaterThan(0);

      const summary = aggregator.getSummary({ groupBy: ['tenant'] });
      expect(summary.totalCalls).toBe(2);
    });

    it('should aggregate costs by feature', () => {
      const aggregator = new CostAggregator();

      const span = createTestSpan({
        id: 'test-1',
        telemetry: { feature: 'chat' },
      });

      aggregator.add(span);

      const records = aggregator.getByFeature('chat');
      expect(records.length).toBeGreaterThan(0);
    });

    it('should aggregate costs by route', () => {
      const aggregator = new CostAggregator();

      const span = createTestSpan({
        id: 'test-1',
        telemetry: { route: '/api/chat' },
      });

      aggregator.add(span);

      const records = aggregator.getByRoute('/api/chat');
      expect(records.length).toBeGreaterThan(0);
    });

    it('should get cost summary', () => {
      const aggregator = new CostAggregator();

      const span = createTestSpan({
        id: 'test-1',
        telemetry: { tenant: 'tenant-a', feature: 'chat' },
      });

      aggregator.add(span);

      const summary = aggregator.getSummary({ period: 'day', groupBy: ['tenant', 'feature'] });

      expect(summary.totalCostUsd).toBeGreaterThan(0);
      expect(summary.totalCalls).toBe(1);
      expect(summary.byDimension).toBeDefined();
    });

    it('should not double count spans across dimensions in summaries', () => {
      const aggregator = new CostAggregator();

      aggregator.add(
        createTestSpan({
          id: 'test-1',
          costUsd: 0.01,
          telemetry: { tenant: 'tenant-a', feature: 'chat', route: '/api/chat' },
        }),
      );

      const summary = aggregator.getSummary({
        period: 'day',
        groupBy: ['tenant', 'feature', 'route'],
      });

      expect(summary.totalCostUsd).toBe(0.01);
      expect(summary.totalCalls).toBe(1);
    });

    it('should filter tenant summaries without leaking other dimensions', () => {
      const aggregator = new CostAggregator();

      aggregator.add(
        createTestSpan({
          id: 'tenant-a',
          costUsd: 0.01,
          telemetry: { tenant: 'tenant-a', feature: 'chat', route: '/api/chat' },
        }),
      );
      aggregator.add(
        createTestSpan({
          id: 'tenant-b',
          costUsd: 0.02,
          telemetry: { tenant: 'tenant-b', feature: 'search', route: '/api/search' },
        }),
      );

      const summary = aggregator.getSummary({
        period: 'day',
        groupBy: ['tenant'],
        tenant: 'tenant-a',
      });

      expect(summary.totalCostUsd).toBe(0.01);
      expect(summary.totalCalls).toBe(1);
    });

    it('should clear all records', () => {
      const aggregator = new CostAggregator();

      const span = createTestSpan({
        id: 'test-1',
        telemetry: { tenant: 'tenant-a' },
      });

      aggregator.add(span);
      expect(aggregator.size).toBeGreaterThan(0);

      aggregator.clear();
      expect(aggregator.size).toBe(0);
    });
  });
});
