/**
 * Zod schemas for validation
 */
import { z } from 'zod';

/**
 * Provider enum schema
 */
export const ProviderSchema = z.enum(['openai', 'anthropic', 'google']);

/**
 * Time window enum schema
 */
export const TimeWindowSchema = z.enum(['minute', 'hour', 'day', 'week', 'month']);

/**
 * Aggregation dimension enum schema
 */
export const AggregationDimensionSchema = z.enum([
  'tenant',
  'feature',
  'route',
  'model',
  'provider',
]);

/**
 * Alert action enum schema
 */
export const AlertActionSchema = z.enum(['log', 'notify', 'block']);

/**
 * Budget period enum schema
 */
export const BudgetPeriodSchema = z.enum(['daily', 'monthly']);

/**
 * Call status enum schema
 */
export const CallStatusSchema = z.enum(['success', 'error']);

/**
 * Cost breakdown schema
 */
export const CostBreakdownSchema = z.object({
  inputCostUsd: z.number().min(0),
  outputCostUsd: z.number().min(0),
  cacheReadCostUsd: z.number().min(0).optional(),
  cacheCreationCostUsd: z.number().min(0).optional(),
});

/**
 * Cost span schema
 */
export const CostSpanSchema = z.object({
  id: z.string().optional(),
  spanId: z.string().optional(),
  traceId: z.string().uuid().optional(),
  parentSpanId: z.string().uuid().optional(),
  provider: ProviderSchema,
  model: z.string(),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0).optional(),
  cacheReadTokens: z.number().int().min(0).optional(),
  cacheCreationTokens: z.number().int().min(0).optional(),
  costUsd: z.number().min(0),
  costBreakdown: CostBreakdownSchema.optional(),
  telemetry: z
    .object({
      tenant: z.string().optional(),
      feature: z.string().optional(),
      route: z.string().optional(),
      model: z.string().optional(),
      provider: ProviderSchema.optional(),
      traceId: z.string().uuid().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
  tenant: z.string().optional(),
  feature: z.string().optional(),
  route: z.string().optional(),
  timestamp: z.date().optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  durationMs: z.number().min(0).optional(),
  status: z.enum(['success', 'error', 'ok']).optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Aggregation key schema
 */
export const AggregationKeySchema = z.object({
  tenant: z.string().optional(),
  feature: z.string().optional(),
  route: z.string().optional(),
  model: z.string().optional(),
  provider: ProviderSchema.optional(),
  windowStart: z.date(),
  windowEnd: z.date(),
});

/**
 * Cost record schema
 */
export const CostRecordSchema = z.object({
  id: z.string().uuid(),
  key: AggregationKeySchema,
  totalUsd: z.number().min(0),
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
  totalCacheReadTokens: z.number().int().min(0).optional(),
  totalCacheCreationTokens: z.number().int().min(0).optional(),
  apiCalls: z.number().int().min(0),
  avgCostPerCall: z.number().min(0),
  spanCount: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Pricing tier schema
 */
export const PricingTierSchema = z.object({
  model: z.string(),
  provider: ProviderSchema,
  inputPricePerMillion: z.number().min(0),
  outputPricePerMillion: z.number().min(0),
  cacheReadPricePerMillion: z.number().min(0).optional(),
  cacheCreationPricePerMillion: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  effectiveDate: z.date().optional(),
  expiryDate: z.date().optional(),
});

/**
 * Provider config schema
 */
export const ProviderConfigSchema = z.object({
  provider: ProviderSchema,
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  timeout: z.number().int().min(0).optional(),
  maxRetries: z.number().int().min(0).optional(),
  customPricing: z.array(PricingTierSchema).optional(),
  enableCaching: z.boolean().optional(),
});

/**
 * Retry config schema
 */
export const RetryConfigSchema = z.object({
  maxRetries: z.number().int().min(0),
  initialDelayMs: z.number().int().min(0),
  maxDelayMs: z.number().int().min(0),
  backoffMultiplier: z.number().min(1),
});

/**
 * Base export config schema
 */
export const ExportConfigSchema = z.object({
  type: z.enum(['cloudwatch', 'cloud-monitoring', 'phoenix']),
  enabled: z.boolean(),
  batchSize: z.number().int().min(1),
  flushInterval: z.number().int().min(0),
  retryConfig: RetryConfigSchema.optional(),
  options: z.record(z.unknown()).optional(),
});

/**
 * CloudWatch config schema
 */
export const CloudWatchConfigSchema = ExportConfigSchema.extend({
  type: z.literal('cloudwatch'),
  region: z.string(),
  namespace: z.string(),
  emfEnabled: z.boolean(),
  logGroupName: z.string(),
});

/**
 * Cloud Monitoring config schema
 */
export const CloudMonitoringConfigSchema = ExportConfigSchema.extend({
  type: z.literal('cloud-monitoring'),
  projectId: z.string(),
  metricTypePrefix: z.string(),
  resourceType: z.string(),
});

/**
 * Phoenix config schema
 */
export const PhoenixConfigSchema = ExportConfigSchema.extend({
  type: z.literal('phoenix'),
  host: z.string().url(),
  defaultLabels: z.record(z.string()),
  username: z.string().optional(),
  password: z.string().optional(),
});

/**
 * Telemetry config schema
 */
export const TelemetryConfigSchema = z.object({
  otlpEndpoint: z.string().url().optional(),
  serviceName: z.string().min(1),
  serviceVersion: z.string().optional(),
  environment: z.string().optional(),
  resourceAttributes: z.record(z.string()).optional(),
  tracingEnabled: z.boolean(),
  metricsEnabled: z.boolean(),
  traceSampleRate: z.number().min(0).max(1).optional(),
});

/**
 * Budget limits schema
 */
export const BudgetLimitsSchema = z.object({
  daily: z.number().min(0).optional(),
  monthly: z.number().min(0).optional(),
});

/**
 * Slack config schema
 */
export const SlackConfigSchema = z.object({
  type: z.literal('slack'),
  webhookUrl: z.string().url(),
  channel: z.string().optional(),
});

/**
 * Email config schema
 */
export const EmailConfigSchema = z.object({
  type: z.literal('email'),
  to: z.array(z.string().email()),
  smtp: z
    .object({
      host: z.string(),
      port: z.number().int().min(0),
      secure: z.boolean(),
      auth: z.object({ user: z.string(), pass: z.string() }).optional(),
    })
    .optional(),
  subject: z.string().optional(),
});

/**
 * PagerDuty config schema
 */
export const PagerDutyConfigSchema = z.object({
  type: z.literal('pagerduty'),
  serviceKey: z.string(),
  severity: z.enum(['critical', 'error', 'warning', 'info']).optional(),
});

/**
 * Webhook config schema
 */
export const WebhookConfigSchema = z.object({
  type: z.literal('webhook'),
  url: z.string().url(),
  method: z.enum(['POST', 'PUT']).optional(),
  headers: z.record(z.string()).optional(),
});

/**
 * Notifier config schema (discriminated union)
 */
export const NotifierConfigSchema = z.object({
  type: z.enum(['slack', 'email', 'pagerduty', 'webhook']),
  config: z.union([
    SlackConfigSchema,
    EmailConfigSchema,
    PagerDutyConfigSchema,
    WebhookConfigSchema,
  ]),
});

/**
 * Alert config schema
 */
export const AlertConfigSchema = z.object({
  threshold: z.number().min(0).max(1),
  action: AlertActionSchema,
  message: z.string().optional(),
  notifier: NotifierConfigSchema.optional(),
});

/**
 * Budget config schema
 */
export const BudgetConfigSchema = z.object({
  global: BudgetLimitsSchema.optional(),
  tenants: z.record(BudgetLimitsSchema),
  alerts: z.array(AlertConfigSchema),
});

/**
 * Budget status schema
 */
export const BudgetStatusSchema = z.object({
  tenant: z.string(),
  dailySpent: z.number().min(0),
  dailyBudget: z.number().min(0).optional(),
  dailyPercentage: z.number().min(0),
  dailyRemaining: z.number().min(0).optional(),
  monthlySpent: z.number().min(0),
  monthlyBudget: z.number().min(0).optional(),
  monthlyPercentage: z.number().min(0),
  monthlyRemaining: z.number().min(0).optional(),
  withinBudget: z.boolean(),
  activeAlerts: z.array(AlertConfigSchema),
});

/**
 * Tenant cost summary schema
 */
export const TenantCostSummarySchema = z.object({
  tenant: z.string(),
  totalUsd: z.number().min(0),
  apiCalls: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});

/**
 * Feature cost summary schema
 */
export const FeatureCostSummarySchema = z.object({
  feature: z.string(),
  totalUsd: z.number().min(0),
  apiCalls: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});

/**
 * Route cost summary schema
 */
export const RouteCostSummarySchema = z.object({
  route: z.string(),
  totalUsd: z.number().min(0),
  apiCalls: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});

/**
 * Provider cost summary schema
 */
export const ProviderCostSummarySchema = z.object({
  provider: ProviderSchema,
  totalUsd: z.number().min(0),
  apiCalls: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});

/**
 * Model cost summary schema
 */
export const ModelCostSummarySchema = z.object({
  model: z.string(),
  provider: ProviderSchema,
  totalUsd: z.number().min(0),
  apiCalls: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});

/**
 * Cost summary schema
 */
export const CostSummarySchema = z.object({
  totalUsd: z.number().min(0),
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
  totalApiCalls: z.number().int().min(0),
  avgCostPerCall: z.number().min(0),
  byTenant: z.record(TenantCostSummarySchema),
  byFeature: z.record(FeatureCostSummarySchema),
  byRoute: z.record(RouteCostSummarySchema),
  byProvider: z.record(ProviderCostSummarySchema),
  byModel: z.record(ModelCostSummarySchema),
  periodStart: z.date(),
  periodEnd: z.date(),
});

/**
 * Telemetry context schema
 */
export const TelemetryContextSchema = z.object({
  tenant: z.string().optional(),
  feature: z.string().optional(),
  route: z.string().optional(),
  traceId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Cost estimate request schema
 */
export const CostEstimateRequestSchema = z.object({
  provider: ProviderSchema,
  model: z.string(),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0).optional(),
  maxTokens: z.number().int().min(0).optional(),
  useCache: z.boolean().optional(),
});

/**
 * Cost estimate result schema
 */
export const CostEstimateResultSchema = z.object({
  usd: z.number().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  breakdown: CostBreakdownSchema.optional(),
});

// Type exports from schemas
export type CostSpanInput = z.infer<typeof CostSpanSchema>;
export type AggregationKeyInput = z.infer<typeof AggregationKeySchema>;
export type CostRecordInput = z.infer<typeof CostRecordSchema>;
export type PricingTierInput = z.infer<typeof PricingTierSchema>;
export type ProviderConfigInput = z.infer<typeof ProviderConfigSchema>;
export type TelemetryContextInput = z.infer<typeof TelemetryContextSchema>;
export type CostEstimateRequestInput = z.infer<typeof CostEstimateRequestSchema>;
export type CostEstimateResultInput = z.infer<typeof CostEstimateResultSchema>;
