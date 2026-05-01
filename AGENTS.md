---
agent_id: "llm-cost-telemetry"
display_name: "LLM Cost Telemetry"
version: "0.1.0"
description: "Cost tracking and telemetry for LLM API usage"
type: "mcp"
confidence_threshold: 0.9
---

# llm-cost-telemetry — Agent Development Guide

## What this is

This document defines how to use the `@reaatech/llm-cost-telemetry-*` packages to track, aggregate, and export LLM costs in production applications. It covers provider SDK wrapping, cost calculation, multi-tenant aggregation, and integration with CloudWatch, Cloud Monitoring, and Grafana Loki.

**Target audience:** Engineers building production LLM-powered applications who need accurate cost tracking, multi-tenant cost allocation, budget enforcement, and integration with existing observability stacks.

---

## Monorepo Structure

```
llm-cost-telemetry/
├── packages/
│   ├── core/           @reaatech/llm-cost-telemetry
│   ├── calculator/     @reaatech/llm-cost-telemetry-calculator
│   ├── providers/      @reaatech/llm-cost-telemetry-providers
│   ├── aggregation/    @reaatech/llm-cost-telemetry-aggregation
│   ├── observability/  @reaatech/llm-cost-telemetry-observability
│   ├── exporters/      @reaatech/llm-cost-telemetry-exporters
│   ├── mcp/            @reaatech/llm-cost-telemetry-mcp
│   └── cli/            @reaatech/llm-cost-telemetry-cli
├── skills/
├── pnpm-workspace.yaml
├── turbo.json
└── biome.json
```

### Dependency Graph

```
                    ┌────────────────────────────┐
                    │     @reaatech/              │
                    │  llm-cost-telemetry (core)  │
                    │  types, schemas, utils,     │
                    │  config                     │
                    └──────────┬─────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        v                      v                      v
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  calculator   │    │   providers   │    │  aggregation  │
│  cost engine  │    │  SDK wrappers │    │  collector,   │
│  pricing,     │    │  OpenAI,      │    │  aggregator,  │
│  tokens       │    │  Anthropic,   │    │  budget mgr   │
│               │    │  Google       │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
        │                                       │
        │         ┌───────────────┐              │
        │         │ observability │              │
        │         │  OTel tracing │              │
        │         │  metrics,     │              │
        │         │  logging      │              │
        │         └───────┬───────┘              │
        │                 │                      │
        │    ┌────────────┼──────────────┐       │
        │    v            v              v       │
        │ ┌───────────────────────────────┐     │
        │ │        exporters              │     │
        │ │ CloudWatch, Cloud Monitoring, │     │
        │ │ Phoenix/Loki                  │     │
        │ └───────────────────────────────┘     │
        │                                       │
        v                         v             v
┌───────────────┐    ┌───────────────────────────────┐
│      mcp      │    │             cli               │
│  MCP server   │    │  report, check, export        │
│  3-layer      │    │  commands                     │
│  tools        │    │                               │
└───────────────┘    └───────────────────────────────┘
```

---

## Key Components

| Component | Package | Purpose |
|-----------|---------|---------|
| **Core Types** | `@reaatech/llm-cost-telemetry` | Domain types, Zod schemas, utilities, configuration loaders |
| **Cost Calculator** | `@reaatech/llm-cost-telemetry-calculator` | Pricing lookup, token counting, cost estimation |
| **Provider Wrappers** | `@reaatech/llm-cost-telemetry-providers` | Wrap OpenAI, Anthropic, Google SDKs |
| **Aggregation** | `@reaatech/llm-cost-telemetry-aggregation` | Collect, aggregate, and enforce budgets |
| **Observability** | `@reaatech/llm-cost-telemetry-observability` | OTel tracing, metrics, Pino logging |
| **Exporters** | `@reaatech/llm-cost-telemetry-exporters` | CloudWatch, Cloud Monitoring, Loki/Phoenix |
| **MCP Server** | `@reaatech/llm-cost-telemetry-mcp` | Three-layer MCP tools for agent integration |
| **CLI** | `@reaatech/llm-cost-telemetry-cli` | Command-line reports, budget checks, exports |

---

## Three-Layer MCP Tool Architecture

The `@reaatech/llm-cost-telemetry-mcp` package exposes three distinct tool groups:

### Layer 1: cost.span.* (Atomic Operations)

