# @reaatech/llm-cost-telemetry-mcp

[![npm version](https://img.shields.io/npm/v/@reaatech/llm-cost-telemetry-mcp.svg)](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/llm-cost-telemetry/ci.yml?branch=main&label=CI)](https://github.com/reaatech/llm-cost-telemetry/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

MCP (Model Context Protocol) server that exposes LLM cost telemetry as MCP tools. Provides a three-layer tool architecture for recording cost spans, querying aggregated costs, and enforcing budget limits — all consumable by MCP clients like Claude Desktop, Cursor, and custom agent frameworks.

## Installation

```bash
npm install @reaatech/llm-cost-telemetry-mcp @modelcontextprotocol/sdk
# or
pnpm add @reaatech/llm-cost-telemetry-mcp @modelcontextprotocol/sdk
```

## Feature Overview

- **Three-layer MCP tool architecture** — atomic span operations, stateful aggregation, and budget enforcement
- **Cost span recording and retrieval** — record spans by ID, flush buffered spans
- **Multi-dimensional queries** — query by tenant, feature, or route with time windowing
- **Budget checks** — pre-call budget gating with cascading alert thresholds
- **Cost calculation on flush** — automatically calculates cost from token counts via the calculator engine
- **Pluggable span handler** — register a callback to forward spans to exporters or custom pipelines

## Quick Start

```typescript
import { createCostTelemetryServer } from "@reaatech/llm-cost-telemetry-mcp";

const server = createCostTelemetryServer({
  onSpanFlush: (spans) => {
    for (const span of spans) {
      console.log(`Cost: $${span.costUsd} (${span.provider}/${span.model})`);
    }
  },
});

// Connect via stdio — ready for MCP clients
await server.connect(transport);
```

## API Reference

### `createCostTelemetryServer(options?): Server`

Creates a fully configured MCP server with 10 tools across three layers.

```typescript
import { createCostTelemetryServer, type MCPServerOptions } from "@reaatech/llm-cost-telemetry-mcp";

const server = createCostTelemetryServer({
  collectorOptions: { maxBufferSize: 1000, flushIntervalMs: 60000 },
  aggregatorOptions: { dimensions: ["tenant", "feature", "route"] },
  budgetConfig: {
    tenants: { "acme-corp": { daily: 100, monthly: 2000 } },
  },
  onSpanFlush: (spans) => { /* forward to exporters */ },
});
```

#### `MCPServerOptions`

| Property | Type | Description |
|----------|------|-------------|
| `collectorOptions` | `CollectorOptions` | Buffer size and flush interval |
| `aggregatorOptions` | `AggregatorOptions` | Aggregation dimensions and time windows |
| `budgetConfig` | `BudgetConfig` | Budget limits and alert thresholds |
| `onSpanFlush` | `(spans: CostSpan[]) => void` | Callback when spans are flushed |

### Three-Layer Tool Architecture

#### Layer 1: `cost.span.*` — Atomic Operations

Fast, stateless operations for recording individual cost spans:

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `cost.span.record` | `{ provider, model, tokens, cost, tenant?, feature? }` | `{ span_id }` | Record a cost span |
| `cost.span.get` | `{ span_id }` | `{ span }` | Retrieve a span by ID |
| `cost.span.flush` | `{}` | `{ flushed }` | Flush buffered spans |

**Example: Record a cost span via MCP tool call**

```json
{
  "name": "cost.span.record",
  "arguments": {
    "provider": "openai",
    "model": "gpt-4",
    "inputTokens": 150,
    "outputTokens": 45,
    "tenant": "acme-corp",
    "feature": "chat-support"
  }
}
```

On flush, the server automatically calls `calculateCost()` to fill in `costUsd` from the token counts.

#### Layer 2: `cost.aggregate.*` — Aggregation

Stateful operations for cost aggregation by dimensions:

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `cost.aggregate.by_tenant` | `{ tenant, period? }` | `{ costs }` | Get costs by tenant |
| `cost.aggregate.by_feature` | `{ feature, period? }` | `{ costs }` | Get costs by feature |
| `cost.aggregate.by_route` | `{ route, period? }` | `{ costs }` | Get costs by route |
| `cost.aggregate.summary` | `{ period?, groupBy? }` | `{ summary }` | Get cost summary |

**Example: Query costs by tenant**

```json
{
  "name": "cost.aggregate.by_tenant",
  "arguments": {
    "tenant": "acme-corp",
    "period": "day"
  }
}
```

#### Layer 3: `cost.budget.*` — Budget Management

Opinionated operations for budget enforcement:

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `cost.budget.check` | `{ tenant, estimatedCost }` | `{ withinBudget, percentage }` | Check budget status |
| `cost.budget.set` | `{ tenant, limits }` | `{ success }` | Set budget limits |
| `cost.budget.alert` | `{ threshold, action }` | `{ success }` | Configure alert thresholds |

**Example: Check budget before API call**

```json
{
  "name": "cost.budget.check",
  "arguments": {
    "tenant": "acme-corp",
    "estimatedCost": 5.00
  }
}
```

Returns `{ withinBudget: true, dailyPercentage: 42, monthlyPercentage: 3, triggeredAlerts: ["log"] }`.

## Usage Patterns

### Integration with MCP Clients

```typescript
import { createCostTelemetryServer } from "@reaatech/llm-cost-telemetry-mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createCostTelemetryServer({
  onSpanFlush: (spans) => {
    // Forward spans to AWS CloudWatch, GCP Cloud Monitoring, etc.
  },
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Custom Aggregation Dimensions

```typescript
const server = createCostTelemetryServer({
  aggregatorOptions: {
    dimensions: ["tenant", "feature", "route", "provider", "model"],
    timeWindows: ["hour", "day", "week", "month"],
  },
});
```

### Budget Enforcement Flow

```
MCP Client                    MCP Server
    |                             |
    | cost.budget.check           |
    | { tenant, estimatedCost }   |
    |---------------------------->|
    |                             | → BudgetManager.check()
    | { withinBudget, ... }       |
    |<----------------------------|
    |                             |
    | cost.span.record            |
    | { provider, model, ... }    |
    |---------------------------->|
    | { span_id }                 | → CostCollector.add()
    |<----------------------------|
```

## Related Packages

- [@reaatech/llm-cost-telemetry](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry) — Core types and utilities
- [@reaatech/llm-cost-telemetry-calculator](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-calculator) — Cost calculation engine
- [@reaatech/llm-cost-telemetry-aggregation](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-aggregation) — Aggregation and budgets
- [@reaatech/llm-cost-telemetry-exporters](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-exporters) — Telemetry exporters

## License

[MIT](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
