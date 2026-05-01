/**
 * MCP Server for llm-cost-telemetry
 * Exposes three-layer tools: cost.span.*, cost.aggregate.*, cost.budget.*
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CostSpan, TelemetryContext, TimeWindow } from '@reaatech/llm-cost-telemetry';
import { ProviderSchema, TimeWindowSchema, AlertActionSchema } from '@reaatech/llm-cost-telemetry';
import { z } from 'zod';
import { CostCollector } from '@reaatech/llm-cost-telemetry-aggregation';
import { CostAggregator } from '@reaatech/llm-cost-telemetry-aggregation';
import { BudgetManager } from '@reaatech/llm-cost-telemetry-aggregation';
import { calculateCost } from '@reaatech/llm-cost-telemetry-calculator';
import { generateId, now } from '@reaatech/llm-cost-telemetry';
import { loadBudgetConfig } from '@reaatech/llm-cost-telemetry';

const SpanRecordSchema = z.object({
  provider: ProviderSchema,
  model: z.string().min(1),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cacheReadTokens: z.number().int().min(0).optional(),
  cacheCreationTokens: z.number().int().min(0).optional(),
  tenant: z.string().optional(),
  feature: z.string().optional(),
  route: z.string().optional(),
});

const SpanGetSchema = z.object({
  spanId: z.string().min(1),
});

const AggregateByTenantSchema = z.object({
  tenant: z.string().optional(),
  period: TimeWindowSchema,
});

const AggregateByFeatureSchema = z.object({
  feature: z.string().optional(),
  period: TimeWindowSchema,
});

const AggregateByRouteSchema = z.object({
  route: z.string().optional(),
  period: TimeWindowSchema,
});

const AggregateSummarySchema = z.object({
  period: TimeWindowSchema,
  groupBy: z.array(z.enum(['tenant', 'feature', 'route', 'provider', 'model'])).optional(),
});

const BudgetCheckSchema = z.object({
  tenant: z.string().min(1),
  estimatedCost: z.number().min(0),
});

const BudgetSetSchema = z.object({
  tenant: z.string().min(1),
  daily: z.number().min(0).optional(),
  monthly: z.number().min(0).optional(),
});

const BudgetAlertSchema = z.object({
  threshold: z.number().min(0).max(1),
  action: AlertActionSchema,
});

/**
 * MCP Server options
 */
export interface MCPServerOptions {
  /** Budget configuration */
  budgetConfig?: Partial<ReturnType<typeof loadBudgetConfig>>;
  /** Collector options */
  collectorOptions?: Partial<ConstructorParameters<typeof CostCollector>[0]>;
  /** Aggregator options */
  aggregatorOptions?: Partial<ConstructorParameters<typeof CostAggregator>[0]>;
  /** Callback when spans are flushed */
  onSpanFlush?: (spans: CostSpan[]) => void | Promise<void>;
}

/**
 * Create an MCP server for cost telemetry
 */
