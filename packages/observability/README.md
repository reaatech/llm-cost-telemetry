# @reaatech/llm-cost-telemetry-observability

[![npm version](https://img.shields.io/npm/v/@reaatech/llm-cost-telemetry-observability.svg)](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-observability)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/llm-cost-telemetry/ci.yml?branch=main&label=CI)](https://github.com/reaatech/llm-cost-telemetry/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

OpenTelemetry tracing, metrics instrumentation, and structured logging for LLM cost telemetry. Provides ready-to-use managers for distributed tracing (OTLP), cost-specific metrics (tokens, duration, budget), and Pino-based logging with PII redaction.

## Installation

```bash
npm install @reaatech/llm-cost-telemetry-observability
# or
pnpm add @reaatech/llm-cost-telemetry-observability
```

## Feature Overview

- **OTLP tracing** — automatic span creation with Gen AI semantic conventions
- **Cost metrics** — counters and histograms for token usage, cost amount, API calls, errors, and budget utilization
- **Structured logging** — Pino-based with PII redaction (API keys, bearer tokens)
- **Singleton loggers** — `getLogger()` returns the same instance across your application
- **Configurable sampling** — control trace sample rate via environment or code

## Quick Start

```typescript
import { TracingManager, MetricsManager, getLogger } from "@reaatech/llm-cost-telemetry-observability";

const tracer = new TracingManager({
  serviceName: "my-llm-app",
  otlpEndpoint: "http://localhost:4318/v1/traces",
});
await tracer.init();

const metrics = new MetricsManager({
  serviceName: "my-llm-app",
  otlpEndpoint: "http://localhost:4318/v1/metrics",
});
await metrics.init();

const logger = getLogger({ name: "llm-cost" });
logger.logCostSpan(span);
```

## API Reference

### `TracingManager`

OpenTelemetry tracing with OTLP export:

```typescript
import { TracingManager, type TracingOptions } from "@reaatech/llm-cost-telemetry-observability";

const tracer = new TracingManager({
  serviceName: "my-llm-app",
  serviceVersion: "1.0.0",
  environment: "production",
  otlpEndpoint: "https://otlp.example.com/v1/traces",
  traceSampleRate: 0.1,
});
```

#### `TracingOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `serviceName` | `string` | `"llm-cost-telemetry"` | Service name for telemetry attribution |
| `serviceVersion` | `string` | — | Service version tag |
| `environment` | `string` | — | Deployment environment tag |
| `otlpEndpoint` | `string` | — | OTLP collector endpoint |
| `traceSampleRate` | `number` | `1.0` | Sampling rate (0.0–1.0) |
| `resourceAttributes` | `Record<string, string>` | — | Additional resource attributes |

#### Methods

| Method | Description |
|--------|-------------|
| `init()` | Initialize the tracer provider and exporter |
| `startSpan(name, options?)` | Create and return a new span |
| `recordCostSpan(span)` | Create a span with Gen AI semantic convention attributes |
| `getCurrentContext()` | Get the current propagation context |
| `close()` | Shutdown — flushes pending spans |

#### Gen AI Semantic Conventions

`recordCostSpan()` automatically sets OTel attributes:

```
gen_ai.system           → span.provider
gen_ai.request.model    → span.model
gen_ai.usage.input_tokens   → span.inputTokens
gen_ai.usage.output_tokens  → span.outputTokens
llm.cost.amount         → span.costUsd
```

### `MetricsManager`

OpenTelemetry metrics with OTLP periodic export:

```typescript
import { MetricsManager, type MetricsOptions } from "@reaatech/llm-cost-telemetry-observability";

const metrics = new MetricsManager({
  serviceName: "my-llm-app",
  otlpEndpoint: "https://otlp.example.com/v1/metrics",
  exportIntervalMs: 60000,
});
```

#### `MetricsOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `serviceName` | `string` | `"llm-cost-telemetry"` | Service name for telemetry attribution |
| `otlpEndpoint` | `string` | — | OTLP collector endpoint |
| `exportIntervalMs` | `number` | `60000` | Metric export interval |

#### Instrument Types

| Instrument | Type | Labels | Description |
|------------|------|--------|-------------|
| `gen_ai.client.token.use` | Counter | `provider`, `model`, `type` | Token usage (input/output) |
| `gen_ai.client.operation.duration` | Histogram | `provider`, `model`, `tenant` | Cost amount in USD |
| `gen_ai.client.operation.calls` | Counter | `provider`, `model`, `status` | API call count |
| `gen_ai.client.operation.errors` | Counter | `provider`, `model` | Error count |
| `llm.budget.utilization` | UpDownCounter | `tenant` | Budget utilization percentage |

#### Methods

| Method | Description |
|--------|-------------|
| `init()` | Initialize the meter provider and exporter |
| `recordTokens(provider, model, type, tokens)` | Record token usage |
| `recordCost(provider, model, tenant, costUsd)` | Record cost as a histogram |
| `recordCall(provider, model, status)` | Record an API call |
| `recordError(provider, model)` | Record an error |
| `recordBudgetUtilization(tenant, percent)` | Record budget utilization |
| `recordCostSpan(span)` | Convenience — records all metrics from a `CostSpan` |
| `close()` | Shutdown — flushes pending metrics |

### `CostLogger` / `getLogger()`

Structured logging with Pino and PII redaction:

```typescript
import { CostLogger, getLogger, type LoggerOptions } from "@reaatech/llm-cost-telemetry-observability";

// Pre-configured singleton
const logger = getLogger({ name: "llm-cost" });

// Custom logger
const logger = new CostLogger({
  name: "llm-cost",
  level: "debug",
  redactPii: true,
});
```

#### `LoggerOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `"llm-cost-telemetry"` | Logger name |
| `level` | `string` | `"info"` | Minimum log level |
| `redactPii` | `boolean` | `true` | Enable API key / bearer token redaction |

#### Methods

| Method | Description |
|--------|-------------|
| `logCostSpan(span)` | Log a cost span at info level |
| `logAggregation(record)` | Log an aggregated cost record |
| `logBudgetAlert(tenant, status)` | Log a budget threshold alert |
| `logExport(exporter, count, result)` | Log an export operation |
| `logError(error, context?)` | Log an error with optional context |
| `logInfo(msg, data?)` | Log at info level |
| `logDebug(msg, data?)` | Log at debug level |
| `logWarn(msg, data?)` | Log at warn level |

#### Log Format

Every cost event is logged as structured JSON:

```json
{
  "timestamp": "2026-04-30T17:00:00.000Z",
  "service": "llm-cost-telemetry",
  "span_id": "abc123",
  "level": "info",
  "message": "Cost span recorded",
  "provider": "openai",
  "model": "gpt-4",
  "input_tokens": 150,
  "output_tokens": 45,
  "cost_usd": 0.0123,
  "tenant": "acme-corp"
}
```

## Usage Patterns

### PII Redaction

The logger automatically redacts secrets from log output:

```typescript
logger.logInfo("Request", {
  authorization: "Bearer sk-abc123xyz",
  api_key: "secret-key-456",
  model: "gpt-4",
});
// Logs: { authorization: "[REDACTED]", api_key: "[REDACTED]", model: "gpt-4" }
```

Patterns matched for redaction: `authorization`, `api_key`, `api-key`, `x-api-key`, `password`, `secret`, `token`.

## Related Packages

- [@reaatech/llm-cost-telemetry](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry) — Core types and utilities
- [@reaatech/llm-cost-telemetry-exporters](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-exporters) — CloudWatch, Cloud Monitoring, Phoenix exporters

## License

[MIT](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
