import { createCostTelemetryServer } from '@reaatech/llm-cost-telemetry-mcp';
import { describe, expect, it, vi } from 'vitest';

const mockBudgetConfig = {
  global: { daily: 100, monthly: 2000 },
  tenants: {},
  alerts: [
    { threshold: 0.5, action: 'log' as const },
    { threshold: 0.75, action: 'notify' as const },
    { threshold: 0.9, action: 'block' as const },
  ],
};

async function callTool(
  server: ReturnType<typeof createCostTelemetryServer>,
  name: string,
  args: Record<string, unknown>,
) {
  return (server as unknown)._requestHandlers?.get?.('tools/call')?.({
    method: 'tools/call',
    params: { name, arguments: args },
  });
}

describe('MCP Server', () => {
  describe('createCostTelemetryServer', () => {
    it('should create an MCP server instance', () => {
      const server = createCostTelemetryServer({ budgetConfig: mockBudgetConfig });
      expect(server).toBeDefined();
    });

    it('should create server with default options', () => {
      const server = createCostTelemetryServer();
      expect(server).toBeDefined();
    });

    it('should create server with custom collector options', () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
        collectorOptions: { maxBufferSize: 500, flushIntervalMs: 30000 },
      });
      expect(server).toBeDefined();
    });

    it('should create server with custom aggregator options', () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
        aggregatorOptions: { dimensions: ['tenant'], timeWindows: ['day'] },
      });
      expect(server).toBeDefined();
    });

    it('should create server with onSpanFlush callback', () => {
      const onFlush = vi.fn();
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
        onSpanFlush: onFlush,
      });
      expect(server).toBeDefined();
    });
  });

  describe('ListTools handler', () => {
    it('should return all tool schemas', async () => {
      const server = createCostTelemetryServer({ budgetConfig: mockBudgetConfig });
      const handler = (server as unknown)._requestHandlers?.get?.('tools/list');
      if (handler) {
        const result = await handler({ method: 'tools/list', params: {} });
        expect(result.tools).toBeDefined();
        expect(result.tools.length).toBeGreaterThan(0);
        const toolNames = result.tools.map((t: { name: string }) => t.name);
        expect(toolNames).toContain('cost.span.record');
        expect(toolNames).toContain('cost.span.get');
        expect(toolNames).toContain('cost.span.flush');
        expect(toolNames).toContain('cost.aggregate.by_tenant');
        expect(toolNames).toContain('cost.aggregate.by_feature');
        expect(toolNames).toContain('cost.aggregate.by_route');
        expect(toolNames).toContain('cost.aggregate.summary');
        expect(toolNames).toContain('cost.budget.check');
        expect(toolNames).toContain('cost.budget.set');
        expect(toolNames).toContain('cost.budget.alert');
      }
    });
  });

  describe('CallTool handler', () => {
    it('should handle cost.span.record', async () => {
      const onFlush = vi.fn();
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
        collectorOptions: { maxBufferSize: 1000, flushIntervalMs: 600000 },
        onSpanFlush: onFlush,
      });

      const response = await callTool(server, 'cost.span.record', {
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        tenant: 'acme-corp',
        feature: 'chat',
      });

      if (response) {
        const text = response.content?.[0]?.text;
        expect(text).toContain('span_id');
        expect(text).toContain('recorded');
      }
    });

    it('should handle cost.span.record with cache tokens', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
        collectorOptions: { maxBufferSize: 1000, flushIntervalMs: 600000 },
      });

      const response = await callTool(server, 'cost.span.record', {
        provider: 'anthropic',
        model: 'claude-opus-20240229',
        inputTokens: 200,
        outputTokens: 100,
        cacheReadTokens: 50,
        cacheCreationTokens: 30,
      });

      if (response) {
        const text = response.content?.[0]?.text;
        expect(text).toContain('span_id');
      }
    });

    it('should handle cost.span.get for existing span', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
        collectorOptions: { maxBufferSize: 1000, flushIntervalMs: 600000 },
      });

      const recordResponse = await callTool(server, 'cost.span.record', {
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
      });

      const recordResponseText = recordResponse?.content?.[0]?.text;
      if (recordResponseText) {
        const { span_id: spanId } = JSON.parse(recordResponseText) as { span_id: string };
        const response = await callTool(server, 'cost.span.get', { spanId });
        if (response) {
          const text = response.content?.[0]?.text;
          expect(text).toContain(spanId);
        }
      }
    });

    it('should keep spans retrievable after flush', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
        collectorOptions: { maxBufferSize: 1000, flushIntervalMs: 600000 },
      });

      const recordResponse = await callTool(server, 'cost.span.record', {
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        tenant: 'tenant-a',
      });

      await callTool(server, 'cost.span.flush', {});

      const recordResponseText = recordResponse?.content?.[0]?.text;
      if (recordResponseText) {
        const { span_id: spanId } = JSON.parse(recordResponseText) as { span_id: string };
        const response = await callTool(server, 'cost.span.get', { spanId });
        expect(response?.isError).not.toBe(true);
        const text = response?.content?.[0]?.text;
        expect(text).toContain(spanId);
      }
    });

    it('should handle cost.span.get for missing span', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
      });

      const response = await callTool(server, 'cost.span.get', { spanId: 'nonexistent' });
      if (response) {
        expect(response.isError).toBe(true);
        const text = response.content?.[0]?.text;
        expect(text).toContain('not found');
      }
    });

    it('should handle cost.span.flush', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
      });

      await callTool(server, 'cost.span.record', {
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
      });

      const response = await callTool(server, 'cost.span.flush', {});
      if (response) {
        const text = response.content?.[0]?.text;
        expect(text).toContain('flushed');
      }
    });

    it('should handle cost.aggregate.by_tenant', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
      });

      await callTool(server, 'cost.span.record', {
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        tenant: 'tenant-a',
      });

      await callTool(server, 'cost.span.flush', {});

      const response = await callTool(server, 'cost.aggregate.by_tenant', {
        tenant: 'tenant-a',
        period: 'day',
      });

      if (response) {
        const text = response.content?.[0]?.text;
        expect(text).toBeDefined();
      }
    });

    it('should handle cost.aggregate.by_feature', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
      });

      await callTool(server, 'cost.span.record', {
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        feature: 'summarization',
      });

      await callTool(server, 'cost.span.flush', {});

      const response = await callTool(server, 'cost.aggregate.by_feature', {
        feature: 'summarization',
        period: 'day',
      });

      if (response) {
        const text = response.content?.[0]?.text;
        expect(text).toBeDefined();
      }
    });

    it('should handle cost.aggregate.by_route', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
      });

      await callTool(server, 'cost.span.record', {
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        route: '/api/chat',
      });

      await callTool(server, 'cost.span.flush', {});

      const response = await callTool(server, 'cost.aggregate.by_route', {
        route: '/api/chat',
        period: 'day',
      });

      if (response) {
        const text = response.content?.[0]?.text;
        expect(text).toBeDefined();
      }
    });

    it('should handle cost.aggregate.summary', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
      });

      await callTool(server, 'cost.span.record', {
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        tenant: 'tenant-a',
      });

      await callTool(server, 'cost.span.flush', {});

      const response = await callTool(server, 'cost.aggregate.summary', {
        period: 'day',
        groupBy: ['tenant'],
      });

      if (response) {
        const text = response.content?.[0]?.text;
        expect(text).toContain('summary');
      }
    });

    it('should support provider and model grouping with default server options', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
      });

      await callTool(server, 'cost.span.record', {
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        tenant: 'tenant-a',
      });

      await callTool(server, 'cost.span.flush', {});

      const response = await callTool(server, 'cost.aggregate.summary', {
        period: 'day',
        groupBy: ['provider', 'model'],
      });

      expect(response).toBeDefined();
      const text = response?.content?.[0]?.text;
      expect(text).toBeDefined();
      expect(text).toContain('"provider"');
      expect(text).toContain('"model"');
    });

    it('should handle cost.budget.check', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
      });

      const response = await callTool(server, 'cost.budget.check', {
        tenant: 'acme-corp',
        estimatedCost: 5.0,
      });

      if (response) {
        const text = response.content?.[0]?.text;
        expect(text).toBeDefined();
        expect(text).toContain('withinBudget');
      }
    });

    it('should handle cost.budget.set', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
      });

      const response = await callTool(server, 'cost.budget.set', {
        tenant: 'acme-corp',
        daily: 50,
        monthly: 1000,
      });

      if (response) {
        const text = response.content?.[0]?.text;
        expect(text).toContain('success');
      }
    });

    it('should handle cost.budget.alert', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: { ...mockBudgetConfig, alerts: [] },
      });

      const response = await callTool(server, 'cost.budget.alert', {
        threshold: 0.8,
        action: 'notify',
      });

      if (response) {
        const text = response.content?.[0]?.text;
        expect(text).toContain('success');
      }
    });

    it('should handle unknown tool', async () => {
      const server = createCostTelemetryServer({
        budgetConfig: mockBudgetConfig,
      });

      const response = await callTool(server, 'unknown.tool', {});

      if (response) {
        expect(response.isError).toBe(true);
        const text = response.content?.[0]?.text;
        expect(text).toContain('Unknown tool');
      }
    });
  });
});
