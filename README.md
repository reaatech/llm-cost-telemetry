# llm-cost-telemetry

[![CI](https://github.com/reaatech/llm-cost-telemetry/actions/workflows/ci.yml/badge.svg)](https://github.com/reaatech/llm-cost-telemetry/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

> Production-ready LLM cost telemetry for tracking, aggregating, and exporting costs across OpenAI, Anthropic, and Google models — with multi-tenant aggregation, budget enforcement, and MCP integration.

This monorepo provides provider SDK wrappers, a cost calculation engine, aggregation and budget management, OpenTelemetry observability, cloud exporters, an MCP server, and a CLI — all designed for production LLM cost operations.

## Features

- **Provider SDK wrapping** — Drop-in wrappers for OpenAI, Anthropic, and Google Generative AI with automatic cost span emission
- **Cost calculation** — Provider-agnostic cost engine with cache-aware pricing and token counting via tiktoken
- **Multi-tenant aggregation** — Track costs by tenant, feature, route, provider, and model across time windows
- **Budget enforcement** — Per-tenant daily/monthly budget tracking with cascading alert thresholds (log, notify, block)
- **Observability** — OpenTelemetry tracing and metrics with Gen AI semantic conventions, plus structured Pino logging
- **Cloud exporters** — Push cost data to AWS CloudWatch, GCP Cloud Monitoring, and Grafana Loki/Phoenix
- **MCP server** — Three-layer MCP tool architecture (atomic span ops, aggregation queries, budget checks)
- **CLI** — Generate cost reports, check budgets, and trigger exports from the command line

## Installation

### Using the packages

Packages are published under the `@reaatech` scope and can be installed individually:

```bash
# Core types, schemas, utilities, and configuration
pnpm add @reaatech/llm-cost-telemetry

# Cost calculation engine (pricing, token counting)
pnpm add @reaatech/llm-cost-telemetry-calculator

# Provider SDK wrappers (OpenAI, Anthropic, Google)
pnpm add @reaatech/llm-cost-telemetry-providers

# Cost collection, aggregation, and budget enforcement
pnpm add @reaatech/llm-cost-telemetry-aggregation

# OpenTelemetry tracing, metrics, and structured logging
pnpm add @reaatech/llm-cost-telemetry-observability

# Exporters (CloudWatch, Cloud Monitoring, Loki/Phoenix)
pnpm add @reaatech/llm-cost-telemetry-exporters

# MCP server for agent integration
pnpm add @reaatech/llm-cost-telemetry-mcp

# CLI tool for reports, budget checks, and exports
pnpm add @reaatech/llm-cost-telemetry-cli
```

### Contributing

```bash
# Clone the repository
git clone https://github.com/reaatech/llm-cost-telemetry.git
cd llm-cost-telemetry

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the test suite
pnpm test

# Run linting
pnpm lint
```

## Quick Start

### Wrap Your Provider SDK

```typescript
import { wrapOpenAI } from "@reaatech/llm-cost-telemetry-providers";
import OpenAI from "openai";

const client = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

const response = await client.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }],
  telemetry: {
    tenant: "acme-corp",
    feature: "chat-support",
    route: "/api/chat",
  },
});
```

### Calculate and Aggregate Costs

```typescript
import { calculateCost } from "@reaatech/llm-cost-telemetry-calculator";
import { CostCollector, CostAggregator } from "@reaatech/llm-cost-telemetry-aggregation";

const { costUsd, breakdown } = calculateCost({
  provider: "openai",
  model: "gpt-4",
  inputTokens: 150,
  outputTokens: 45,
});

const collector = new CostCollector();
const aggregator = new CostAggregator({ dimensions: ["tenant"] });

collector.onFlush = (spans) => spans.forEach((s) => aggregator.add(s));
```

### Check Budget Before API Calls

```typescript
import { BudgetManager } from "@reaatech/llm-cost-telemetry-aggregation";

const budget = new BudgetManager({
  tenants: { "acme-corp": { daily: 100, monthly: 2000 } },
});

const status = await budget.check({ tenant: "acme-corp", estimatedCost: 5.00 });

if (!status.withinBudget) {
  throw new Error(`Budget exhausted: ${status.dailyPercentage}% used`);
}
```

### Export to CloudWatch

```typescript
import { CloudWatchExporter } from "@reaatech/llm-cost-telemetry-exporters";

const exporter = new CloudWatchExporter({
  region: "us-east-1",
  namespace: "LLM/Costs",
  emfEnabled: true,
});

await exporter.exportSpans(spans);
```

## Packages

| Package | Description |
|---------|-------------|
| [`@reaatech/llm-cost-telemetry`](./packages/core) | Core types, Zod schemas, utilities, and configuration |
| [`@reaatech/llm-cost-telemetry-calculator`](./packages/calculator) | Cost calculation engine with pricing, token counting, and estimation |
| [`@reaatech/llm-cost-telemetry-providers`](./packages/providers) | Provider SDK wrappers for OpenAI, Anthropic, and Google |
| [`@reaatech/llm-cost-telemetry-aggregation`](./packages/aggregation) | Span collection, multi-dimensional aggregation, and budget enforcement |
| [`@reaatech/llm-cost-telemetry-observability`](./packages/observability) | OpenTelemetry tracing, metrics, and Pino-based structured logging |
| [`@reaatech/llm-cost-telemetry-exporters`](./packages/exporters) | CloudWatch, Cloud Monitoring, and Loki/Phoenix exporters |
| [`@reaatech/llm-cost-telemetry-mcp`](./packages/mcp) | MCP server with three-layer cost telemetry tools |
| [`@reaatech/llm-cost-telemetry-cli`](./packages/cli) | CLI for cost reports, budget checks, and export triggering |

## Provider Support

| Provider | Models | Cache Support |
|----------|--------|---------------|
| OpenAI | GPT-4, GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo | No |
| Anthropic | Claude Opus, Sonnet, Haiku | Yes (prompt caching) |
| Google | Gemini Pro, Gemini 1.5 | No |

## CLI Reference

```bash
# Generate cost report
npx llm-cost-telemetry report --tenant acme-corp --period day --format table

# Check budget status
npx llm-cost-telemetry check --tenant acme-corp

# Export to CloudWatch
npx llm-cost-telemetry export --exporter cloudwatch --period hour

# Dry-run export (preview without sending)
npx llm-cost-telemetry export --exporter cloudwatch --dry-run
```

## Three-Layer MCP Tools

The MCP server exposes 10 tools across three layers:

**Layer 1 — `cost.span.*`:** `record`, `get`, `flush`

**Layer 2 — `cost.aggregate.*`:** `by_tenant`, `by_feature`, `by_route`, `summary`

**Layer 3 — `cost.budget.*`:** `check`, `set`, `alert`

## Documentation

- [`AGENTS.md`](./AGENTS.md) — Agent development guide
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System design and data flows
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Contribution workflow and release process

## License

[MIT](LICENSE)
