/**
 * Core domain types for llm-cost-telemetry
 */

/** LLM Provider types */
export type Provider = 'openai' | 'anthropic' | 'google';

/** Time window types for aggregation */
export type TimeWindow = 'minute' | 'hour' | 'day' | 'week' | 'month';

/** Aggregation dimensions */
export type AggregationDimension = 'tenant' | 'feature' | 'route' | 'model' | 'provider';

/** Alert actions */
export type AlertAction = 'log' | 'notify' | 'block';

/** Budget period */
export type BudgetPeriod = 'daily' | 'monthly';

/**
 * CostSpan represents a single LLM API call with cost information
 */
export interface CostSpan {
  /** Unique identifier for this span */
  spanId?: string;
  /** Alias for spanId for backward compatibility */
  id?: string;
  /** Trace ID for correlation */
  traceId?: string;
  /** Parent span ID if nested */
  parentSpanId?: string;
  /** LLM provider (openai, anthropic, google) */
  provider: Provider;
  /** Model name (e.g., gpt-4, claude-opus-20240229) */
  model: string;
  /** Number of input/prompt tokens */
  inputTokens: number;
  /** Number of output/completion tokens */
  outputTokens: number;
  /** Total tokens (input + output) */
  totalTokens?: number;
  /** Cache read tokens (Anthropic prompt caching) */
  cacheReadTokens?: number;
  /** Cache creation tokens (Anthropic prompt caching) */
  cacheCreationTokens?: number;
  /** Cost in USD for this call */
  costUsd: number;
  /** Breakdown of costs */
  costBreakdown?: CostBreakdown;
  /** Telemetry context */
  telemetry?: TelemetryContext;
  /** Tenant identifier for multi-tenant tracking (deprecated, use telemetry.tenant) */
  tenant?: string;
  /** Feature name for cost allocation (deprecated, use telemetry.feature) */
  feature?: string;
  /** API route/endpoint (deprecated, use telemetry.route) */
  route?: string;
  /** Timestamp when the call was made */
  timestamp?: Date;
  /** Start time of the call */
  startTime?: Date;
  /** End time of the call */
  endTime?: Date;
  /** Duration of the API call in milliseconds */
  durationMs?: number;
  /** Status of the call (success, error) */
  status?: 'success' | 'error' | 'ok';
  /** Error message if failed */
  errorMessage?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cost breakdown by component
 */
export interface CostBreakdown {
  /** Cost for input tokens */
  inputCostUsd: number;
  /** Cost for output tokens */
  outputCostUsd: number;
  /** Cost for cache read (discounted) */
  cacheReadCostUsd?: number;
  /** Cost for cache creation */
  cacheCreationCostUsd?: number;
}

/**
 * Aggregation key for grouping cost records
 */
export interface AggregationKey {
  /** Tenant identifier */
  tenant?: string;
  /** Feature name */
  feature?: string;
  /** API route */
  route?: string;
  /** Model name */
  model?: string;
  /** Provider name */
  provider?: Provider;
  /** Time window start */
  windowStart: Date;
  /** Time window end */
  windowEnd: Date;
}

/**
 * Aggregated cost record
 */
export interface CostRecord {
  /** Unique identifier for this record */
  id: string;
  /** Aggregation key */
  key?: AggregationKey;
  /** Total cost in USD */
  totalUsd?: number;
  /** Total cost in USD (primary field) */
  totalCostUsd?: number;
  /** Total input tokens */
  totalInputTokens: number;
  /** Total output tokens */
  totalOutputTokens: number;
  /** Total cache read tokens */
  totalCacheReadTokens?: number;
  /** Total cache creation tokens */
  totalCacheCreationTokens?: number;
  /** Number of API calls */
  apiCalls?: number;
  /** Number of API calls (primary field) */
  totalCalls?: number;
  /** Average cost per call */
  avgCostPerCall?: number;
  /** Spans included in this record */
  spanCount?: number;
  /** When this record was created */
  createdAt?: Date;
  /** When this record was last updated */
  updatedAt?: Date;
  /** Dimension for flat aggregation (e.g., "tenant", "feature", "route") */
  dimension?: string;
  /** Value for flat aggregation */
  value?: string;
  /** Time window for aggregation */
  window?: TimeWindow;
  /** Window start time */
  windowStart?: Date | string;
  /** Window end time */
  windowEnd?: Date | string;
  /** Start time (alias for windowStart) */
  startTime?: Date | string;
  /** End time (alias for windowEnd) */
  endTime?: Date | string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Pricing tier information
 */
export interface PricingTier {
  /** Model name pattern or exact name */
  model: string;
  /** Provider */
  provider: Provider;
  /** Cost per 1M input tokens in USD */
  inputPricePerMillion: number;
  /** Cost per 1M output tokens in USD */
  outputPricePerMillion: number;
  /** Cost per 1M cache read tokens (discounted) */
  cacheReadPricePerMillion?: number;
  /** Cost per 1M cache creation tokens */
  cacheCreationPricePerMillion?: number;
  /** Currency code */
  currency?: string;
  /** Effective date */
  effectiveDate?: Date;
  /** Expiry date */
  expiryDate?: Date;
}

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  /** Provider name */
  provider: Provider;
  /** API key (from env var) */
  apiKey?: string;
  /** Base URL for API */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retries */
  maxRetries?: number;
  /** Custom pricing overrides */
  customPricing?: PricingTier[];
  /** Enable prompt caching (Anthropic) */
  enableCaching?: boolean;
}

/**
 * Exporter configuration
 */
export interface ExportConfig {
  /** Exporter type */
  type: 'cloudwatch' | 'cloud-monitoring' | 'phoenix';
  /** Enable/disable this exporter */
  enabled: boolean;
  /** Batch size for exports */
  batchSize: number;
  /** Flush interval in milliseconds */
  flushInterval: number;
  /** Retry configuration */
  retryConfig?: RetryConfig;
  /** Exporter-specific options */
  options?: Record<string, unknown>;
}

/**
 * CloudWatch exporter configuration
 */
export interface CloudWatchConfig extends ExportConfig {
  type: 'cloudwatch';
  /** AWS region */
  region: string;
  /** CloudWatch namespace */
  namespace: string;
  /** Enable EMF format for Logs Insights */
  emfEnabled: boolean;
  /** Log group name for EMF */
  logGroupName: string;
}

/**
 * Cloud Monitoring exporter configuration
 */
export interface CloudMonitoringConfig extends ExportConfig {
  type: 'cloud-monitoring';
  /** GCP project ID */
  projectId: string;
  /** Metric type prefix */
  metricTypePrefix: string;
  /** Resource type (gce_instance, cloud_run_revision, etc.) */
  resourceType: string;
}

/**
 * Phoenix/Loki exporter configuration
 */
export interface PhoenixConfig extends ExportConfig {
  type: 'phoenix';
  /** Loki host URL */
  host: string;
  /** Default labels */
  defaultLabels: Record<string, string>;
  /** Username for basic auth */
  username?: string;
  /** Password for basic auth */
  password?: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
}

/**
 * OpenTelemetry configuration
 */
export interface TelemetryConfig {
  /** OTLP endpoint */
  otlpEndpoint?: string;
  /** Service name */
  serviceName: string;
  /** Service version */
  serviceVersion?: string;
  /** Environment (production, staging, etc.) */
  environment?: string;
  /** Additional resource attributes */
  resourceAttributes?: Record<string, string>;
  /** Enable tracing */
  tracingEnabled: boolean;
  /** Enable metrics */
  metricsEnabled: boolean;
  /** Trace sample rate (0-1) */
  traceSampleRate?: number;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /** Global budget limits */
  global?: BudgetLimits;
  /** Per-tenant budget limits */
  tenants?: Record<string, BudgetLimits>;
  /** Alert thresholds */
  alerts?: AlertConfig[];
}

/**
 * Budget limits
 */
export interface BudgetLimits {
  /** Daily budget in USD */
  daily?: number;
  /** Monthly budget in USD */
  monthly?: number;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Threshold as decimal (0.5 = 50%) */
  threshold: number;
  /** Action to take */
  action: AlertAction;
  /** Custom message */
  message?: string;
  /** Notifier configuration */
  notifier?: NotifierConfig;
}

/**
 * Notifier configuration
 */
export interface NotifierConfig {
  /** Notifier type */
  type: 'slack' | 'email' | 'pagerduty' | 'webhook';
  /** Configuration based on type */
  config: SlackConfig | EmailConfig | PagerDutyConfig | WebhookConfig;
}

/**
 * Slack notifier configuration
 */
export interface SlackConfig {
  type: 'slack';
  /** Slack webhook URL */
  webhookUrl: string;
  /** Channel name */
  channel?: string;
}

/**
 * Email notifier configuration
 */
export interface EmailConfig {
  type: 'email';
  /** Recipient email addresses */
  to: string[];
  /** SMTP configuration */
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string };
  };
  /** Email subject */
  subject?: string;
}

