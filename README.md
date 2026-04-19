# llm-cost-telemetry

Enterprise-grade LLM cost telemetry library with provider SDK wrapping, multi-tenant aggregation, and CloudWatch/Cloud Monitoring/Phoenix export.

## What This Is

`llm-cost-telemetry` tracks, aggregates, and exports LLM costs in production applications. It wraps provider SDKs (OpenAI, Anthropic, Google) to automatically capture cost data, aggregates costs by tenant/feature/route, and exports to existing observability stacks.

**Target audience:** Engineering teams running LLM-powered applications in production who need accurate cost tracking, multi-tenant cost allocation, budget enforcement, and integration with existing observability stacks.

## Quick Start

### Installation

```bash
npm install llm-cost-telemetry
```

### Wrap Your Provider SDK

```typescript
import { wrapOpenAI } from 'llm-cost-telemetry';
import OpenAI from 'openai';

const client = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// All calls are automatically tracked
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

### Calculate Costs

```typescript
import { calculateCost } from 'llm-cost-telemetry';

const { costUsd, breakdown } = calculateCost({
  provider: 'openai',
  model: 'gpt-4',
  inputTokens: 150,
  outputTokens: 45
});

console.log(`Cost: $${costUsd}`); // Cost: $0.0072
```

## Features

- **Provider Wrapping** — Drop-in wrappers for OpenAI, Anthropic, and Google SDKs
- **Accurate Cost Calculation** — Within 1% of provider billing
- **Multi-Tenant Aggregation** — Track costs by tenant, feature, route
- **Budget Enforcement** — Set budgets and get alerts
- **Multiple Exporters** — CloudWatch, Cloud Monitoring, Phoenix/Loki
- **OpenTelemetry Integration** — Tracing and metrics
- **Structured Logging** — JSON logs with PII redaction
- **CLI Tool** — Generate reports, check budgets, trigger exports

## Provider Support

| Provider | Models Supported | Cache Support |
|----------|-----------------|---------------|
| OpenAI | GPT-4, GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo | No |
| Anthropic | Claude Opus, Sonnet, Haiku | Yes (prompt caching) |
| Google | Gemini Pro, Gemini 1.5 | No |

## Configuration

### Environment Variables

```bash
# LLM Provider API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_API_KEY=your_google_api_key_here

# AWS Configuration (for CloudWatch export)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here

# GCP Configuration (for Cloud Monitoring export)
GCP_PROJECT_ID=your_gcp_project_id_here

# Loki Configuration (for Phoenix export)
LOKI_HOST=http://localhost:3100

# OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=llm-cost-telemetry

# Budget Configuration
DEFAULT_DAILY_BUDGET=100.00
DEFAULT_MONTHLY_BUDGET=2000.00
```

## CLI Reference

```bash
# Generate cost report
npx llm-cost-telemetry report --input ./spans.json --tenant acme-corp --period day --format json

# Check budget status
npx llm-cost-telemetry check --tenant acme-corp --threshold 0.8

# Manual export trigger
npx llm-cost-telemetry export --input ./spans.json --exporter cloudwatch --period hour

# Preview export payload without sending it
npx llm-cost-telemetry export --input ./spans.json --exporter cloudwatch --dry-run

# Show configuration
npx llm-cost-telemetry config --format json
```

`report` and `export` consume a JSON array of cost spans from `--input` or from piped stdin. This keeps the CLI stateless while allowing reports and exports to run against captured telemetry data.

## Three-Layer MCP Tools

The library exposes MCP tools for agent integration:

### Layer 1: cost.span.* (Atomic Operations)
- `cost.span.record` — Record a cost span
- `cost.span.get` — Retrieve span by ID
- `cost.span.flush` — Flush buffered spans

### Layer 2: cost.aggregate.* (Aggregation)
- `cost.aggregate.by_tenant` — Get costs by tenant
- `cost.aggregate.by_feature` — Get costs by feature
- `cost.aggregate.by_route` — Get costs by route
- `cost.aggregate.summary` — Get cost summary

### Layer 3: cost.budget.* (Budget Management)
- `cost.budget.check` — Check budget status
- `cost.budget.set` — Set budget limits
- `cost.budget.alert` — Configure alerts

## Exporters

### CloudWatch (AWS)

```typescript
import { CloudWatchExporter } from 'llm-cost-telemetry';

const exporter = new CloudWatchExporter({
  region: 'us-east-1',
  namespace: 'LLM/Costs',
  emfEnabled: true,
  logGroupName: '/aws/llm/costs'
});
```

### Cloud Monitoring (GCP)

```typescript
import { CloudMonitoringExporter } from 'llm-cost-telemetry';

const exporter = new CloudMonitoringExporter({
  projectId: 'my-gcp-project',
  metricTypePrefix: 'custom.googleapis.com/llm',
  resourceType: 'gce_instance'
});
```

### Phoenix/Loki (Grafana)

```typescript
import { PhoenixExporter } from 'llm-cost-telemetry';

const exporter = new PhoenixExporter({
  host: 'http://loki:3100',
  defaultLabels: {
    service: 'llm-cost-telemetry',
    environment: 'production'
  }
});
```

## Development

### Prerequisites

- Node.js 22+
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint
npm run lint

# Format
npm run format
```

### Docker Development

```bash
# Start all services
docker-compose up -d

# Access Jaeger UI
open http://localhost:16686

# Access Grafana
open http://localhost:3001
```

## Documentation

- [AGENTS.md](./AGENTS.md) — Agent development guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design deep dive
- [DEV_PLAN.md](./DEV_PLAN.md) — Development checklist
- [Skills](./skills/) — Individual skill documentation

## License

MIT
