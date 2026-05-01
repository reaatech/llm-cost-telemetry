/**
 * Configuration management from environment variables
 */
import { getEnvVar, getEnvInt, getEnvFloat, getEnvBool } from './utils.js';
import type {
  TelemetryConfig,
  BudgetConfig,
  CloudWatchConfig,
  CloudMonitoringConfig,
  PhoenixConfig,
} from './domain.js';
import {
  TelemetryConfigSchema,
  BudgetConfigSchema,
  CloudWatchConfigSchema,
  CloudMonitoringConfigSchema,
  PhoenixConfigSchema,
} from './schemas.js';

/**
 * Load telemetry configuration from environment variables
 */
export function loadTelemetryConfig(): TelemetryConfig {
  const config: TelemetryConfig = {
    otlpEndpoint: getEnvVar('OTEL_EXPORTER_OTLP_ENDPOINT'),
    serviceName: getEnvVar('OTEL_SERVICE_NAME') ?? 'llm-cost-telemetry',
    serviceVersion: getEnvVar('OTEL_SERVICE_VERSION'),
    environment: getEnvVar('OTEL_ENVIRONMENT') ?? getEnvVar('NODE_ENV'),
    resourceAttributes: parseResourceAttributes(),
    tracingEnabled: getEnvBool('OTEL_TRACING_ENABLED', true),
    metricsEnabled: getEnvBool('OTEL_METRICS_ENABLED', true),
    traceSampleRate: getEnvFloat('OTEL_TRACE_SAMPLE_RATE', 1.0),
  };

  try {
    return TelemetryConfigSchema.parse(config);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to validate telemetry config:', e instanceof Error ? e.message : e);
    return config;
  }
}

/**
 * Parse resource attributes from OTEL_RESOURCE_ATTRIBUTES env var
 * Format: key1=value1,key2=value2
 */
function parseResourceAttributes(): Record<string, string> {
  const attrString = getEnvVar('OTEL_RESOURCE_ATTRIBUTES');
  if (!attrString) return {};

  const attributes: Record<string, string> = {};
  const pairs = attrString.split(',');
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      attributes[key.trim()] = valueParts.join('=').trim();
    }
  }
  return attributes;
}

/**
 * Load budget configuration from environment variables
 */
export function loadBudgetConfig(): BudgetConfig {
  const dailyBudget = getEnvFloat('DEFAULT_DAILY_BUDGET', 100.0);
  const monthlyBudget = getEnvFloat('DEFAULT_MONTHLY_BUDGET', 2000.0);

  const config: BudgetConfig = {
    global: {
      daily: dailyBudget,
      monthly: monthlyBudget,
    },
    tenants: {},
    alerts: [
      { threshold: 0.5, action: 'log' },
      { threshold: 0.75, action: 'notify' },
      { threshold: 0.9, action: 'block' },
    ],
  };

  // Parse tenant-specific budgets from JSON env var if available
  const tenantsJson = getEnvVar('TENANT_BUDGETS');
  if (tenantsJson) {
    try {
      config.tenants = JSON.parse(tenantsJson);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse TENANT_BUDGETS:', e instanceof Error ? e.message : e);
    }
  }

  try {
    return BudgetConfigSchema.parse(config);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to validate budget config:', e instanceof Error ? e.message : e);
    return config;
  }
}

/**
 * Load CloudWatch exporter configuration from environment variables
 */
export function loadCloudWatchConfig(): CloudWatchConfig {
  const config: CloudWatchConfig = {
    type: 'cloudwatch',
    enabled: getEnvBool('CLOUDWATCH_ENABLED', false),
    region: getEnvVar('AWS_REGION') ?? 'us-east-1',
    namespace: getEnvVar('CLOUDWATCH_NAMESPACE') ?? 'LLM/Costs',
    emfEnabled: getEnvBool('CLOUDWATCH_EMF_ENABLED', true),
    logGroupName: getEnvVar('CLOUDWATCH_LOG_GROUP') ?? '/aws/llm/costs',
    batchSize: getEnvInt('CLOUDWATCH_BATCH_SIZE', 20),
    flushInterval: getEnvInt('CLOUDWATCH_FLUSH_INTERVAL', 60000),
  };

  try {
    return CloudWatchConfigSchema.parse(config);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to validate CloudWatch config:', e instanceof Error ? e.message : e);
    return config;
  }
}

