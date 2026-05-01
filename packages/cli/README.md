# @reaatech/llm-cost-telemetry-cli

[![npm version](https://img.shields.io/npm/v/@reaatech/llm-cost-telemetry-cli.svg)](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/llm-cost-telemetry/ci.yml?branch=main&label=CI)](https://github.com/reaatech/llm-cost-telemetry/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

CLI tool for LLM cost telemetry operations — generate cost reports, check budget status, and trigger exports to observability platforms. Reads cost spans from JSON files or stdin.

## Installation

```bash
npm install -g @reaatech/llm-cost-telemetry-cli
# or
pnpm add -g @reaatech/llm-cost-telemetry-cli
```

## Feature Overview

- **Cost reports** — aggregate cost spans and output as JSON or human-readable tables
- **Budget checks** — verify tenant budget status with configurable thresholds
- **Export triggering** — push cost data to CloudWatch, Cloud Monitoring, or Phoenix/Loki
- **Pipe-friendly** — reads spans from stdin for shell pipeline integration
- **JSON input** — accepts arrays of cost span objects from files or pipes

## Commands

### `report` — Generate Cost Reports

```bash
llm-cost-telemetry report --tenant acme-corp --period day
llm-cost-telemetry report --feature chat-support --period month --format table
llm-cost-telemetry report --input spans.json --format json
```

Aggregates cost spans and displays a cost summary grouped by configurable dimensions.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--tenant` | `string` | — | Filter by tenant |
| `--feature` | `string` | — | Filter by feature |
| `--route` | `string` | — | Filter by route |
| `--period` | `string` | `"day"` | Time period: `hour`, `day`, `week`, `month` |
| `--input` | `string` | — | Path to JSON file containing cost spans |
| `--format` | `string` | `"json"` | Output format: `json` or `table` |

**Example output (table format):**

```
┌──────────────┬──────────┬───────────┬────────────┐
│ Tenant       │ Feature  │ Provider  │ Cost (USD) │
├──────────────┼──────────┼───────────┼────────────┤
│ acme-corp    │ support  │ openai    │ $42.50     │
│ acme-corp    │ support  │ anthropic │ $12.30     │
│ startup-inc  │ onboard  │ openai    │ $8.20      │
├──────────────┼──────────┼───────────┼────────────┤
│ Total        │          │           │ $63.00     │
└──────────────┴──────────┴───────────┴────────────┘
```

### `check` — Check Budget Status

```bash
llm-cost-telemetry check --tenant acme-corp
llm-cost-telemetry check --tenant startup-inc --threshold 0.8
```

Verifies budget status for a tenant against configured limits.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--tenant` | `string` | (required) | Tenant to check |
| `--threshold` | `number` | `0.9` | Alert threshold override (0.0–1.0) |

**Example output:**

```
Tenant: acme-corp
  Daily:   $42.50 / $100.00 (42.5%)  OK
  Monthly: $142.30 / $2000.00 (7.1%) OK
```

### `export` — Trigger Export

```bash
llm-cost-telemetry export --exporter cloudwatch --period hour
llm-cost-telemetry export --exporter phoenix --input spans.json
llm-cost-telemetry export --exporter cloudwatch --dry-run
```

Builds aggregated cost records and pushes them to the specified exporter.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--exporter` | `string` | (required) | Exporter: `cloudwatch`, `cloud-monitoring`, `phoenix` |
| `--period` | `string` | `"hour"` | Time period to export |
| `--input` | `string` | — | Path to JSON file containing cost spans |
| `--dry-run` | `boolean` | `false` | Build records without sending to an exporter |

### `config` — Show Configuration

```bash
llm-cost-telemetry config
```

Displays the effective configuration loaded from environment variables.

### `version` — Show Version

```bash
llm-cost-telemetry version
```

Prints the CLI version number.

## Usage Patterns

### Pipe Spans from stdin

```bash
curl -s https://api.example.com/cost-spans | llm-cost-telemetry report
```

### Scripted Budget Checks

```bash
#!/bin/bash
status=$(llm-cost-telemetry check --tenant acme-corp --format json)
percentage=$(echo "$status" | jq -r '.dailyPercentage')

if (( $(echo "$percentage > 80" | bc -l) )); then
  echo "WARNING: acme-corp at ${percentage}% of daily budget"
  exit 1
fi
```

### Export to Multiple Targets

```bash
llm-cost-telemetry export --exporter cloudwatch --input spans.json
llm-cost-telemetry export --exporter phoenix --input spans.json
```

### Batch Processing with Dry Run

```bash
# Preview what would be exported without actually sending
llm-cost-telemetry export --exporter cloudwatch --dry-run
```

## Environment Variables

The CLI reads configuration from the same environment variables as `@reaatech/llm-cost-telemetry`:

| Variable | Description |
|----------|-------------|
| `DEFAULT_DAILY_BUDGET` | Default daily budget cap |
| `DEFAULT_MONTHLY_BUDGET` | Default monthly budget cap |
| `TENANT_BUDGETS` | JSON object of per-tenant budget overrides |
| `AWS_REGION` | AWS region for CloudWatch exporter |
| `GCP_PROJECT_ID` | GCP project for Cloud Monitoring exporter |
| `LOKI_HOST` | Loki host for Phoenix exporter |

## Related Packages

- [@reaatech/llm-cost-telemetry](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry) — Core types and configuration
- [@reaatech/llm-cost-telemetry-aggregation](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-aggregation) — Aggregation and budgets
- [@reaatech/llm-cost-telemetry-exporters](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-exporters) — CloudWatch, Cloud Monitoring, Phoenix

## License

[MIT](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
