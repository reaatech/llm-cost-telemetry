# Skill: CloudWatch Export

## What It Is

CloudWatch export sends LLM cost metrics to AWS CloudWatch for visualization, alerting, and integration with existing AWS observability stacks. It supports both CloudWatch Metrics (PutMetricData) and CloudWatch Logs (EMF format for Logs Insights).

## Why It Matters

- **AWS Native Integration** — Works with existing AWS observability
- **CloudWatch Alarms** — Set alerts on cost thresholds
- **Logs Insights** — Query cost data with SQL-like syntax
- **Dashboards** — Build cost dashboards in CloudWatch

## How to Use It

### Configure CloudWatch Exporter

```typescript
import { CloudWatchExporter } from 'llm-cost-telemetry';

const exporter = new CloudWatchExporter({
  region: 'us-east-1',
  namespace: 'LLM/Costs',
  // Optional: Use EMF format for CloudWatch Logs
  emfEnabled: true,
  logGroupName: '/aws/llm/costs',
  // Batch settings
  batchSize: 20,
  flushInterval: 60000
});
```

### Export Cost Metrics

```typescript
import { CostAggregator, CloudWatchExporter } from 'llm-cost-telemetry';

const aggregator = new CostAggregator();
const exporter = new CloudWatchExporter({ region: 'us-east-1' });

// Get aggregated costs and export
const records = aggregator.getAll();

await exporter.exportRecords(records);
```

### Set Up CloudWatch Alarms

```typescript
import { CloudWatchClient, PutMetricAlarmCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

// Create alarm for budget threshold
await cloudwatch.send(new PutMetricAlarmCommand({
  AlarmName: 'LLM-Cost-Budget-Exceeded',
  MetricName: 'LLMCost',
  Namespace: 'LLM/Costs',
  Statistic: 'Sum',
  Period: 3600, // 1 hour
  EvaluationPeriods: 1,
  Threshold: 100.00, // $100 per hour
  ComparisonOperator: 'GreaterThanThreshold',
  Dimensions: [
    { Name: 'Tenant', Value: 'acme-corp' }
  ]
}));
```

### Query with Logs Insights

```sql
-- Query cost data from CloudWatch Logs (EMF format)
fields @timestamp, Tenant, Feature, LLMCost
| filter Tenant == "acme-corp"
| stats sum(LLMCost) as TotalCost by Feature
| sort @timestamp desc
| limit 100
```

### Create CloudWatch Dashboard

```typescript
import { CloudWatchClient, PutDashboardCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

const dashboardBody = JSON.stringify({
  widgets: [
    {
      type: 'metric',
      x: 0, y: 0, width: 12, height: 6,
      properties: {
        metrics: [
          ['LLM/Costs', 'LLMCost', 'Tenant', 'acme-corp']
        ],
        period: 3600,
        stat: 'Sum',
        title: 'LLM Costs by Tenant'
      }
    }
  ]
});

await cloudwatch.send(new PutDashboardCommand({
  DashboardName: 'LLM-Cost-Dashboard',
  DashboardBody: dashboardBody
}));
```

## Key Metrics

| Metric | Unit | Dimensions | Description |
|--------|------|------------|-------------|
| `LLMCost` | None | Tenant, Feature, Route | Cost in USD |
| `LLMTokens` | Count | Tenant, Feature, Model | Token count |
| `LLMCalls` | Count | Tenant, Feature, Provider | API call count |

## Best Practices

1. **Use EMF format** — Enables Logs Insights queries
2. **Set appropriate periods** — Match your billing cycle
3. **Use dimensions wisely** — Too many dimensions increase costs
4. **Configure retention** — Set log retention to control storage costs
5. **Use composite alarms** — Combine multiple cost thresholds

## Common Pitfalls

- **Too many dimensions** — CloudWatch charges per dimension
- **Wrong namespace** — Use consistent naming conventions
- **Missing IAM permissions** — Need cloudwatch:PutMetricData
- **No log retention** — Logs accumulate and increase costs

## IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData",
        "cloudwatch:PutDashboard",
        "logs:PutLogEvents",
        "logs:CreateLogGroup",
        "logs:CreateLogStream"
      ],
      "Resource": "*"
    }
  ]
}
```

## Related Skills

- [Tenant Aggregation](../tenant-aggregation/skill.md)
- [Budget Alerts](../budget-alerts/skill.md)
- [Cloud Monitoring Export](../cloud-monitoring-export/skill.md)
