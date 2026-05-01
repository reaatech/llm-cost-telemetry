# Skill: Tenant Aggregation

## What It Is

Tenant aggregation collects and summarizes LLM costs by tenant, feature, route, and time windows. It enables multi-tenant SaaS applications to track costs per customer, identify expensive features, and enforce budget limits.

## Why It Matters

- **Multi-Tenant Billing** — Accurate cost allocation per customer
- **Feature Cost Analysis** — Identify which features drive costs
- **Budget Enforcement** — Prevent cost overruns per tenant
- **Time-Windowed Reports** — Daily, weekly, monthly cost breakdowns

## How to Use It

### Configure Aggregation

```typescript
import { CostAggregator } from '@reaatech/llm-cost-telemetry-aggregation';

const aggregator = new CostAggregator({
  dimensions: ['tenant', 'feature', 'route'],
  timeWindows: ['minute', 'hour', 'day']
});
```

### Record Costs with Tenant Context

```typescript
import { wrapOpenAI } from '@reaatech/llm-cost-telemetry-providers';

const client = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// Include tenant context in every call
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  telemetry: {
    tenant: 'acme-corp',
    feature: 'chat-support',
    route: '/api/v1/chat'
  }
});
```

### Get Costs by Tenant

```typescript
import { CostAggregator } from '@reaatech/llm-cost-telemetry-aggregation';

const aggregator = new CostAggregator();

// Get costs for a specific tenant
const costs = aggregator.getByTenant('acme-corp', 'day');

const totalUsd = costs.reduce((sum, c) => sum + (c.totalCostUsd ?? 0), 0);
console.log(`Total cost for acme-corp: $${totalUsd}`);
```

### Get Costs by Feature

```typescript
import { CostAggregator } from '@reaatech/llm-cost-telemetry-aggregation';

const aggregator = new CostAggregator();

// Get costs for a specific feature across all tenants
const costs = aggregator.getByFeature('chat-support', 'week');

const totalUsd = costs.reduce((sum, c) => sum + (c.totalCostUsd ?? 0), 0);
console.log(`Chat support costs this week: $${totalUsd}`);
```

### Get Cost Summary

```typescript
import { CostAggregator } from '@reaatech/llm-cost-telemetry-aggregation';

const aggregator = new CostAggregator();

// Get overall cost summary
const summary = aggregator.getSummary({
  period: 'month',
  groupBy: ['tenant', 'feature']
});

console.log('Cost Summary:');
console.log(`Total: $${summary.totalUsd}`);
console.log(`By tenant:`, summary.byDimension?.tenant);
console.log(`By feature:`, summary.byDimension?.feature);
```

## Key Metrics

| Metric | Description | Dimensions |
|--------|-------------|------------|
| `total_cost` | Total cost for period | tenant, feature, route |
| `input_tokens` | Total input tokens | tenant, feature, route |
| `output_tokens` | Total output tokens | tenant, feature, route |
| `api_calls` | Number of API calls | tenant, feature, route |
| `avg_cost_per_call` | Average cost per call | tenant, feature |

## Best Practices

1. **Always include tenant context** — Every LLM call should have a tenant
2. **Use consistent tenant IDs** — Don't change tenant ID formats
3. **Set appropriate flush intervals** — Balance freshness vs. performance
4. **Monitor buffer size** — Prevent memory issues with large buffers
5. **Export regularly** — Don't rely solely on in-memory aggregation

## Common Pitfalls

- **Missing tenant context** — Costs can't be allocated without tenant
- **Inconsistent dimensions** — Use the same dimension set everywhere
- **Too small buffers** — Causes excessive flushing and overhead
- **No time windowing** — Makes historical analysis difficult

## Aggregation Dimensions

| Dimension | Use Case | Example Values |
|-----------|----------|----------------|
| `tenant` | Multi-tenant billing | `acme-corp`, `startup-inc` |
| `feature` | Feature cost analysis | `chat-support`, `summarization` |
| `route` | API endpoint costs | `/api/v1/chat`, `/api/v1/summary` |
| `model` | Model cost comparison | `gpt-4`, `claude-opus` |
| `provider` | Provider cost comparison | `openai`, `anthropic` |

## Related Skills

- [Cost Interception](../cost-interception/skill.md)
- [Budget Alerts](../budget-alerts/skill.md)
- [CloudWatch Export](../cloudwatch-export/skill.md)
