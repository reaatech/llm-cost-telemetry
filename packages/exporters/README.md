# @reaatech/llm-cost-telemetry-exporters

[![npm version](https://img.shields.io/npm/v/@reaatech/llm-cost-telemetry-exporters.svg)](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-exporters)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/llm-cost-telemetry/ci.yml?branch=main&label=CI)](https://github.com/reaatech/llm-cost-telemetry/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Telemetry exporters for pushing LLM cost data to observability platforms. Supports AWS CloudWatch (standard + EMF), GCP Cloud Monitoring (custom metrics), and Grafana Loki/Phoenix (JSON-line push API).

## Installation

```bash
npm install @reaatech/llm-cost-telemetry-exporters
# or
pnpm add @reaatech/llm-cost-telemetry-exporters
```

Cloud SDKs are peer dependencies — install only the ones you use:

```bash
pnpm add @aws-sdk/client-cloudwatch  # for CloudWatchExporter
pnpm add @google-cloud/monitoring    # for CloudMonitoringExporter
```

## Feature Overview

- **CloudWatch exporter** — publishes `LLMCost` and `LLMAggregatedCost` metrics with rich dimensions
- **Cloud Monitoring exporter** — creates custom time series at `custom.googleapis.com/llm/`
- **Phoenix/Loki exporter** — pushes JSON-line logs to Grafana Loki's push API
- **EMF format** — CloudWatch supports Embedded Metric Format for structured log-based metrics
- **Batched export** — configurable batch sizes with automatic flushing
- **Retry with backoff** — all exporters inherit exponential backoff from `BaseExporter`

## Quick Start

```typescript
import { CloudWatchExporter, PhoenixExporter } from "@reaatech/llm-cost-telemetry-exporters";

const cw = new CloudWatchExporter({
  region: "us-east-1",
  namespace: "LLM/Costs",
});

const phoenix = new PhoenixExporter({
  host: "http://loki:3100",
  defaultLabels: { service: "llm-cost-telemetry" },
});

await cw.exportSpans(spans);
await phoenix.exportRecords(records);
```

## API Reference

### `BaseExporter`

Abstract base class shared by all exporters:

```typescript
import { BaseExporter, type ExportResult } from "@reaatech/llm-cost-telemetry-exporters";
```

#### Methods

| Method | Description |
|--------|-------------|
| `exportSpans(spans)` | Export individual cost spans |
| `exportRecords(records)` | Export aggregated cost records |
| `exportWithRetry(fn)` | Wrap with exponential backoff |
| `healthCheck()` | Check exporter connectivity |
| `close()` | Graceful shutdown |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isEnabled` | `boolean` | Whether the exporter is active |
| `batchSize` | `number` | Max items per batch |

### `CloudWatchExporter`

Publishes to AWS CloudWatch using `PutMetricData`:

```typescript
import {
  CloudWatchExporter,
  type CloudWatchExporterOptions,
} from "@reaatech/llm-cost-telemetry-exporters";

const exporter = new CloudWatchExporter({
  type: "cloudwatch",
  enabled: true,
  region: "us-east-1",
  namespace: "LLM/Costs",
  emfEnabled: true,
  logGroupName: "/aws/llm/costs",
  batchSize: 20,
  flushInterval: 60000,
});
```

#### `CloudWatchExporterOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `region` | `string` | `"us-east-1"` | AWS region |
| `namespace` | `string` | `"LLM/Costs"` | CloudWatch metric namespace |
| `emfEnabled` | `boolean` | `true` | Enable Embedded Metric Format |
| `logGroupName` | `string` | `"/aws/llm/costs"` | EMF log group name |
| `batchSize` | `number` | `20` | Max metrics per `PutMetricData` call |
| `flushInterval` | `number` | `60000` | Auto-flush interval in ms |

#### Published Metrics

| Metric | Dimensions |
|--------|-----------|
| `LLMCost` | Provider, Model, Tenant, Feature, Route |
| `LLMAggregatedCost` | Provider, Model, Tenant, Feature, Route |

### `CloudMonitoringExporter`

Publishes to GCP Cloud Monitoring as custom metrics:

```typescript
import {
  CloudMonitoringExporter,
  type CloudMonitoringExporterOptions,
} from "@reaatech/llm-cost-telemetry-exporters";

const exporter = new CloudMonitoringExporter({
  type: "cloud-monitoring",
  enabled: true,
  projectId: "my-gcp-project",
  metricTypePrefix: "custom.googleapis.com/llm",
  resourceType: "gce_instance",
  batchSize: 200,
  flushInterval: 60000,
});
```

#### `CloudMonitoringExporterOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `projectId` | `string` | (required) | GCP project ID |
| `metricTypePrefix` | `string` | `"custom.googleapis.com/llm"` | Metric type prefix |
| `resourceType` | `string` | `"gce_instance"` | Monitored resource type |
| `batchSize` | `number` | `200` | Max time series per request |
| `flushInterval` | `number` | `60000` | Auto-flush interval in ms |

#### Published Time Series

| Metric | Type |
|--------|------|
| `custom.googleapis.com/llm/cost` | GAUGE, DOUBLE |
| `custom.googleapis.com/llm/aggregated_cost` | GAUGE, DOUBLE |

### `PhoenixExporter`

Pushes JSON-line logs to Grafana Loki:

```typescript
import {
  PhoenixExporter,
  type PhoenixExporterOptions,
} from "@reaatech/llm-cost-telemetry-exporters";

const exporter = new PhoenixExporter({
  type: "phoenix",
  enabled: true,
  host: "http://loki:3100",
  defaultLabels: {
    service: "llm-cost-telemetry",
    environment: "production",
  },
  username: "loki-user",       // optional
  password: "loki-pass",       // optional
  batchSize: 100,
  flushInterval: 30000,
});
```

#### `PhoenixExporterOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `host` | `string` | `"http://localhost:3100"` | Loki push endpoint |
| `defaultLabels` | `Record<string, string>` | `{ service, environment }` | Default Loki stream labels |
| `username` | `string` | — | Basic auth username |
| `password` | `string` | — | Basic auth password |
| `batchSize` | `number` | `100` | Max entries per push |
| `flushInterval` | `number` | `30000` | Auto-flush interval in ms |

#### Push Endpoint

Data is pushed to `{host}/loki/api/v1/push` as Loki streams with configurable labels.

## Usage Patterns

### Multi-Exporter Setup

```typescript
import {
  CloudWatchExporter,
  CloudMonitoringExporter,
  PhoenixExporter,
} from "@reaatech/llm-cost-telemetry-exporters";

const exporters = [
  new CloudWatchExporter({ region: "us-east-1" }),
  new PhoenixExporter({ host: "http://loki:3100" }),
];

for (const exporter of exporters) {
  if (exporter.isEnabled) {
    await exporter.exportSpans(spans);
  }
}
```

### Batched Export with Automatic Flush

All exporters buffer data and flush automatically at the configured interval:

```typescript
const exporter = new CloudWatchExporter({
  region: "us-east-1",
  batchSize: 20,       // 20 metrics per API call
  flushInterval: 60000, // flush every 60 seconds
});

// Add spans — auto-flushes when batch is full or interval fires
await exporter.exportSpans(spans);
```

### Custom BaseExporter

Extend `BaseExporter` to build your own exporter:

```typescript
import { BaseExporter, type ExportResult } from "@reaatech/llm-cost-telemetry-exporters";
import type { CostSpan, CostRecord } from "@reaatech/llm-cost-telemetry";

class DatadogExporter extends BaseExporter {
  async exportSpans(spans: CostSpan[]): Promise<ExportResult> {
    return this.exportWithRetry(async () => {
      // Push to Datadog
      return { success: true, count: spans.length };
    });
  }

  async exportRecords(records: CostRecord[]): Promise<ExportResult> {
    return this.exportWithRetry(async () => {
      return { success: true, count: records.length };
    });
  }
}
```

## Related Packages

- [@reaatech/llm-cost-telemetry](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry) — Core types and utilities
- [@reaatech/llm-cost-telemetry-observability](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-observability) — OTel tracing and metrics
- [@reaatech/llm-cost-telemetry-cli](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-cli) — CLI tool with export commands

## License

[MIT](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