/**
 * PagerDuty notifier configuration
 */
export interface PagerDutyConfig {
  type: 'pagerduty';
  /** PagerDuty service key */
  serviceKey: string;
  /** Severity level */
  severity?: 'critical' | 'error' | 'warning' | 'info';
}

/**
 * Webhook notifier configuration
 */
export interface WebhookConfig {
  type: 'webhook';
  /** Webhook URL */
  url: string;
  /** HTTP method */
  method?: 'POST' | 'PUT';
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Budget status
 */
export interface BudgetStatus {
  /** Tenant identifier */
  tenant: string;
  /** Amount spent today */
  dailySpent: number;
  /** Daily budget limit */
  dailyBudget?: number;
  /** Alias for dailyBudget for backward compatibility */
  dailyLimit?: number;
  /** Daily budget percentage used (0-100) */
  dailyPercentage: number;
  /** Remaining daily budget */
  dailyRemaining?: number;
  /** Whether daily budget is exceeded */
  dailyExceeded?: boolean;
  /** Amount spent this month */
  monthlySpent: number;
  /** Monthly budget limit */
  monthlyBudget?: number;
  /** Alias for monthlyBudget for backward compatibility */
  monthlyLimit?: number;
  /** Monthly budget percentage used (0-100) */
  monthlyPercentage: number;
  /** Remaining monthly budget */
  monthlyRemaining?: number;
  /** Whether monthly budget is exceeded */
  monthlyExceeded?: boolean;
  /** Whether within budget */
  withinBudget: boolean;
  /** Active alerts */
  activeAlerts: AlertConfig[];
  /** Alert actions triggered */
  alerts?: AlertAction[];
}

/**
 * Cost summary for reporting
 */
export interface CostSummary {
  /** Total cost in USD */
  totalUsd?: number;
  /** Total cost in USD (primary field) */
  totalCostUsd?: number;
  /** Total input tokens */
  totalInputTokens?: number;
  /** Total output tokens */
  totalOutputTokens?: number;
  /** Total API calls */
  totalApiCalls?: number;
  /** Total API calls (alias) */
  totalCalls?: number;
  /** Average cost per call */
  avgCostPerCall?: number;
  /** Breakdown by tenant */
  byTenant?: Record<string, TenantCostSummary>;
  /** Breakdown by feature */
  byFeature?: Record<string, FeatureCostSummary>;
  /** Breakdown by route */
  byRoute?: Record<string, RouteCostSummary>;
  /** Breakdown by provider */
  byProvider?: Record<string, ProviderCostSummary>;
  /** Breakdown by model */
  byModel?: Record<string, ModelCostSummary>;
  /** Breakdown by dimension (flat structure) */
  byDimension?: Record<string, { totalCost: number; totalCalls: number }>;
  /** Period/Window type */
  period?: TimeWindow;
  /** Period start */
  periodStart?: Date;
  /** Period end */
  periodEnd?: Date;
}

/**
 * Tenant cost summary
 */
export interface TenantCostSummary {
  /** Tenant identifier */
  tenant: string;
  /** Total cost */
  totalUsd: number;
  /** Total API calls */
  apiCalls: number;
  /** Percentage of total cost */
  percentage: number;
}

/**
 * Feature cost summary
 */
export interface FeatureCostSummary {
  /** Feature name */
  feature: string;
  /** Total cost */
  totalUsd: number;
  /** Total API calls */
  apiCalls: number;
  /** Percentage of total cost */
  percentage: number;
}

/**
 * Route cost summary
 */
export interface RouteCostSummary {
  /** API route */
  route: string;
  /** Total cost */
  totalUsd: number;
  /** Total API calls */
  apiCalls: number;
  /** Percentage of total cost */
  percentage: number;
}

/**
 * Provider cost summary
 */
export interface ProviderCostSummary {
  /** Provider name */
  provider: Provider;
  /** Total cost */
  totalUsd: number;
  /** Total API calls */
  apiCalls: number;
  /** Percentage of total cost */
  percentage: number;
}

/**
 * Model cost summary
 */
export interface ModelCostSummary {
  /** Model name */
  model: string;
  /** Provider */
  provider: Provider;
  /** Total cost */
  totalUsd: number;
  /** Total API calls */
  apiCalls: number;
  /** Percentage of total cost */
  percentage: number;
}

/**
 * Telemetry context for API calls
 */
export interface TelemetryContext {
  /** Tenant identifier */
  tenant?: string;
  /** Feature name */
  feature?: string;
  /** API route */
  route?: string;
  /** Model name */
  model?: string;
  /** Provider name */
  provider?: Provider;
  /** Trace ID for correlation */
  traceId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cost estimation request
 */
export interface CostEstimateRequest {
  /** Provider name */
  provider: Provider;
  /** Model name */
  model: string;
  /** Input tokens (estimated or actual) */
  inputTokens: number;
  /** Expected output tokens */
  outputTokens?: number;
  /** Max tokens for output */
  maxTokens?: number;
  /** Use cache */
  useCache?: boolean;
}

/**
 * Cost estimation result
 */
export interface CostEstimateResult {
  /** Estimated cost in USD */
  usd: number;
  /** Estimated input tokens */
  inputTokens: number;
  /** Estimated output tokens */
  outputTokens: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Breakdown */
  breakdown?: CostBreakdown;
}
