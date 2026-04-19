/**
 * llm-cost-telemetry — Enterprise-grade LLM cost telemetry library
 *
 * @packageDocumentation
 */

// Types
export type {
  Provider,
  TimeWindow,
  AggregationDimension,
  AlertAction,
  BudgetPeriod,
  CostSpan,
  CostBreakdown,
  AggregationKey,
  CostRecord,
  PricingTier,
  ProviderConfig,
  ExportConfig,
  CloudWatchConfig,
  CloudMonitoringConfig,
  PhoenixConfig,
  RetryConfig,
  TelemetryConfig,
  BudgetConfig,
  BudgetLimits,
  AlertConfig,
  NotifierConfig,
  SlackConfig,
  EmailConfig,
  PagerDutyConfig,
  WebhookConfig,
  BudgetStatus,
  CostSummary,
  TenantCostSummary,
  FeatureCostSummary,
  RouteCostSummary,
  ProviderCostSummary,
  ModelCostSummary,
  TelemetryContext,
  CostEstimateRequest,
  CostEstimateResult,
} from './types/index.js';

// Calculator
export {
  calculateCost,
  estimateCost,
  getCostPerToken,
  compareModelCosts,
  calculateSavings,
  type CostCalculationOptions,
  DEFAULT_PRICING,
  getPricing,
  addCustomPricing,
  getProviderPricing,
  countOpenAITokens,
  countAnthropicTokens,
  countGoogleTokens,
  countMessageTokens,
  countText,
  estimateOutputTokens,
  countFunctionTokens,
  calculateTotalTokens,
  type TokenCountOptions,
  type Message,
  type TokenCountResult,
  type TotalTokenCalculation,
} from './calculator/index.js';

// Providers
export {
  BaseProviderWrapper,
  type RequestMetadata,
  type ResponseMetadata,
  type SpanCallback,
  OpenAIWrapper,
  wrapOpenAI,
  type WrappedOpenAI,
  AnthropicWrapper,
  wrapAnthropic,
  type WrappedAnthropic,
  GoogleGenerativeAIWrapper,
  wrapGoogleGenerativeAI,
  type WrappedGoogleGenerativeAI,
  type WrappedGenerativeModel,
} from './providers/index.js';

// Aggregation
export {
  CostCollector,
  type CollectorOptions,
  CostAggregator,
  type AggregatorOptions,
  BudgetManager,
} from './aggregation/index.js';

// MCP
export { createCostTelemetryServer, type MCPServerOptions } from './mcp/index.js';

// Exporters
export {
  BaseExporter,
  type BaseExporterOptions,
  type ExportResult,
  CloudWatchExporter,
  type CloudWatchExporterOptions,
  CloudMonitoringExporter,
  type CloudMonitoringExporterOptions,
  PhoenixExporter,
  type PhoenixExporterOptions,
} from './exporters/index.js';

// Observability
export {
  TracingManager,
  type TracingOptions,
  MetricsManager,
  type MetricsOptions,
  CostLogger,
  getLogger,
  type LoggerOptions,
} from './otel/index.js';

// Configuration
export {
  loadConfig,
  loadTelemetryConfig,
  loadBudgetConfig,
  loadCloudWatchConfig,
  loadCloudMonitoringConfig,
  loadPhoenixConfig,
  DEFAULT_CONFIG,
  type AppConfig,
} from './config/index.js';

// Utilities
export {
  generateId,
  now,
  nowMs,
  sleep,
  getWindowStart,
  getWindowEnd,
  formatISODate,
  parseISODate,
  clamp,
  percentage,
  roundTo,
  calculateCostFromTokens,
  deepClone,
  isEmpty,
  deepMerge,
  retryWithBackoff,
  batchArray,
  sanitizeLabel,
  simpleHash,
  getEnvVar,
  getEnvInt,
  getEnvFloat,
  getEnvBool,
} from './utils/index.js';
