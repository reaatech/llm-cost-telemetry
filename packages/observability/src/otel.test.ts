import { describe, it, expect } from 'vitest';
import { MetricsManager } from '@reaatech/llm-cost-telemetry-observability';
import { TracingManager } from '@reaatech/llm-cost-telemetry-observability';
import type { CostSpan } from '@reaatech/llm-cost-telemetry';

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

describe('OpenTelemetry', () => {
  describe('MetricsManager', () => {
    it('should not initialize when disabled', () => {
      const manager = new MetricsManager({ enabled: false });
      manager.init();
      expect(manager.isEnabled).toBe(false);
    });

    it('should initialize when enabled', () => {
      const manager = new MetricsManager({ enabled: true });
      manager.init();
      expect(manager.isEnabled).toBe(true);
    });

    it('should not throw when recording without init', () => {
      const manager = new MetricsManager({ enabled: false });
      expect(() => manager.recordTokens(100, 50, 'openai', 'gpt-4')).not.toThrow();
      expect(() => manager.recordCost(0.01, 'openai', 'gpt-4')).not.toThrow();
      expect(() => manager.recordCall('openai', 'gpt-4')).not.toThrow();
      expect(() => manager.recordError('openai', 'gpt-4', 'timeout')).not.toThrow();
      expect(() => manager.recordBudgetUtilization('acme', 50)).not.toThrow();
    });

    it('should record tokens', () => {
      const manager = new MetricsManager({ enabled: true });
      manager.init();
      expect(() => manager.recordTokens(100, 50, 'openai', 'gpt-4', 'acme')).not.toThrow();
    });

    it('should record cost', () => {
      const manager = new MetricsManager({ enabled: true });
      manager.init();
      expect(() => manager.recordCost(0.05, 'openai', 'gpt-4', 'acme')).not.toThrow();
    });

    it('should record call', () => {
      const manager = new MetricsManager({ enabled: true });
      manager.init();
      expect(() => manager.recordCall('openai', 'gpt-4', 'success', 'acme')).not.toThrow();
    });

    it('should record error', () => {
      const manager = new MetricsManager({ enabled: true });
      manager.init();
      expect(() => manager.recordError('openai', 'gpt-4', 'rate_limit', 'acme')).not.toThrow();
    });

    it('should record budget utilization without throwing', () => {
      const manager = new MetricsManager({ enabled: true });
      manager.init();
      expect(() => manager.recordBudgetUtilization('acme', 75)).not.toThrow();
    });

    it('should record a cost span', () => {
      const manager = new MetricsManager({ enabled: true });
      manager.init();
      const span = createTestSpan({ telemetry: { tenant: 'acme' } });
      expect(() => manager.recordCostSpan(span)).not.toThrow();
    });

    it('should close and disable', async () => {
      const manager = new MetricsManager({ enabled: true });
      manager.init();
      expect(manager.isEnabled).toBe(true);

      await manager.close();
      expect(manager.isEnabled).toBe(false);
    });

    it('should handle close when not initialized', async () => {
      const manager = new MetricsManager({ enabled: false });
      await expect(manager.close()).resolves.toBeUndefined();
    });

    it('should apply default options', () => {
      const manager = new MetricsManager();
      expect(manager['options'].serviceName).toBe('llm-cost-telemetry');
      expect(manager['options'].exportIntervalMs).toBe(60000);
    });

    it('should merge custom options', () => {
      const manager = new MetricsManager({
        serviceName: 'custom-service',
        exportIntervalMs: 30000,
      });
      expect(manager['options'].serviceName).toBe('custom-service');
      expect(manager['options'].exportIntervalMs).toBe(30000);
    });
  });

  describe('TracingManager', () => {
    it('should not initialize when disabled', () => {
      const manager = new TracingManager({ enabled: false });
      manager.init();
      expect(manager.isEnabled).toBe(false);
    });

    it('should initialize when enabled', () => {
      const manager = new TracingManager({ enabled: true });
      manager.init();
      expect(manager.isEnabled).toBe(true);
    });

    it('should start a span', () => {
      const manager = new TracingManager({ enabled: true });
      manager.init();

      const span = manager.startSpan('test-span', { key: 'value' });
      expect(span).toBeDefined();
      span.end();
    });

    it('should record a cost span', () => {
      const manager = new TracingManager({ enabled: true });
      manager.init();

      const costSpan = createTestSpan({
        totalTokens: 150,
        durationMs: 100,
        cacheReadTokens: 10,
        cacheCreationTokens: 5,
        telemetry: { tenant: 'acme', feature: 'chat', route: '/api/chat' },
      });

      expect(() => manager.recordCostSpan(costSpan)).not.toThrow();
    });

    it('should get current context', () => {
      const manager = new TracingManager({ enabled: true });
      manager.init();

      const ctx = manager.getCurrentContext();
      expect(typeof ctx === 'string' || ctx === undefined).toBe(true);
    });

    it('should close and disable', async () => {
      const manager = new TracingManager({ enabled: true });
      manager.init();
      expect(manager.isEnabled).toBe(true);

      await manager.close();
      expect(manager.isEnabled).toBe(false);
    });

    it('should handle close when not initialized', async () => {
      const manager = new TracingManager({ enabled: false });
      await expect(manager.close()).resolves.toBeUndefined();
    });

    it('should apply default options', () => {
      const manager = new TracingManager();
      expect(manager['options'].serviceName).toBe('llm-cost-telemetry');
      expect(manager['options'].enabled).toBe(true);
    });

    it('should merge custom options', () => {
      const manager = new TracingManager({
        serviceName: 'custom-tracer',
        exporterEndpoint: 'http://custom:4318',
      });
      expect(manager['options'].serviceName).toBe('custom-tracer');
      expect(manager['options'].exporterEndpoint).toBe('http://custom:4318');
    });
  });
});
