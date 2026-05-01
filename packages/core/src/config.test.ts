import {
  DEFAULT_CONFIG,
  loadBudgetConfig,
  loadCloudMonitoringConfig,
  loadCloudWatchConfig,
  loadConfig,
  loadPhoenixConfig,
  loadTelemetryConfig,
} from '@reaatech/llm-cost-telemetry';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadTelemetryConfig', () => {
    it('should load defaults when no env vars set', () => {
      const config = loadTelemetryConfig();
      expect(config.serviceName).toBe('llm-cost-telemetry');
      expect(config.tracingEnabled).toBe(true);
      expect(config.metricsEnabled).toBe(true);
    });

    it('should load from environment variables', () => {
      process.env.OTEL_SERVICE_NAME = 'my-service';
      process.env.OTEL_SERVICE_VERSION = '1.2.3';
      process.env.OTEL_ENVIRONMENT = 'production';
      process.env.OTEL_TRACING_ENABLED = 'false';
      process.env.OTEL_METRICS_ENABLED = 'false';
      process.env.OTEL_TRACE_SAMPLE_RATE = '0.5';
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4318';

      const config = loadTelemetryConfig();
      expect(config.serviceName).toBe('my-service');
      expect(config.serviceVersion).toBe('1.2.3');
      expect(config.environment).toBe('production');
      expect(config.tracingEnabled).toBe(false);
      expect(config.metricsEnabled).toBe(false);
      expect(config.traceSampleRate).toBe(0.5);
      expect(config.otlpEndpoint).toBe('http://collector:4318');
    });

    it('should parse resource attributes', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'region=us-east-1,team=platform';
      const config = loadTelemetryConfig();
      expect(config.resourceAttributes).toEqual({ region: 'us-east-1', team: 'platform' });
    });

    it('should handle empty resource attributes', () => {
      const config = loadTelemetryConfig();
      expect(config.resourceAttributes).toEqual({});
    });

    it('should handle malformed resource attributes gracefully', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'invalid-no-equals,also-bad';
      const config = loadTelemetryConfig();
      expect(config.resourceAttributes).toEqual({});
    });

    it('should use NODE_ENV as fallback for environment', () => {
      process.env.NODE_ENV = 'staging';
      const config = loadTelemetryConfig();
      expect(config.environment).toBe('staging');
    });
  });

  describe('loadBudgetConfig', () => {
    it('should load defaults', () => {
      const config = loadBudgetConfig();
      expect(config.global?.daily).toBe(100);
      expect(config.global?.monthly).toBe(2000);
      expect(config.alerts).toHaveLength(3);
    });

    it('should load custom budget values', () => {
      process.env.DEFAULT_DAILY_BUDGET = '500';
      process.env.DEFAULT_MONTHLY_BUDGET = '10000';

      const config = loadBudgetConfig();
      expect(config.global?.daily).toBe(500);
      expect(config.global?.monthly).toBe(10000);
    });

    it('should parse tenant budgets from JSON', () => {
      process.env.TENANT_BUDGETS = JSON.stringify({
        'acme-corp': { daily: 100, monthly: 2000 },
      });

      const config = loadBudgetConfig();
      expect(config.tenants?.['acme-corp']).toEqual({ daily: 100, monthly: 2000 });
    });

    it('should handle invalid tenant budgets JSON', () => {
      process.env.TENANT_BUDGETS = 'not-json';
      const config = loadBudgetConfig();
      expect(config.tenants).toEqual({});
    });
  });

  describe('loadCloudWatchConfig', () => {
    it('should load defaults', () => {
      const config = loadCloudWatchConfig();
      expect(config.type).toBe('cloudwatch');
      expect(config.enabled).toBe(false);
      expect(config.region).toBe('us-east-1');
      expect(config.namespace).toBe('LLM/Costs');
    });

    it('should load from environment', () => {
      process.env.CLOUDWATCH_ENABLED = 'true';
      process.env.AWS_REGION = 'eu-west-1';
      process.env.CLOUDWATCH_NAMESPACE = 'Custom/Namespace';
      process.env.CLOUDWATCH_BATCH_SIZE = '50';

      const config = loadCloudWatchConfig();
      expect(config.enabled).toBe(true);
      expect(config.region).toBe('eu-west-1');
      expect(config.namespace).toBe('Custom/Namespace');
      expect(config.batchSize).toBe(50);
    });
  });

  describe('loadCloudMonitoringConfig', () => {
    it('should load defaults', () => {
      const config = loadCloudMonitoringConfig();
      expect(config.type).toBe('cloud-monitoring');
      expect(config.enabled).toBe(false);
      expect(config.metricTypePrefix).toBe('custom.googleapis.com/llm');
    });

    it('should load from environment', () => {
      process.env.CLOUD_MONITORING_ENABLED = 'true';
      process.env.GCP_PROJECT_ID = 'my-project';

      const config = loadCloudMonitoringConfig();
      expect(config.enabled).toBe(true);
      expect(config.projectId).toBe('my-project');
    });
  });

  describe('loadPhoenixConfig', () => {
    it('should load defaults', () => {
      const config = loadPhoenixConfig();
      expect(config.type).toBe('phoenix');
      expect(config.enabled).toBe(false);
      expect(config.host).toBe('http://localhost:3100');
    });

    it('should load from environment', () => {
      process.env.PHOENIX_ENABLED = 'true';
      process.env.LOKI_HOST = 'http://loki:3100';
      process.env.LOKI_USERNAME = 'admin';
      process.env.LOKI_PASSWORD = 'secret';

      const config = loadPhoenixConfig();
      expect(config.enabled).toBe(true);
      expect(config.host).toBe('http://loki:3100');
      expect(config.username).toBe('admin');
      expect(config.password).toBe('secret');
    });
  });

  describe('loadConfig', () => {
    it('should load complete config', () => {
      const config = loadConfig();
      expect(config.telemetry).toBeDefined();
      expect(config.budget).toBeDefined();
      expect(config.cloudWatch).toBeDefined();
      expect(config.cloudMonitoring).toBeDefined();
      expect(config.phoenix).toBeDefined();
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have all config sections', () => {
      expect(DEFAULT_CONFIG.telemetry).toBeDefined();
      expect(DEFAULT_CONFIG.budget).toBeDefined();
      expect(DEFAULT_CONFIG.cloudWatch).toBeDefined();
      expect(DEFAULT_CONFIG.cloudMonitoring).toBeDefined();
      expect(DEFAULT_CONFIG.phoenix).toBeDefined();
    });

    it('should have correct default values', () => {
      expect(DEFAULT_CONFIG.telemetry.serviceName).toBe('llm-cost-telemetry');
      expect(DEFAULT_CONFIG.budget.global?.daily).toBe(100);
      expect(DEFAULT_CONFIG.cloudWatch.region).toBe('us-east-1');
      expect(DEFAULT_CONFIG.cloudMonitoring.metricTypePrefix).toBe('custom.googleapis.com/llm');
      expect(DEFAULT_CONFIG.phoenix.host).toBe('http://localhost:3100');
    });
  });
});
