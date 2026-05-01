# Skill: Cloud Monitoring Export

## What It Is

Cloud Monitoring export sends LLM cost metrics to Google Cloud Monitoring (formerly Stackdriver) for visualization, alerting, and integration with GCP observability stacks. It uses the Time Series API to write custom metrics with resource labels for dimensional data.

## Why It Matters

- **GCP Native Integration** — Works with existing GCP observability
- **Alerting Policies** — Set alerts on cost thresholds
- **Dashboards** — Build cost dashboards in Cloud Monitoring
- **BigQuery Export** — Export metrics to BigQuery for analysis

## How to Use It

### Configure Cloud Monitoring Exporter

```typescript
import { CloudMonitoringExporter } from '@reaatech/llm-cost-telemetry-exporters';

const exporter = new CloudMonitoringExporter({
  projectId: 'my-gcp-project',
  // Optional: Custom metric type prefix
  metricTypePrefix: 'custom.googleapis.com/llm',
  // Resource type (gce_instance, cloud_run_revision, etc.)
  resourceType: 'gce_instance',
  // Batch settings
  batchSize: 200,
  flushInterval: 60000
});
```

### Export Cost Metrics

```typescript
import { CostAggregator } from '@reaatech/llm-cost-telemetry-aggregation'
import { CloudMonitoringExporter } from '@reaatech/llm-cost-telemetry-exporters';

const aggregator = new CostAggregator();
const exporter = new CloudMonitoringExporter({ projectId: 'my-gcp-project' });

// Get aggregated costs and export
const records = aggregator.getAll();

await exporter.exportRecords(records);
```

### Create Alerting Policy

```typescript
import { NotificationChannelServiceClient, AlertPolicyServiceClient } from '@google-cloud/monitoring';

const alertClient = new AlertPolicyServiceClient();
const notificationClient = new NotificationChannelServiceClient();

// Create notification channel (email)
const [channel] = await notificationClient.createNotificationChannel({
  name: `projects/${projectId}`,
  notificationChannel: {
    displayName: 'Cost Alerts',
    type: 'email',
    labels: { email_address: 'team@example.com' }
  }
});

// Create alerting policy
const [policy] = await alertClient.createAlertPolicy({
  name: `projects/${projectId}`,
  alertPolicy: {
    displayName: 'LLM Cost Budget Exceeded',
    conditions: [
      {
        displayName: 'Cost > $100/hour',
        conditionThreshold: {
          filter: `metric.type="custom.googleapis.com/llm/cost"`,
          comparison: 'COMPARISON_GT',
          thresholdValue: 100.0,
          duration: { seconds: 0 },
          aggregations: [
            {
              alignmentPeriod: { seconds: 3600 },
              perSeriesAligner: 'ALIGN_SUM'
            }
          ]
        }
      }
    ],
    notificationChannels: [channel.name],
    enabled: true
  }
});
```

### Create Dashboard

```typescript
import { DashboardsServiceClient } from '@google-cloud/monitoring';

const dashboardClient = new DashboardsServiceClient();

const dashboard = {
  displayName: 'LLM Cost Dashboard',
  gridLayout: {
    columns: 2,
    widgets: [
      {
        title: 'LLM Costs by Tenant',
        xyChart: {
          dataSets: [
            {
              timeSeriesQuery: {
                timeSeriesFilter: {
                  filter: `metric.type="custom.googleapis.com/llm/cost"`,
                  aggregation: {
                    alignmentPeriod: { seconds: 3600 },
                    perSeriesAligner: 'ALIGN_SUM',
                    crossSeriesReducer: 'REDUCE_SUM',
                    groupByFields: ['metric.label.tenant']
                  }
                }
              }
            }
          ],
          timeshiftDuration: { seconds: 0 },
          yAxis: { scale: 'LINEAR' }
        }
      }
    ]
  }
};

await dashboardClient.createDashboard({
  parent: `projects/${projectId}`,
  dashboard
});
```

## Key Metrics

| Metric Type | Value Type | Labels | Description |
|-------------|------------|--------|-------------|
| `custom.googleapis.com/llm/cost` | DOUBLE | tenant, feature, route | Cost in USD |
| `custom.googleapis.com/llm/tokens` | INT64 | tenant, feature, model | Token count |
| `custom.googleapis.com/llm/calls` | INT64 | tenant, feature, provider | API call count |

## Best Practices

1. **Use appropriate resource types** — Match your deployment (GCE, Cloud Run, GKE)
2. **Set alignment periods** — Match your billing granularity
3. **Use metric labels** — For dimensions like tenant and feature
4. **Configure SLOs** — Set cost budgets as SLOs
5. **Export to BigQuery** — For long-term analysis

## Common Pitfalls

- **Wrong resource type** — Must match your deployment
- **Too many labels** — Cloud Monitoring has label limits
- **Missing permissions** — Need monitoring.timeSeries.create
- **Not using alignment** — Raw data can be noisy

## IAM Permissions Required

```json
{
  "roles": [
    "roles/monitoring.metricWriter",
    "roles/monitoring.alertPolicyEditor",
    "roles/monitoring.dashboardEditor",
    "roles/monitoring.notificationChannelEditor"
  ]
}
```

## Related Skills

- [Tenant Aggregation](../tenant-aggregation/skill.md)
- [Budget Alerts](../budget-alerts/skill.md)
- [CloudWatch Export](../cloudwatch-export/skill.md)
- [Phoenix Export](../phoenix-export/skill.md)