Fast, stateless operations for recording individual cost spans:

| Tool | Input | Output | Use Case |
|------|-------|--------|----------|
| `cost.span.record` | `{ provider, model, tokens, cost }` | `{ span_id }` | Record a cost span |
| `cost.span.get` | `{ span_id }` | `{ span }` | Retrieve span by ID |
| `cost.span.flush` | `{}` | `{ flushed }` | Flush buffered spans |

**Example: Record a cost span**

```json
{
  "name": "cost.span.record",
  "arguments": {
    "provider": "openai",
    "model": "gpt-4",
    "inputTokens": 150,
    "outputTokens": 45,
    "costUsd": 0.0123,
    "tenant": "acme-corp",
    "feature": "chat-support"
  }
}
```

### Layer 2: cost.aggregate.* (Aggregation)

Stateful operations for cost aggregation by dimensions:

| Tool | Input | Output | Use Case |
|------|-------|--------|----------|
| `cost.aggregate.by_tenant` | `{ tenant, period }` | `{ costs }` | Get costs by tenant |
| `cost.aggregate.by_feature` | `{ feature, period }` | `{ costs }` | Get costs by feature |
| `cost.aggregate.by_route` | `{ route, period }` | `{ costs }` | Get costs by route |
| `cost.aggregate.summary` | `{ period, groupBy }` | `{ summary }` | Get cost summary |

**Example: Get costs by tenant**

```json
{
  "name": "cost.aggregate.by_tenant",
  "arguments": {
    "tenant": "acme-corp",
    "period": "day"
  }
}
```

### Layer 3: cost.budget.* (Budget Management)

Opinionated operations for budget enforcement:

| Tool | Input | Output | Use Case |
|------|-------|--------|----------|
| `cost.budget.check` | `{ tenant, estimatedCost }` | `{ withinBudget, percentage }` | Check budget status |
| `cost.budget.set` | `{ tenant, limits }` | `{ success }` | Set budget limits |
| `cost.budget.alert` | `{ threshold, action }` | `{ success }` | Configure alerts |

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

---

## Provider Wrapping

### Wrap OpenAI Client

```typescript
import { wrapOpenAI } from '@reaatech/llm-cost-telemetry-providers';
import OpenAI from 'openai';

const client = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  telemetry: {
    tenant: 'acme-corp',
    feature: 'chat-support',
    route: '/api/chat'
  }
});
```

### Wrap Anthropic Client

```typescript
import { wrapAnthropic } from '@reaatech/llm-cost-telemetry-providers';
import Anthropic from '@anthropic-ai/sdk';

const client = wrapAnthropic(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const response = await client.messages.create({
  model: 'claude-opus-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
  system: 'You are a helpful assistant.',
  telemetry: {
    tenant: 'acme-corp',
    feature: 'chat-support'
  }
});
```

### Wrap Google Client

```typescript
import { wrapGoogleGenerativeAI } from '@reaatech/llm-cost-telemetry-providers';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = wrapGoogleGenerativeAI(new GoogleGenerativeAI(process.env.GOOGLE_API_KEY));

const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

const response = await model.generateContent('Hello!', {
  telemetry: {
    tenant: 'acme-corp',
    feature: 'chat-support'
  }
});
```

---

## Multi-Tenant Aggregation

### Configure Aggregation

```typescript
import { CostAggregator } from '@reaatech/llm-cost-telemetry-aggregation';

const aggregator = new CostAggregator({
  dimensions: ['tenant', 'feature', 'route'],
  timeWindows: ['minute', 'hour', 'day']
});
```

### Get Cost Summary

```typescript
import { CostAggregator } from '@reaatech/llm-cost-telemetry-aggregation';

const aggregator = new CostAggregator();

const summary = aggregator.getSummary({
  period: 'month',
  groupBy: ['tenant', 'feature']
});

console.log('Cost Summary:');
console.log(`Total: $${summary.totalUsd}`);
```

---

## Budget Management

### Configure Budgets

```typescript
import { BudgetManager } from '@reaatech/llm-cost-telemetry-aggregation';

const budgetManager = new BudgetManager({
  global: {
    daily: 500.00,
    monthly: 10000.00
  },
  tenants: {
    'acme-corp': { daily: 100.00, monthly: 2000.00 },
    'startup-inc': { daily: 50.00, monthly: 1000.00 }
  },
  alerts: [
    { threshold: 0.5, action: 'log' },
    { threshold: 0.75, action: 'notify' },
    { threshold: 0.9, action: 'block' }
  ]
});
```

