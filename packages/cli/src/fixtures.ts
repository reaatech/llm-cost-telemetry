/**
 * Test fixtures — sample cost spans for integration tests
 */
import type { CostSpan, CostRecord, BudgetConfig } from '@reaatech/llm-cost-telemetry';

export function createSampleSpan(overrides: Partial<CostSpan> = {}): CostSpan {
  return {
    spanId: `span-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    provider: 'openai',
    model: 'gpt-4',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costUsd: 0.0045,
    status: 'success',
    timestamp: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    durationMs: 250,
    telemetry: {
      tenant: 'test-tenant',
      feature: 'test-feature',
      route: '/api/test',
    },
    ...overrides,
  };
}

export function createMultiProviderSpans(): CostSpan[] {
  return [
    createSampleSpan({
      provider: 'openai',
      model: 'gpt-4',
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.0045,
      telemetry: { tenant: 'tenant-a', feature: 'chat', route: '/api/chat' },
    }),
    createSampleSpan({
      provider: 'anthropic',
      model: 'claude-opus-20240229',
      inputTokens: 200,
      outputTokens: 100,
      costUsd: 0.03,
      telemetry: { tenant: 'tenant-b', feature: 'summarization', route: '/api/summarize' },
    }),
    createSampleSpan({
      provider: 'google',
      model: 'gemini-pro',
      inputTokens: 150,
      outputTokens: 75,
      costUsd: 0.0015,
      telemetry: { tenant: 'tenant-a', feature: 'chat', route: '/api/chat' },
    }),
  ];
}

export function createSampleRecord(overrides: Partial<CostRecord> = {}): CostRecord {
  return {
    id: `record-${Date.now()}`,
    totalCostUsd: 0.01,
    totalInputTokens: 100,
    totalOutputTokens: 50,
    totalCalls: 1,
    dimension: 'tenant',
    value: 'test-tenant',
    window: 'day',
    windowStart: new Date(),
    windowEnd: new Date(),
    ...overrides,
  };
}

export const TEST_BUDGET_CONFIG: BudgetConfig = {
  global: {
    daily: 100.0,
    monthly: 2000.0,
  },
  tenants: {
    'tenant-a': { daily: 50.0, monthly: 1000.0 },
    'tenant-b': { daily: 25.0, monthly: 500.0 },
  },
  alerts: [
    { threshold: 0.5, action: 'log' },
    { threshold: 0.75, action: 'notify' },
    { threshold: 0.9, action: 'block' },
  ],
};
