# @reaatech/llm-cost-telemetry

[![npm version](https://img.shields.io/npm/v/@reaatech/llm-cost-telemetry.svg)](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/llm-cost-telemetry/ci.yml?branch=main&label=CI)](https://github.com/reaatech/llm-cost-telemetry/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Core types, Zod schemas, shared utilities, and configuration loaders for the `@reaatech/llm-cost-telemetry-*` ecosystem. This package is the foundation that every other package in the monorepo depends on.

## Installation

```bash
npm install @reaatech/llm-cost-telemetry
# or
pnpm add @reaatech/llm-cost-telemetry
```

## Feature Overview

- **40+ domain types** — `CostSpan`, `CostBreakdown`, `AggregationKey`, `BudgetConfig`, `TelemetryContext`, and more
- **35 Zod schemas** — runtime validation for every domain type at API boundaries
- **25 utility functions** — ID generation, time window math, cost calculation helpers, retry with backoff, hashing
- **Configuration loaders** — typed, validated env-var loaders for telemetry, budgets, and all three exporters
- **Zero runtime dependencies** beyond `zod` — lightweight and tree-shakeable
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import {
  generateId,
  now,
  loadConfig,
  calculateCostFromTokens,
  type CostSpan,
  type TelemetryContext,
} from "@reaatech/llm-cost-telemetry";

const span: CostSpan = {
  id: generateId(),
  provider: "openai",
  model: "gpt-4",
  inputTokens: 500,
  outputTokens: 200,
  costUsd: calculateCostFromTokens(700, 30), // $0.021
  tenant: "acme-corp",
  feature: "chat-support",
  timestamp: now(),
};

const config = loadConfig();
console.log(config.budget.global.daily); // 100.0
```

## Exports

### Domain Types

| Export | Description |
|--------|-------------|
| `CostSpan` | Single LLM API call record: id, provider, model, tokens, cost, timing, telemetry context |
| `CostBreakdown` | Input, output, cache read, and cache creation cost breakdown |
| `AggregationKey` | Aggregation dimension key: tenant, feature, route, provider, model, time window |
| `CostRecord` | Aggregated cost record with dimension metadata |
| `PricingTier` | Model pricing per 1M tokens: input, output, cache read, cache creation |
| `BudgetConfig` / `BudgetLimits` | Per-tenant budget limits with cascading defaults |
| `BudgetStatus` | Current budget utilization: daily/monthly percentages, triggered alerts |
| `TelemetryConfig` | OTel configuration: endpoint, service name, sampling rate |
| `TelemetryContext` | Telemetry context attached to API calls: tenant, feature, route, metadata |
| `CostSummary` | Aggregated cost summary grouped by dimension |

### Zod Schemas

Every domain type has a matching Zod schema for runtime validation:

```typescript
import { CostSpanSchema, TelemetryContextSchema } from "@reaatech/llm-cost-telemetry";

const span = CostSpanSchema.parse(rawData);     // throws on invalid input
const ctx = TelemetryContextSchema.parse(meta); // validates tenant/feature/route
```

43 schemas are exported, including typed input variants (`CostSpanInput`, `AggregationKeyInput`, etc.) inferred from partial schemas.

### Utilities

| Function | Description |
|----------|-------------|
| `generateId()` | UUID v4 via `crypto.randomUUID` |
| `now()` / `nowMs()` | Current timestamp as `Date` or milliseconds |
| `sleep(ms)` | Promise-based delay |
| `getWindowStart(date, window)` | Start of a time window (minute/hour/day/week/month) |
| `getWindowEnd(date, window)` | End of a time window |
| `formatISODate(date)` / `parseISODate(iso)` | ISO date formatting and parsing |
| `clamp(value, min, max)` | Number clamping |
| `percentage(part, total)` | Percentage calculation |
| `roundTo(value, decimals)` | Decimal rounding |
| `calculateCostFromTokens(tokens, pricePerMillion)` | (tokens / 1,000,000) × price |
| `deepClone(obj)` | JSON-based deep clone |
| `isEmpty(obj)` | Empty object check |
| `deepMerge(target, source)` | Recursive object merge |
| `retryWithBackoff(fn, options)` | Exponential backoff retry loop |
| `batchArray(arr, batchSize)` | Array batch chunking |
| `sanitizeLabel(value)` | Sanitize string for use as a metric label |
| `simpleHash(str)` | String hashing for grouping |
| `getEnvVar(name, default?)` / `getEnvInt` / `getEnvFloat` / `getEnvBool` | Environment variable loaders |

### Configuration

| Export | Description |
|--------|-------------|
| `loadConfig()` | Loads complete `AppConfig` from environment variables |
| `loadTelemetryConfig()` | OTel settings from `OTEL_*` env vars |
| `loadBudgetConfig()` | Budget limits with optional `TENANT_BUDGETS` JSON |
| `loadCloudWatchConfig()` | AWS CloudWatch exporter settings |
| `loadCloudMonitoringConfig()` | GCP Cloud Monitoring exporter settings |
| `loadPhoenixConfig()` | Grafana Loki/Phoenix exporter settings |
| `DEFAULT_CONFIG` | Hardcoded fallback configuration |

## Usage Patterns

### Runtime Validation at Boundaries

```typescript
import { CostSpanSchema, type CostSpan } from "@reaatech/llm-cost-telemetry";

function ingestSpan(raw: unknown): CostSpan {
  return CostSpanSchema.parse(raw); // throws ZodError on invalid data
}
```

### Time Window Arithmetic

```typescript
import { getWindowStart, getWindowEnd } from "@reaatech/llm-cost-telemetry";

const dayStart = getWindowStart(new Date(), "day");  // today at 00:00:00
const dayEnd = getWindowEnd(new Date(), "day");      // tomorrow at 00:00:00
```

### Configuration from Environment

```typescript
import { loadConfig } from "@reaatech/llm-cost-telemetry";

const config = loadConfig();
// Reads: OTEL_SERVICE_NAME, DEFAULT_DAILY_BUDGET, TENANT_BUDGETS,
//        AWS_REGION, GCP_PROJECT_ID, LOKI_HOST, and more
```

## Related Packages

- [@reaatech/llm-cost-telemetry-calculator](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-calculator) — Cost calculation engine
- [@reaatech/llm-cost-telemetry-providers](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-providers) — Provider SDK wrappers
- [@reaatech/llm-cost-telemetry-aggregation](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-aggregation) — Aggregation and budgets
- [@reaatech/llm-cost-telemetry-observability](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-observability) — OpenTelemetry integration
- [@reaatech/llm-cost-telemetry-exporters](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-exporters) — CloudWatch, Cloud Monitoring, Phoenix
- [@reaatech/llm-cost-telemetry-mcp](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-mcp) — MCP server
- [@reaatech/llm-cost-telemetry-cli](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-cli) — CLI tool

## License

[MIT](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