### Check Budget Before API Call

```typescript
import { BudgetManager } from '@reaatech/llm-cost-telemetry-aggregation';

const budgetManager = new BudgetManager({
  tenants: { 'acme-corp': { daily: 100.00 } }
});

const status = await budgetManager.check({
  tenant: 'acme-corp',
  estimatedCost: 5.00
});

if (!status.withinBudget) {
  console.warn(`Budget exceeded: ${status.dailyPercentage}% used`);
  throw new Error('Budget exhausted');
}
```

---

## Exporter Configuration

### CloudWatch Export

```typescript
import { CloudWatchExporter } from '@reaatech/llm-cost-telemetry-exporters';

const exporter = new CloudWatchExporter({
  region: 'us-east-1',
  namespace: 'LLM/Costs',
  emfEnabled: true,
  logGroupName: '/aws/llm/costs'
});
```

### Cloud Monitoring Export

```typescript
import { CloudMonitoringExporter } from '@reaatech/llm-cost-telemetry-exporters';

const exporter = new CloudMonitoringExporter({
  projectId: 'my-gcp-project',
  metricTypePrefix: 'custom.googleapis.com/llm',
  resourceType: 'gce_instance'
});
```

### Phoenix/Loki Export

```typescript
import { PhoenixExporter } from '@reaatech/llm-cost-telemetry-exporters';

const exporter = new PhoenixExporter({
  host: 'http://loki:3100',
  defaultLabels: {
    service: 'llm-cost-telemetry',
    environment: 'production'
  }
});
```

---

## CLI Reference

```bash
# Generate cost report
npx llm-cost-telemetry report \
  --tenant acme-corp \
  --period day \
  --format json

# Check budget status
npx llm-cost-telemetry check \
  --tenant acme-corp \
  --threshold 0.8

# Manual export trigger
npx llm-cost-telemetry export \
  --exporter cloudwatch \
  --period hour
```

---

## Security Considerations

### API Key Management

- All provider API keys from environment variables
- Never log API keys or tokens
- Separate keys per provider for isolation

### PII Handling

- **No conversation content** — Only token counts and cost data
- **No user identifiers** — Tenant IDs are opaque strings
- **Configurable redaction** — Pattern-based redaction for any accidental captures

### Cost Controls

- Set budget limits to prevent runaway costs
- Use cost estimation before running expensive operations
- Monitor costs in real-time with alerts

---

## Observability

### Structured Logging

Every cost event is logged via `@reaatech/llm-cost-telemetry-observability`:

```json
{
  "timestamp": "2026-04-30T17:00:00Z",
  "service": "llm-cost-telemetry",
  "span_id": "abc123",
  "trace_id": "def456",
  "level": "info",
  "message": "Cost span recorded",
  "provider": "openai",
  "model": "gpt-4",
  "input_tokens": 150,
  "output_tokens": 45,
  "cost_usd": 0.0123,
  "tenant": "acme-corp",
  "feature": "chat-support"
}
```

### OpenTelemetry Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `gen_ai.client.token.use` | Counter | `provider`, `model`, `type` | Token usage |
| `gen_ai.client.operation.duration` | Histogram | `provider`, `model`, `tenant` | Cost in USD |
| `gen_ai.client.operation.calls` | Counter | `provider`, `model`, `status` | API calls |
| `llm.budget.utilization` | UpDownCounter | `tenant` | Budget usage % |

---

## Checklist: Production Readiness

Before deploying cost telemetry to production:

- [ ] All provider SDKs wrapped with telemetry
- [ ] Tenant context included in every call
- [ ] Budgets configured for all tenants
- [ ] Alert thresholds set appropriately
- [ ] Exporters configured and tested
- [ ] OTel integration verified
- [ ] PII redaction verified
- [ ] Cost accuracy validated (within 1% of billing)
- [ ] Budget enforcement tested
- [ ] Dashboard created for cost monitoring

---

## References

- **ARCHITECTURE.md** — System design deep dive
- **README.md** — Quick start and overview
- **skills/** — Agent development skills
- **MCP Specification** — https://modelcontextprotocol.io/
