# Skill: Phoenix Export

## What It Is

Phoenix export sends LLM cost metrics to Grafana Loki (part of the Grafana observability stack) for visualization alongside logs and traces. It uses structured log format with labels for dimensional data, enabling powerful log queries and Grafana dashboards.

## Why It Matters

- **Unified Observability** — Cost metrics alongside logs and traces
- **Grafana Dashboards** — Build cost dashboards in Grafana
- **LogQL Queries** — Query cost data with LogQL
- **Cost-Effective** — Loki is designed for cost-efficient log storage

## How to Use It

### Configure Phoenix/Loki Exporter

```typescript
import { PhoenixExporter } from 'llm-cost-telemetry';

const exporter = new PhoenixExporter({
  // Loki endpoint
  host: 'http://loki:3100',
  // Labels applied to all entries
  defaultLabels: {
    service: 'llm-cost-telemetry',
    environment: 'production'
  },
  // Batch settings
  batchSize: 100,
  flushInterval: 30000,
  // Optional: Basic auth for Loki
  username: process.env.LOKI_USERNAME,
  password: process.env.LOKI_PASSWORD
});
```

### Export Cost Metrics

```typescript
import { CostAggregator, PhoenixExporter } from 'llm-cost-telemetry';

const aggregator = new CostAggregator();
const exporter = new PhoenixExporter({ host: 'http://loki:3100' });

// Get aggregated costs and export
const records = aggregator.getAll();

await exporter.exportRecords(records);
```

### Query with LogQL

```logql
# Get total cost by tenant for the last hour
sum by (tenant) (rate({service="llm-cost-telemetry"} | json | cost_usd [1h]))

# Get cost for specific feature
{service="llm-cost-telemetry", feature="chat-support"} | json | cost_usd > 10

# Get daily cost trend
sum_over_time({service="llm-cost-telemetry"} | json | cost_usd [24h])
```

### Create Grafana Dashboard

```json
{
  "dashboard": {
    "title": "LLM Cost Dashboard",
    "panels": [
      {
        "title": "Cost by Tenant",
        "type": "graph",
        "targets": [
          {
            "expr": "sum by (tenant) (rate({service=\"llm-cost-telemetry\"} | json | cost_usd [5m]))",
            "refId": "A"
          }
        ]
      },
      {
        "title": "Total Daily Cost",
        "type": "stat",
        "targets": [
          {
            "expr": "sum_over_time({service=\"llm-cost-telemetry\"} | json | cost_usd [24h])",
            "refId": "A"
          }
        ]
      }
    ]
  }
}
```

### Docker Compose Setup

```yaml
version: '3'
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource
    depends_on:
      - loki
```

## Key Metrics

| Field | Type | Description |
|-------|------|-------------|
| `cost_usd` | float | Cost in USD |
| `input_tokens` | int | Input token count |
| `output_tokens` | int | Output token count |
| `api_calls` | int | Number of API calls |

## Labels

| Label | Description | Example |
|-------|-------------|---------|
| `tenant` | Tenant identifier | `acme-corp` |
| `feature` | Feature name | `chat-support` |
| `provider` | LLM provider | `openai` |
| `service` | Service name | `llm-cost-telemetry` |
| `environment` | Environment | `production` |

## Best Practices

1. **Use structured JSON** — Enables LogQL parsing
2. **Limit label cardinality** — Too many unique labels increase storage
3. **Set retention policies** — Configure Loki retention to control costs
4. **Use stream selectors** — Filter by service and environment
5. **Create recording rules** — Pre-aggregate for better query performance

## Common Pitfalls

- **High cardinality labels** — Don't use user IDs or request IDs as labels
- **Missing JSON parsing** — Always use `| json` in LogQL queries
- **No retention policy** — Logs accumulate without retention settings
- **Too frequent pushes** — Batch entries for efficiency

## Loki Configuration

```yaml
# loki-config.yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

limits_config:
  retention_period: 720h  # 30 days
  max_label_name_length: 1024
  max_label_value_length: 2048
  max_line_size: 256kb
```

## Related Skills

- [Tenant Aggregation](../tenant-aggregation/skill.md)
- [Budget Alerts](../budget-alerts/skill.md)
- [CloudWatch Export](../cloudwatch-export/skill.md)
- [Cloud Monitoring Export](../cloud-monitoring-export/skill.md)
