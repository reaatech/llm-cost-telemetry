import {
  AggregationDimensionSchema,
  AlertActionSchema,
  AlertConfigSchema,
  BudgetConfigSchema,
  BudgetLimitsSchema,
  BudgetPeriodSchema,
  CallStatusSchema,
  CloudMonitoringConfigSchema,
  CloudWatchConfigSchema,
  CostBreakdownSchema,
  CostEstimateRequestSchema,
  CostEstimateResultSchema,
  ExportConfigSchema,
  PhoenixConfigSchema,
  PricingTierSchema,
  ProviderSchema,
  RetryConfigSchema,
  TelemetryConfigSchema,
  TelemetryContextSchema,
  TimeWindowSchema,
} from '@reaatech/llm-cost-telemetry';
import { describe, expect, it } from 'vitest';

describe('Zod Schemas', () => {
  describe('ProviderSchema', () => {
    it('should accept valid providers', () => {
      expect(ProviderSchema.parse('openai')).toBe('openai');
      expect(ProviderSchema.parse('anthropic')).toBe('anthropic');
      expect(ProviderSchema.parse('google')).toBe('google');
    });

    it('should reject invalid provider', () => {
      expect(() => ProviderSchema.parse('invalid')).toThrow();
    });
  });

  describe('TimeWindowSchema', () => {
    it('should accept valid time windows', () => {
      for (const w of ['minute', 'hour', 'day', 'week', 'month']) {
        expect(TimeWindowSchema.parse(w)).toBe(w);
      }
    });

    it('should reject invalid time window', () => {
      expect(() => TimeWindowSchema.parse('year')).toThrow();
    });
  });

  describe('AggregationDimensionSchema', () => {
    it('should accept valid dimensions', () => {
      for (const d of ['tenant', 'feature', 'route', 'model', 'provider']) {
        expect(AggregationDimensionSchema.parse(d)).toBe(d);
      }
    });
  });

  describe('AlertActionSchema', () => {
    it('should accept valid actions', () => {
      expect(AlertActionSchema.parse('log')).toBe('log');
      expect(AlertActionSchema.parse('notify')).toBe('notify');
      expect(AlertActionSchema.parse('block')).toBe('block');
    });
  });

  describe('BudgetPeriodSchema', () => {
    it('should accept valid periods', () => {
      expect(BudgetPeriodSchema.parse('daily')).toBe('daily');
      expect(BudgetPeriodSchema.parse('monthly')).toBe('monthly');
    });
  });

  describe('CallStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(CallStatusSchema.parse('success')).toBe('success');
      expect(CallStatusSchema.parse('error')).toBe('error');
    });
  });

  describe('CostBreakdownSchema', () => {
    it('should parse valid breakdown', () => {
      const result = CostBreakdownSchema.parse({
        inputCostUsd: 0.01,
        outputCostUsd: 0.02,
      });
      expect(result.inputCostUsd).toBe(0.01);
      expect(result.outputCostUsd).toBe(0.02);
    });

    it('should include optional cache fields', () => {
      const result = CostBreakdownSchema.parse({
        inputCostUsd: 0.01,
        outputCostUsd: 0.02,
        cacheReadCostUsd: 0.005,
        cacheCreationCostUsd: 0.003,
      });
      expect(result.cacheReadCostUsd).toBe(0.005);
    });

    it('should reject negative costs', () => {
      expect(() => CostBreakdownSchema.parse({ inputCostUsd: -1, outputCostUsd: 0 })).toThrow();
    });
  });

  describe('RetryConfigSchema', () => {
    it('should parse valid config', () => {
      const result = RetryConfigSchema.parse({
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
      });
      expect(result.maxRetries).toBe(3);
    });

    it('should reject backoffMultiplier < 1', () => {
      expect(() =>
        RetryConfigSchema.parse({
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 0.5,
        }),
      ).toThrow();
    });
  });

  describe('TelemetryConfigSchema', () => {
    it('should parse valid config', () => {
      const result = TelemetryConfigSchema.parse({
        serviceName: 'test-service',
        tracingEnabled: true,
        metricsEnabled: false,
      });
      expect(result.serviceName).toBe('test-service');
      expect(result.tracingEnabled).toBe(true);
    });

    it('should reject empty serviceName', () => {
      expect(() =>
        TelemetryConfigSchema.parse({
          serviceName: '',
          tracingEnabled: true,
          metricsEnabled: true,
        }),
      ).toThrow();
    });

    it('should accept optional fields', () => {
      const result = TelemetryConfigSchema.parse({
        serviceName: 'test',
        tracingEnabled: true,
        metricsEnabled: true,
        traceSampleRate: 0.5,
        resourceAttributes: { region: 'us-east-1' },
      });
      expect(result.traceSampleRate).toBe(0.5);
    });
  });

  describe('BudgetLimitsSchema', () => {
    it('should parse valid limits', () => {
      const result = BudgetLimitsSchema.parse({ daily: 100, monthly: 2000 });
      expect(result.daily).toBe(100);
      expect(result.monthly).toBe(2000);
    });

    it('should accept partial limits', () => {
      const result = BudgetLimitsSchema.parse({ daily: 100 });
      expect(result.daily).toBe(100);
      expect(result.monthly).toBeUndefined();
    });
  });

  describe('BudgetConfigSchema', () => {
    it('should parse valid config', () => {
      const result = BudgetConfigSchema.parse({
        global: { daily: 100, monthly: 2000 },
        tenants: { acme: { daily: 50 } },
        alerts: [{ threshold: 0.8, action: 'log' }],
      });
      expect(result.global?.daily).toBe(100);
    });

    it('should work without global', () => {
      const result = BudgetConfigSchema.parse({
        tenants: {},
        alerts: [],
      });
      expect(result.global).toBeUndefined();
    });
  });

  describe('TelemetryContextSchema', () => {
    it('should parse valid context', () => {
      const result = TelemetryContextSchema.parse({
        tenant: 'acme',
        feature: 'chat',
      });
      expect(result.tenant).toBe('acme');
    });

    it('should accept empty context', () => {
      const result = TelemetryContextSchema.parse({});
      expect(result.tenant).toBeUndefined();
    });
  });

  describe('CostEstimateRequestSchema', () => {
    it('should parse valid request', () => {
      const result = CostEstimateRequestSchema.parse({
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 100,
      });
      expect(result.provider).toBe('openai');
    });
  });

  describe('CostEstimateResultSchema', () => {
    it('should parse valid result', () => {
      const result = CostEstimateResultSchema.parse({
        usd: 0.05,
        inputTokens: 100,
        outputTokens: 50,
        confidence: 0.9,
      });
      expect(result.usd).toBe(0.05);
    });
  });

  describe('CloudWatchConfigSchema', () => {
    it('should parse valid config', () => {
      const result = CloudWatchConfigSchema.parse({
        type: 'cloudwatch',
        enabled: true,
        batchSize: 20,
        flushInterval: 60000,
        region: 'us-east-1',
        namespace: 'LLM/Costs',
        emfEnabled: true,
        logGroupName: '/aws/llm/costs',
      });
      expect(result.type).toBe('cloudwatch');
      expect(result.region).toBe('us-east-1');
    });

    it('should reject wrong type', () => {
      expect(() =>
        CloudWatchConfigSchema.parse({
          type: 'phoenix',
          enabled: true,
          batchSize: 20,
          flushInterval: 60000,
          region: 'us-east-1',
          namespace: 'LLM/Costs',
          emfEnabled: true,
          logGroupName: '/aws/llm/costs',
        }),
      ).toThrow();
    });
  });

  describe('CloudMonitoringConfigSchema', () => {
    it('should parse valid config', () => {
      const result = CloudMonitoringConfigSchema.parse({
        type: 'cloud-monitoring',
        enabled: false,
        batchSize: 200,
        flushInterval: 60000,
        projectId: 'my-project',
        metricTypePrefix: 'custom.googleapis.com/llm',
        resourceType: 'gce_instance',
      });
      expect(result.type).toBe('cloud-monitoring');
    });
  });

  describe('PhoenixConfigSchema', () => {
    it('should parse valid config', () => {
      const result = PhoenixConfigSchema.parse({
        type: 'phoenix',
        enabled: false,
        batchSize: 100,
        flushInterval: 30000,
        host: 'http://localhost:3100',
        defaultLabels: { service: 'test' },
      });
      expect(result.type).toBe('phoenix');
    });
  });

  describe('ExportConfigSchema', () => {
    it('should parse valid config', () => {
      const result = ExportConfigSchema.parse({
        type: 'cloudwatch',
        enabled: true,
        batchSize: 20,
        flushInterval: 60000,
      });
      expect(result.type).toBe('cloudwatch');
    });
  });

  describe('AlertConfigSchema', () => {
    it('should parse valid alert config', () => {
      const result = AlertConfigSchema.parse({
        threshold: 0.8,
        action: 'notify',
      });
      expect(result.threshold).toBe(0.8);
      expect(result.action).toBe('notify');
    });

    it('should reject threshold > 1', () => {
      expect(() => AlertConfigSchema.parse({ threshold: 1.5, action: 'log' })).toThrow();
    });
  });

  describe('PricingTierSchema', () => {
    it('should parse valid pricing tier', () => {
      const result = PricingTierSchema.parse({
        model: 'gpt-4',
        provider: 'openai',
        inputPricePerMillion: 30,
        outputPricePerMillion: 60,
      });
      expect(result.model).toBe('gpt-4');
      expect(result.inputPricePerMillion).toBe(30);
    });
  });
});