/**
 * Load Cloud Monitoring exporter configuration from environment variables
 */
export function loadCloudMonitoringConfig(): CloudMonitoringConfig {
  const config: CloudMonitoringConfig = {
    type: 'cloud-monitoring',
    enabled: getEnvBool('CLOUD_MONITORING_ENABLED', false),
    projectId: getEnvVar('GCP_PROJECT_ID') ?? '',
    metricTypePrefix: getEnvVar('CLOUD_MONITORING_PREFIX') ?? 'custom.googleapis.com/llm',
    resourceType: getEnvVar('CLOUD_MONITORING_RESOURCE_TYPE') ?? 'gce_instance',
    batchSize: getEnvInt('CLOUD_MONITORING_BATCH_SIZE', 200),
    flushInterval: getEnvInt('CLOUD_MONITORING_FLUSH_INTERVAL', 60000),
  };

  try {
    return CloudMonitoringConfigSchema.parse(config);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      'Failed to validate Cloud Monitoring config:',
      e instanceof Error ? e.message : e,
    );
    return config;
  }
}

/**
 * Load Phoenix/Loki exporter configuration from environment variables
 */
export function loadPhoenixConfig(): PhoenixConfig {
  const config: PhoenixConfig = {
    type: 'phoenix',
    enabled: getEnvBool('PHOENIX_ENABLED', false),
    host: getEnvVar('LOKI_HOST') ?? 'http://localhost:3100',
    defaultLabels: {
      service: getEnvVar('OTEL_SERVICE_NAME') ?? 'llm-cost-telemetry',
      environment: getEnvVar('NODE_ENV') ?? 'development',
    },
    username: getEnvVar('LOKI_USERNAME'),
    password: getEnvVar('LOKI_PASSWORD'),
    batchSize: getEnvInt('PHOENIX_BATCH_SIZE', 100),
    flushInterval: getEnvInt('PHOENIX_FLUSH_INTERVAL', 30000),
  };

  try {
    return PhoenixConfigSchema.parse(config);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to validate Phoenix config:', e instanceof Error ? e.message : e);
    return config;
  }
}

/**
 * Complete configuration object
 */
export interface AppConfig {
  telemetry: TelemetryConfig;
  budget: BudgetConfig;
  cloudWatch: CloudWatchConfig;
  cloudMonitoring: CloudMonitoringConfig;
  phoenix: PhoenixConfig;
}

/**
 * Load complete application configuration
 */
export function loadConfig(): AppConfig {
  return {
    telemetry: loadTelemetryConfig(),
    budget: loadBudgetConfig(),
    cloudWatch: loadCloudWatchConfig(),
    cloudMonitoring: loadCloudMonitoringConfig(),
    phoenix: loadPhoenixConfig(),
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: AppConfig = {
  telemetry: {
    serviceName: 'llm-cost-telemetry',
    tracingEnabled: true,
    metricsEnabled: true,
    traceSampleRate: 1.0,
  },
  budget: {
    global: {
      daily: 100.0,
      monthly: 2000.0,
    },
    tenants: {},
    alerts: [
      { threshold: 0.5, action: 'log' },
      { threshold: 0.75, action: 'notify' },
      { threshold: 0.9, action: 'block' },
    ],
  },
  cloudWatch: {
    type: 'cloudwatch',
    enabled: false,
    region: 'us-east-1',
    namespace: 'LLM/Costs',
    emfEnabled: true,
    logGroupName: '/aws/llm/costs',
    batchSize: 20,
    flushInterval: 60000,
  },
  cloudMonitoring: {
    type: 'cloud-monitoring',
    enabled: false,
    projectId: '',
    metricTypePrefix: 'custom.googleapis.com/llm',
    resourceType: 'gce_instance',
    batchSize: 200,
    flushInterval: 60000,
  },
  phoenix: {
    type: 'phoenix',
    enabled: false,
    host: 'http://localhost:3100',
    defaultLabels: {
      service: 'llm-cost-telemetry',
      environment: 'development',
    },
    batchSize: 100,
    flushInterval: 30000,
  },
};
