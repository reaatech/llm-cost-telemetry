# Skill: Cost Optimization

## What It Is

Cost optimization uses the library's built-in tools to identify opportunities to reduce LLM spending through model selection, caching strategies, and usage pattern analysis. It provides functions for comparing model costs and calculating potential savings.

## Why It Matters

- **Reduce Costs** — Identify and eliminate wasteful spending
- **Model Selection** — Choose cost-effective models for each use case
- **Cache Optimization** — Maximize cache hit rates with Anthropic prompt caching
- **Usage Insights** — Understand spending patterns through aggregation

## How to Use It

### Compare Model Costs

```typescript
import { compareModelCosts } from '@reaatech/llm-cost-telemetry-calculator';

// Compare costs between models for the same workload
const comparison = compareModelCosts({
  inputTokens: 1000,
  outputTokens: 500,
  models: [
    { provider: 'openai', model: 'gpt-4' },
    { provider: 'openai', model: 'gpt-4-turbo' },
    { provider: 'anthropic', model: 'claude-3-opus-20240229' },
  ]
});

console.log('Cost comparison:');
comparison.forEach(rec => {
  console.log(`- ${rec.model}: $${rec.costUsd}/call`);
});
```

### Calculate Potential Savings

```typescript
import { calculateSavings } from '@reaatech/llm-cost-telemetry-calculator';

// Calculate savings from switching models
const savings = calculateSavings({
  inputTokens: 10000,
  outputTokens: 5000,
  currentModel: { provider: 'openai', model: 'gpt-4' },
  targetModel: { provider: 'openai', model: 'gpt-4-turbo' }
});

console.log(`Current cost: $${savings.currentCost}`);
console.log(`Target cost: $${savings.targetCost}`);
console.log(`Savings: $${savings.savings} (${savings.savingsPercentage}%)`);
```

### Use Cache-Aware Pricing (Anthropic)

```typescript
import { calculateCost } from '@reaatech/llm-cost-telemetry-calculator';

// With prompt caching enabled
const cachedCost = calculateCost({
  provider: 'anthropic',
  model: 'claude-opus-20240229',
  inputTokens: 1000,
  outputTokens: 500,
  cacheReadTokens: 800,    // Tokens read from cache (discounted)
  cacheCreationTokens: 200  // Tokens written to cache
});

console.log(`Cost with caching: $${cachedCost.costUsd}`);
console.log(`Cache read savings: $${cachedCost.breakdown.cacheReadCostUsd ?? 0}`);
```

### Analyze Costs by Dimension

```typescript
import { CostAggregator } from '@reaatech/llm-cost-telemetry-aggregation';

const aggregator = new CostAggregator();

// Get cost summary grouped by tenant and feature
const summary = aggregator.getSummary({
  period: 'day',
  groupBy: ['tenant', 'feature']
});

console.log('Cost breakdown:');
for (const [dim, data] of Object.entries(summary.byDimension ?? {})) {
  console.log(`  ${dim}: $${data.totalCost} (${data.totalCalls} calls)`);
}
```

### Set Budget Limits

```typescript
import { BudgetManager } from '@reaatech/llm-cost-telemetry-aggregation';

const budgetManager = new BudgetManager({
  global: { daily: 500.00, monthly: 10000.00 },
  tenants: {
    'acme-corp': { daily: 100.00, monthly: 2000.00 },
  },
  alerts: [
    { threshold: 0.5, action: 'log' },
    { threshold: 0.75, action: 'notify' },
    { threshold: 0.9, action: 'block' }
  ]
});

// Check before expensive calls
const status = await budgetManager.check({
  tenant: 'acme-corp',
  estimatedCost: 5.00
});

if (!status.withinBudget) {
  console.warn(`Budget exceeded: ${status.dailyPercentage}% used`);
}
```

## Key Metrics

| Metric | Description | Optimization Target |
|--------|-------------|---------------------|
| `cost_per_call` | Average cost per API call | Minimize |
| `cache_hit_rate` | Percentage of cached requests | Maximize |
| `cost_by_tenant` | Cost allocated per tenant | Track and limit |
| `cost_by_feature` | Cost per feature | Identify expensive features |
| `budget_utilization` | Budget usage percentage | Keep below threshold |

## Best Practices

1. **Compare models before choosing** — Use `compareModelCosts` for decisions
2. **Enable Anthropic prompt caching** — Cache system prompts for 50-90% savings
3. **Set budget alerts** — Progressive alerts (log → notify → block)
4. **Aggregate by dimension** — Track costs by tenant, feature, route
5. **Review regularly** — Use `getSummary` to analyze spending patterns

## Common Pitfalls

- **Over-optimizing** — Too much optimization can hurt quality
- **Ignoring context** — Some use cases need powerful models
- **No budget limits** — Set budgets to prevent runaway costs
- **Not using cache** — Anthropic prompt caching saves significant money

## Optimization Strategies

| Strategy | Savings Potential | How To |
|----------|-------------------|--------|
| Model downgrading | 50-90% | Use `compareModelCosts` to evaluate |
| Prompt caching | 20-60% | Use `cacheReadTokens`/`cacheCreationTokens` |
| Budget enforcement | Variable | Use `BudgetManager` with alerts |
| Feature analysis | Variable | Use `getSummary({ groupBy: ['feature'] })` |

## Cost Optimization Checklist

- [ ] Compare model costs for your use case
- [ ] Enable Anthropic prompt caching where applicable
- [ ] Set budget limits for all tenants
- [ ] Configure progressive alerts (50%, 75%, 90%)
- [ ] Aggregate costs by tenant and feature daily
- [ ] Review and iterate monthly

## Related Skills

- [Token Counting](../token-counting/skill.md)
- [Budget Alerts](../budget-alerts/skill.md)
- [Tenant Aggregation](../tenant-aggregation/skill.md)
- [Cost Interception](../cost-interception/skill.md)
