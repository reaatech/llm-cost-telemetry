# @reaatech/llm-cost-telemetry-aggregation

[![npm version](https://img.shields.io/npm/v/@reaatech/llm-cost-telemetry-aggregation.svg)](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-aggregation)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/llm-cost-telemetry/ci.yml?branch=main&label=CI)](https://github.com/reaatech/llm-cost-telemetry/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Cost collection, multi-dimensional aggregation, and budget enforcement for LLM cost telemetry. Provides buffered span collection, stateful aggregation by tenant/feature/route/model, and per-tenant budget checking with cascading alert thresholds.

## Installation

```bash
npm install @reaatech/llm-cost-telemetry-aggregation
# or
pnpm add @reaatech/llm-cost-telemetry-aggregation
```

## Feature Overview

- **Cost collection** — in-memory buffer with configurable size and auto-flush
- **Multi-dimensional aggregation** — group costs by tenant, feature, route, provider, and model
- **Time-windowed queries** — query by minute, hour, day, week, or month
- **Budget enforcement** — per-tenant daily/monthly budgets with cascading defaults
- **Alert thresholds** — configurable log/notify/block actions at 50%/75%/90% utilization
- **Periodic auto-reset** — daily and monthly counters reset automatically when periods roll over

## Quick Start

```typescript
import {
  CostCollector,
  CostAggregator,
  BudgetManager,
} from "@reaatech/llm-cost-telemetry-aggregation";

const collector = new CostCollector({ maxBufferSize: 1000, flushIntervalMs: 60000 });
const aggregator = new CostAggregator({
  dimensions: ["tenant", "feature", "provider", "model"],
  timeWindows: ["hour", "day", "month"],
});
const budget = new BudgetManager({
  tenants: {
    "acme-corp": { daily: 100, monthly: 2000 },
    "startup-inc": { daily: 50, monthly: 1000 },
  },
});

collector.onFlush = (spans) => {
  for (const span of spans) {
    aggregator.add(span);
    budget.record(span);
  }
};
```

## API Reference

### `CostCollector`

Buffered span collection with configurable auto-flush:

```typescript
import { CostCollector, type CollectorOptions } from "@reaatech/llm-cost-telemetry-aggregation";

const collector = new CostCollector({ maxBufferSize: 1000, flushIntervalMs: 60000 });
```

#### `CollectorOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxBufferSize` | `number` | `1000` | Max spans before auto-flush triggers |
| `flushIntervalMs` | `number` | `60000` | Auto-flush interval in milliseconds |

#### Methods

| Method | Description |
|--------|-------------|
| `add(span)` | Buffer a span; auto-flushes if buffer is full |
| `flush()` | Manually trigger flush of buffered spans |
| `close()` | Graceful shutdown — flushes remaining spans, clears interval |

#### Event

| Property | Type | Description |
|----------|------|-------------|
| `onFlush` | `(spans: CostSpan[]) => void` | Callback fired when a flush occurs |

### `CostAggregator`

Stateful multi-dimensional aggregation:

```typescript
import { CostAggregator, type AggregatorOptions } from "@reaatech/llm-cost-telemetry-aggregation";

const aggregator = new CostAggregator({
  dimensions: ["tenant", "feature", "route", "provider", "model"],
  timeWindows: ["minute", "hour", "day", "week", "month"],
});
```

#### `AggregatorOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `dimensions` | `string[]` | `["tenant"]` | Dimensions to group by |
| `timeWindows` | `string[]` | `["hour", "day"]` | Time windows to aggregate over |
| `maxRecords` | `number` | `10000` | Max records before eviction |

#### Methods

| Method | Description |
|--------|-------------|
| `add(span)` | Add a span to all matching time windows and dimensions |
| `getByTenant(tenant, period?)` | Query costs for a tenant |
| `getByFeature(feature, period?)` | Query costs for a feature |
| `getByRoute(route, period?)` | Query costs for a route |
| `getSummary(options?)` | Get a `CostSummary` grouped by configurable dimensions |

#### Query Example

```typescript
const tenantCosts = aggregator.getByTenant("acme-corp");
console.log(tenantCosts.totalUsd);       // $42.50
console.log(tenantCosts.byProvider);     // { openai: 30, anthropic: 12.5 }

const summary = aggregator.getSummary({ period: "month", groupBy: ["tenant", "feature"] });
```

### `BudgetManager`

Per-tenant budget tracking and enforcement:

```typescript
import { BudgetManager } from "@reaatech/llm-cost-telemetry-aggregation";

const budget = new BudgetManager({
  global: {
    daily: 500,
    monthly: 10000,
  },
  tenants: {
    "acme-corp": { daily: 100, monthly: 2000 },
  },
  alerts: [
    { threshold: 0.5, action: "log" },
    { threshold: 0.75, action: "notify" },
    { threshold: 0.9, action: "block" },
  ],
});
```

#### Constructor Options

| Property | Type | Description |
|----------|------|-------------|
| `global` | `BudgetLimits` | Default daily/monthly limits for all tenants |
| `tenants` | `Record<string, BudgetLimits>` | Per-tenant overrides |
| `alerts` | `AlertConfig[]` | Thresholds and actions |

#### `BudgetLimits`

| Property | Type | Description |
|----------|------|-------------|
| `daily` | `number` | Daily budget cap in USD |
| `monthly` | `number` | Monthly budget cap in USD |

#### Methods

| Method | Description |
|--------|-------------|
| `check(options)` | Returns `BudgetStatus` with percentages and triggered alerts |
| `record(span)` | Add a span's cost to running daily/monthly totals |
| `setLimits(tenant, limits)` | Update budget limits for a tenant |
| `getStatus(tenant)` | Get current budget status for a tenant |
| `reset()` | Reset all counters |

#### Budget Check Before API Call

```typescript
const status = await budget.check({
  tenant: "acme-corp",
  estimatedCost: 5.00,
});

if (!status.withinBudget) {
  console.warn(`Budget at ${status.dailyPercentage}%`);
  throw new Error("Budget exhausted");
}
```

#### `BudgetStatus`

| Property | Type | Description |
|----------|------|-------------|
| `withinBudget` | `boolean` | Whether the estimated cost fits within remaining budget |
| `dailyPercentage` | `number` | Percentage of daily budget consumed |
| `monthlyPercentage` | `number` | Percentage of monthly budget consumed |
| `triggeredAlerts` | `AlertAction[]` | Alerts triggered at current utilization |

## Usage Patterns

### Full Pipeline

```typescript
const collector = new CostCollector({ maxBufferSize: 500 });
const aggregator = new CostAggregator({ dimensions: ["tenant"] });
const budget = new BudgetManager({
  tenants: { "acme-corp": { daily: 100, monthly: 2000 } },
});

collector.onFlush = (spans) => {
  for (const span of spans) {
    aggregator.add(span);
    budget.record(span);
  }
};

const status = budget.getStatus("acme-corp");
console.log(`Daily: ${status.dailyPercentage}% | Monthly: ${status.monthlyPercentage}%`);
```

### Budget Gating Flow

```typescript
async function callLLMWithBudget(tenant: string, estimatedCost: number) {
  const status = await budget.check({ tenant, estimatedCost });

  if (!status.withinBudget) {
    if (status.triggeredAlerts.includes("block")) {
      throw new Error(`Tenant ${tenant} budget exhausted`);
    }
    console.warn(`Tenant ${tenant} at ${status.dailyPercentage}%`);
  }

  const span = await makeLLMCall();
  collector.add(span);
}
```

## Related Packages

- [@reaatech/llm-cost-telemetry](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry) — Core types and utilities
- [@reaatech/llm-cost-telemetry-calculator](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-calculator) — Cost calculation engine
- [@reaatech/llm-cost-telemetry-providers](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-providers) — Provider SDK wrappers

## License

[MIT](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