export function createCostTelemetryServer(options: MCPServerOptions = {}): Server {
  const {
    collectorOptions = { maxBufferSize: 1000, flushIntervalMs: 60000 },
    aggregatorOptions = {
      dimensions: ['tenant', 'feature', 'route', 'provider', 'model'],
      timeWindows: ['minute', 'hour', 'day', 'week', 'month'],
    },
    onSpanFlush,
  } = options;

  const aggregator = new CostAggregator(aggregatorOptions);
  const spanStore = new Map<string, CostSpan>();

  // Initialize components
  const collector = new CostCollector({
    ...collectorOptions,
    onFlush: async (spans): Promise<void> => {
      // Calculate costs for all spans
      for (const span of spans) {
        const { costUsd } = calculateCost({
          provider: span.provider,
          model: span.model,
          inputTokens: span.inputTokens,
          outputTokens: span.outputTokens,
          cacheReadTokens: span.cacheReadTokens,
          cacheCreationTokens: span.cacheCreationTokens,
        });
        span.costUsd = costUsd;
        if (span.id) {
          spanStore.set(span.id, { ...span });
        }
      }

      // Add to aggregator
      for (const span of spans) {
        aggregator.add(span);
      }

      // Call user callback
      if (onSpanFlush) {
        await onSpanFlush(spans);
      }
    },
  });

  const budgetConfig = options.budgetConfig ?? loadBudgetConfig();
  const budgetManager = new BudgetManager(budgetConfig);

  // Create server
  const server = new Server(
    {
      name: 'llm-cost-telemetry',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Layer 1: cost.span.* (Atomic Operations)
        {
          name: 'cost.span.record',
          description: 'Record a cost span for an LLM API call',
          inputSchema: {
            type: 'object',
            properties: {
              provider: {
                type: 'string',
                enum: ['openai', 'anthropic', 'google'],
                description: 'LLM provider',
              },
              model: {
                type: 'string',
                description: 'Model name (e.g., gpt-4, claude-opus-20240229)',
              },
              inputTokens: {
                type: 'number',
                description: 'Number of input tokens',
              },
              outputTokens: {
                type: 'number',
                description: 'Number of output tokens',
              },
              cacheReadTokens: {
                type: 'number',
                description: 'Number of cache read tokens (Anthropic only)',
              },
              cacheCreationTokens: {
                type: 'number',
                description: 'Number of cache creation tokens (Anthropic only)',
              },
              tenant: {
                type: 'string',
                description: 'Tenant identifier',
              },
              feature: {
                type: 'string',
                description: 'Feature identifier',
              },
              route: {
                type: 'string',
                description: 'Route identifier',
              },
            },
            required: ['provider', 'model', 'inputTokens', 'outputTokens'],
          },
        },
        {
          name: 'cost.span.get',
          description: 'Retrieve a cost span by ID',
          inputSchema: {
            type: 'object',
            properties: {
              spanId: {
                type: 'string',
                description: 'Span ID to retrieve',
              },
            },
            required: ['spanId'],
          },
        },
        {
          name: 'cost.span.flush',
          description: 'Flush all buffered spans',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },

        // Layer 2: cost.aggregate.* (Aggregation)
        {
          name: 'cost.aggregate.by_tenant',
          description: 'Get costs aggregated by tenant',
          inputSchema: {
            type: 'object',
            properties: {
              tenant: {
                type: 'string',
                description: 'Tenant identifier',
              },
              period: {
                type: 'string',
                enum: ['minute', 'hour', 'day', 'week', 'month'],
                description: 'Time period for aggregation',
              },
            },
            required: ['period'],
          },
        },
        {
          name: 'cost.aggregate.by_feature',
          description: 'Get costs aggregated by feature',
          inputSchema: {
            type: 'object',
            properties: {
              feature: {
                type: 'string',
                description: 'Feature identifier',
              },
              period: {
                type: 'string',
                enum: ['minute', 'hour', 'day', 'week', 'month'],
                description: 'Time period for aggregation',
              },
            },
            required: ['period'],
          },
        },
        {
          name: 'cost.aggregate.by_route',
          description: 'Get costs aggregated by route',
          inputSchema: {
            type: 'object',
            properties: {
              route: {
                type: 'string',
                description: 'Route identifier',
              },
              period: {
                type: 'string',
                enum: ['minute', 'hour', 'day', 'week', 'month'],
                description: 'Time period for aggregation',
              },
            },
            required: ['period'],
          },
        },
        {
          name: 'cost.aggregate.summary',
          description: 'Get cost summary for a time period',
          inputSchema: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['minute', 'hour', 'day', 'week', 'month'],
                description: 'Time period for aggregation',
              },
              groupBy: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['tenant', 'feature', 'route', 'provider', 'model'],
                },
                description: 'Dimensions to group by',
              },
            },
            required: ['period'],
          },
        },

        // Layer 3: cost.budget.* (Budget Management)
        {
          name: 'cost.budget.check',
          description: 'Check budget status for a tenant',
          inputSchema: {
            type: 'object',
            properties: {
              tenant: {
                type: 'string',
                description: 'Tenant identifier',
              },
              estimatedCost: {
                type: 'number',
                description: 'Estimated cost to check against budget',
              },
            },
            required: ['tenant', 'estimatedCost'],
          },
        },
        {
          name: 'cost.budget.set',
          description: 'Set budget limits for a tenant',
          inputSchema: {
            type: 'object',
            properties: {
              tenant: {
                type: 'string',
                description: 'Tenant identifier',
              },
              daily: {
                type: 'number',
                description: 'Daily budget limit in USD',
              },
              monthly: {
                type: 'number',
                description: 'Monthly budget limit in USD',
              },
            },
            required: ['tenant'],
          },
        },
        {
          name: 'cost.budget.alert',
          description: 'Configure budget alerts',
          inputSchema: {
            type: 'object',
            properties: {
              threshold: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Alert threshold (0-1)',
              },
              action: {
                type: 'string',
                enum: ['log', 'notify', 'block'],
                description: 'Action to take when threshold is reached',
              },
            },
            required: ['threshold', 'action'],
          },
        },
      ],
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'cost.span.record': {
          const parsed = SpanRecordSchema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { error: 'Invalid arguments', details: parsed.error.issues },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
          const {
            provider,
            model,
            inputTokens,
            outputTokens,
            cacheReadTokens,
            cacheCreationTokens,
            tenant,
            feature,
            route,
          } = parsed.data;

          const telemetry: Partial<TelemetryContext> = {};
          if (typeof tenant === 'string') telemetry.tenant = tenant;
          if (typeof feature === 'string') telemetry.feature = feature;
          if (typeof route === 'string') telemetry.route = route;

          const nowTime = now();
          const span: CostSpan = {
            id: generateId(),
            provider: provider as 'openai' | 'anthropic' | 'google',
            model: model as string,
            inputTokens: inputTokens as number,
            outputTokens: outputTokens as number,
            totalTokens: (inputTokens as number) + (outputTokens as number),
            costUsd: 0, // Will be calculated on flush
            startTime: nowTime,
            endTime: nowTime,
            durationMs: 0,
            cacheReadTokens: cacheReadTokens as number | undefined,
            cacheCreationTokens: cacheCreationTokens as number | undefined,
            telemetry,
            metadata: { estimated: false },
          };

          if (span.id) {
            spanStore.set(span.id, { ...span });
          }
          collector.add(span);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ span_id: span.id, status: 'recorded' }, null, 2),
              },
            ],
          };
        }

        case 'cost.span.get': {
          const parsed = SpanGetSchema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { error: 'Invalid arguments', details: parsed.error.issues },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
          const { spanId } = parsed.data;
          const bufferedSpan = collector.getSpans().find((span) => span.id === spanId);
          const span = bufferedSpan ?? spanStore.get(spanId) ?? aggregator.getSpan(spanId);

          if (!span) {
            return {
              content: [
                { type: 'text', text: JSON.stringify({ error: 'Span not found' }, null, 2) },
              ],
              isError: true,
            };
          }

          return {
            content: [{ type: 'text', text: JSON.stringify({ span }, null, 2) }],
          };
        }

        case 'cost.span.flush': {
          await collector.flush();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ flushed: true, remaining: collector.size }, null, 2),
              },
            ],
          };
        }

        // Layer 2: cost.aggregate.*
        case 'cost.aggregate.by_tenant': {
          const parsed = AggregateByTenantSchema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { error: 'Invalid arguments', details: parsed.error.issues },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
          const { tenant, period } = parsed.data;
          const records = tenant
            ? aggregator.getByTenant(tenant, (period as TimeWindow) ?? 'day')
            : aggregator.getAll();
          return {
            content: [{ type: 'text', text: JSON.stringify({ records }, null, 2) }],
          };
        }

        case 'cost.aggregate.by_feature': {
          const parsed = AggregateByFeatureSchema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { error: 'Invalid arguments', details: parsed.error.issues },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
          const { feature, period } = parsed.data;
          const records = feature
            ? aggregator.getByFeature(feature, (period as TimeWindow) ?? 'day')
            : aggregator.getAll();
          return {
            content: [{ type: 'text', text: JSON.stringify({ records }, null, 2) }],
          };
        }

        case 'cost.aggregate.by_route': {
          const parsed = AggregateByRouteSchema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { error: 'Invalid arguments', details: parsed.error.issues },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
          const { route, period } = parsed.data;
          const records = route
            ? aggregator.getByRoute(route, (period as TimeWindow) ?? 'day')
            : aggregator.getAll();
          return {
            content: [{ type: 'text', text: JSON.stringify({ records }, null, 2) }],
          };
        }

        case 'cost.aggregate.summary': {
          const parsed = AggregateSummarySchema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { error: 'Invalid arguments', details: parsed.error.issues },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
          const { period, groupBy } = parsed.data;
          const summary = aggregator.getSummary({
            period: (period as TimeWindow) ?? 'day',
            groupBy: groupBy as Array<'tenant' | 'feature' | 'route' | 'provider' | 'model'>,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify({ summary }, null, 2) }],
          };
        }

        // Layer 3: cost.budget.*
        case 'cost.budget.check': {
          const parsed = BudgetCheckSchema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { error: 'Invalid arguments', details: parsed.error.issues },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
          const { tenant, estimatedCost } = parsed.data;
          const status = await budgetManager.check({ tenant, estimatedCost });
          return {
            content: [{ type: 'text', text: JSON.stringify({ status }, null, 2) }],
          };
        }

        case 'cost.budget.set': {
          const parsed = BudgetSetSchema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { error: 'Invalid arguments', details: parsed.error.issues },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
          const { tenant, daily, monthly } = parsed.data;
          const limits: { daily?: number; monthly?: number } = {};
          if (typeof daily === 'number') limits.daily = daily;
          if (typeof monthly === 'number') limits.monthly = monthly;
          budgetManager.setLimits(tenant, limits);
          return {
            content: [
              { type: 'text', text: JSON.stringify({ success: true, tenant, limits }, null, 2) },
            ],
          };
        }

        case 'cost.budget.alert': {
          const parsed = BudgetAlertSchema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { error: 'Invalid arguments', details: parsed.error.issues },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
          const { threshold, action } = parsed.data;
          if (!budgetConfig.alerts) budgetConfig.alerts = [];
          budgetConfig.alerts.push({ threshold, action });
          return {
            content: [
              { type: 'text', text: JSON.stringify({ success: true, threshold, action }, null, 2) },
            ],
          };
        }

        default:
          return {
            content: [
              { type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2) },
            ],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: error instanceof Error ? error.message : String(error) },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
