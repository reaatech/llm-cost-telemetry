import type { CostRecord, CostSpan } from '@reaatech/llm-cost-telemetry';
import { BaseExporter } from '@reaatech/llm-cost-telemetry-exporters';
import { CloudWatchExporter } from '@reaatech/llm-cost-telemetry-exporters';
import { CloudMonitoringExporter } from '@reaatech/llm-cost-telemetry-exporters';
import { PhoenixExporter } from '@reaatech/llm-cost-telemetry-exporters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function createTestRecord(overrides: Partial<CostRecord> = {}): CostRecord {
  const now = new Date();
  return {
    id: overrides.id ?? 'test-record',
    dimension: overrides.dimension ?? 'tenant',
    value: overrides.value ?? 'acme-corp',
    window: overrides.window ?? 'day',
    windowStart: overrides.windowStart ?? now,
    windowEnd: overrides.windowEnd ?? now,
    totalCostUsd: overrides.totalCostUsd ?? 0.05,
    totalInputTokens: overrides.totalInputTokens ?? 500,
    totalOutputTokens: overrides.totalOutputTokens ?? 250,
    totalCalls: overrides.totalCalls ?? 10,
    spanCount: overrides.spanCount ?? 10,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

class TestExporter extends BaseExporter {
  get name(): string {
    return 'test';
  }

  exportSpans = vi.fn().mockResolvedValue({ success: 0, failed: 0 });
  exportRecords = vi.fn().mockResolvedValue({ success: 0, failed: 0 });
}

describe('Exporters', () => {
  describe('BaseExporter', () => {
    it('should apply default options', () => {
      const exporter = new TestExporter();
      expect(exporter.isEnabled).toBe(true);
      expect(exporter.batchSize).toBe(100);
    });

    it('should accept custom options', () => {
      const exporter = new TestExporter({ enabled: false, batchSize: 50 });
      expect(exporter.isEnabled).toBe(false);
      expect(exporter.batchSize).toBe(50);
    });

    it('should report health based on state', async () => {
      const exporter = new TestExporter({ enabled: true });
      expect(await exporter.healthCheck()).toBe(true);

      await exporter.close();
      expect(await exporter.healthCheck()).toBe(false);
    });

    it('should mark as closed on close', async () => {
      const exporter = new TestExporter();
      expect(exporter.isEnabled).toBe(true);
      await exporter.close();
      expect(exporter.isEnabled).toBe(false);
    });

    it('should return disabled result when not enabled', async () => {
      const exporter = new TestExporter({ enabled: false });
      const result = await exporter.exportWithRetry([createTestSpan()]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.error).toContain('disabled');
    });

    it('should return disabled result when closed', async () => {
      const exporter = new TestExporter();
      await exporter.close();
      const result = await exporter.exportWithRetry([createTestSpan()]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should return error result when already flushing', async () => {
      const exporter = new TestExporter();
      let resolveFirst: () => void;

      exporter.exportSpans.mockReturnValueOnce(
        new Promise<void>((r) => {
          resolveFirst = r;
        }),
      );

      const first = exporter.exportWithRetry([createTestSpan()]);
      const second = exporter.exportWithRetry([createTestSpan()]);

      resolveFirst?.();

      const secondResult = await second;
      expect(secondResult.error).toContain('flushing');

      await first;
    });

    it('should retry on failure', async () => {
      const exporter = new TestExporter({
        retry: { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 10, backoffMultiplier: 2 },
      });

      exporter.exportSpans
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockResolvedValueOnce({ success: 1, failed: 0 });

      const result = await exporter.exportWithRetry([createTestSpan()]);
      expect(result.success).toBe(1);
    });

    it('should return error after exhausting retries', async () => {
      const exporter = new TestExporter({
        retry: { maxRetries: 1, initialDelayMs: 1, maxDelayMs: 10, backoffMultiplier: 2 },
      });

      exporter.exportSpans.mockRejectedValue(new Error('always fail'));

      const result = await exporter.exportWithRetry([createTestSpan()]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.error).toContain('always fail');
    });
  });

  describe('CloudWatchExporter', () => {
    it('should export spans to CloudWatch', async () => {
      const exporter = new CloudWatchExporter({ region: 'us-east-1' });

      const sendSpy = vi.spyOn(exporter.client, 'send').mockResolvedValue({} as unknown);

      const spans = [createTestSpan({ telemetry: { tenant: 'acme', feature: 'chat' } })];

      const result = await exporter.exportSpans(spans);
      expect(result.success).toBe(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle export failures', async () => {
      const exporter = new CloudWatchExporter({ region: 'us-east-1' });
      vi.spyOn(exporter.client, 'send').mockRejectedValue(new Error('AWS error'));

      const result = await exporter.exportSpans([createTestSpan()]);
      expect(result.failed).toBe(1);
      expect(result.success).toBe(0);
    });

    it('should return empty result for empty spans', async () => {
      const exporter = new CloudWatchExporter();
      const result = await exporter.exportSpans([]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should export records to CloudWatch', async () => {
      const exporter = new CloudWatchExporter({ region: 'us-east-1' });
      const sendSpy = vi.spyOn(exporter.client, 'send').mockResolvedValue({} as unknown);

      const records = [createTestRecord()];
      const result = await exporter.exportRecords(records);
      expect(result.success).toBe(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle record export failures', async () => {
      const exporter = new CloudWatchExporter({ region: 'us-east-1' });
      vi.spyOn(exporter.client, 'send').mockRejectedValue(new Error('fail'));

      const result = await exporter.exportRecords([createTestRecord()]);
      expect(result.failed).toBe(1);
    });

    it('should return empty result for empty records', async () => {
      const exporter = new CloudWatchExporter();
      const result = await exporter.exportRecords([]);
      expect(result.success).toBe(0);
    });

    it('should have correct name', () => {
      const exporter = new CloudWatchExporter();
      expect(exporter.name).toBe('cloudwatch');
    });

    it('should accept credentials', () => {
      const exporter = new CloudWatchExporter({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      });
      expect(exporter.name).toBe('cloudwatch');
    });
  });

  describe('CloudMonitoringExporter', () => {
    it('should export spans to Cloud Monitoring', async () => {
      const exporter = new CloudMonitoringExporter({ projectId: 'test-project' });
      const createTimeSeriesSpy = vi
        .spyOn(exporter.client, 'createTimeSeries')
        .mockResolvedValue({} as unknown);

      const spans = [createTestSpan({ telemetry: { tenant: 'acme' } })];

      const result = await exporter.exportSpans(spans);
      expect(result.success).toBe(1);
      expect(createTimeSeriesSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle export failures', async () => {
      const exporter = new CloudMonitoringExporter({ projectId: 'test-project' });
      vi.spyOn(exporter.client, 'createTimeSeries').mockRejectedValue(new Error('GCP error'));

      const result = await exporter.exportSpans([createTestSpan()]);
      expect(result.failed).toBe(1);
    });

    it('should return empty result for empty spans', async () => {
      const exporter = new CloudMonitoringExporter();
      const result = await exporter.exportSpans([]);
      expect(result.success).toBe(0);
    });

    it('should export records to Cloud Monitoring', async () => {
      const exporter = new CloudMonitoringExporter({ projectId: 'test-project' });
      vi.spyOn(exporter.client, 'createTimeSeries').mockResolvedValue({} as unknown);

      const records = [createTestRecord()];
      const result = await exporter.exportRecords(records);
      expect(result.success).toBe(1);
    });

    it('should handle record export failures', async () => {
      const exporter = new CloudMonitoringExporter({ projectId: 'test-project' });
      vi.spyOn(exporter.client, 'createTimeSeries').mockRejectedValue(new Error('fail'));

      const result = await exporter.exportRecords([createTestRecord()]);
      expect(result.failed).toBe(1);
    });

    it('should return empty result for empty records', async () => {
      const exporter = new CloudMonitoringExporter();
      const result = await exporter.exportRecords([]);
      expect(result.success).toBe(0);
    });

    it('should have correct name', () => {
      const exporter = new CloudMonitoringExporter();
      expect(exporter.name).toBe('cloud-monitoring');
    });

    it('should use default project name when no projectId', () => {
      const exporter = new CloudMonitoringExporter();
      expect(exporter.projectName).toBe('projects/your-project-id');
    });
  });

  describe('PhoenixExporter', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
      } as Response);
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should export spans to Loki', async () => {
      const exporter = new PhoenixExporter({ host: 'http://loki:3100' });
      const spans = [createTestSpan()];

      const result = await exporter.exportSpans(spans);
      expect(result.success).toBe(1);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle export failures', async () => {
      const exporter = new PhoenixExporter();
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error'),
      );

      const result = await exporter.exportSpans([createTestSpan()]);
      expect(result.failed).toBe(1);
    });

    it('should return empty result for empty spans', async () => {
      const exporter = new PhoenixExporter();
      const result = await exporter.exportSpans([]);
      expect(result.success).toBe(0);
    });

    it('should export records to Loki', async () => {
      const exporter = new PhoenixExporter();
      const records = [createTestRecord()];

      const result = await exporter.exportRecords(records);
      expect(result.success).toBe(1);
    });

    it('should handle record export failures', async () => {
      const exporter = new PhoenixExporter();
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

      const result = await exporter.exportRecords([createTestRecord()]);
      expect(result.failed).toBe(1);
    });

    it('should include auth headers when configured', async () => {
      const exporter = new PhoenixExporter({
        username: 'admin',
        password: 'secret',
      });

      await exporter.exportSpans([createTestSpan()]);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = fetchCall[1].headers as Record<string, string>;
      expect(headers.Authorization).toContain('Basic');
    });

    it('should throw on non-ok response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const exporter = new PhoenixExporter();
      const result = await exporter.exportSpans([createTestSpan()]);
      expect(result.failed).toBe(1);
    });

    it('should have correct name', () => {
      const exporter = new PhoenixExporter();
      expect(exporter.name).toBe('phoenix');
    });
  });
});
