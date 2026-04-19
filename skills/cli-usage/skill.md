# Skill: CLI Usage

## What It Is

The CLI provides command-line access to cost telemetry features including report generation, budget checking, manual exports, and configuration display. It's useful for scripts, CI/CD pipelines, and manual operations.

## Why It Matters

- **Scripting** — Automate cost reporting and budget checks in scripts
- **CI/CD** — Integrate cost checks into deployment pipelines
- **Debugging** — Quickly inspect costs and configuration without writing code
- **Manual Operations** — Trigger exports and generate reports on demand

## Commands

### report — Generate Cost Report

Generate a cost report for a specific period, optionally filtered by tenant.

```bash
# JSON format (default)
npx llm-cost-telemetry report --tenant acme-corp --period day --format json

# Table format for human readability
npx llm-cost-telemetry report --period day --format table

# With date range
npx llm-cost-telemetry report --period day --start 2026-04-01 --end 2026-04-15

# Group by multiple dimensions
npx llm-cost-telemetry report --period day --group-by tenant,feature,route
```

**Options:**

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--tenant` | `-t` | — | Filter by tenant |
| `--period` | `-p` | `day` | Time period (minute, hour, day, week, month) |
| `--format` | `-f` | `json` | Output format (json, table) |
| `--start` | — | — | Start date (ISO format) |
| `--end` | — | — | End date (ISO format) |
| `--group-by` | — | — | Comma-separated dimensions |

### check — Check Budget Status

Check the current budget status for a tenant.

```bash
# Check budget with default threshold (0.8)
npx llm-cost-telemetry check --tenant acme-corp

# Custom threshold
npx llm-cost-telemetry check --tenant acme-corp --threshold 0.9

# Text format for human readability
npx llm-cost-telemetry check --tenant acme-corp --format text
```

**Options:**

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--tenant` | `-t` | — | Tenant identifier (required) |
| `--threshold` | — | `0.8` | Alert threshold (0-1) |
| `--format` | `-f` | `json` | Output format (json, text) |

### export — Manual Export Trigger

Manually trigger an export to one of the configured backends.

```bash
# Export to CloudWatch
npx llm-cost-telemetry export --exporter cloudwatch --period hour

# Export to Cloud Monitoring
npx llm-cost-telemetry export --exporter cloud-monitoring --period day

# Export to Loki
npx llm-cost-telemetry export --exporter phoenix --period hour
```

**Options:**

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--exporter` | `-e` | — | Exporter type (cloudwatch, cloud-monitoring, phoenix) |
| `--period` | `-p` | `hour` | Time period to export (hour, day) |

### config — Show Configuration

Display the current configuration from environment variables.

```bash
# JSON format (default)
npx llm-cost-telemetry config --format json

# Environment file format
npx llm-cost-telemetry config --format env
```

**Options:**

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--format` | — | `json` | Output format (json, env) |

### version — Show Version

Display the current version.

```bash
npx llm-cost-telemetry version
```

## Environment Variables

The CLI reads configuration from environment variables:

| Variable | Description |
|----------|-------------|
| `OTEL_SERVICE_NAME` | Service name for telemetry |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint |
| `AWS_REGION` | AWS region for CloudWatch |
| `GCP_PROJECT_ID` | GCP project for Cloud Monitoring |
| `LOKI_HOST` | Loki host for Phoenix export |
| `DEFAULT_DAILY_BUDGET` | Default daily budget |
| `DEFAULT_MONTHLY_BUDGET` | Default monthly budget |

## Examples

### CI/CD Budget Check

```yaml
# .github/workflows/cost-check.yml
- name: Check LLM Budget
  run: |
    npx llm-cost-telemetry check --tenant ${{ github.repository }} --threshold 0.8
    if [ $? -ne 0 ]; then
      echo "Budget exceeded!"
      exit 1
    fi
```

### Daily Cost Report Script

```bash
#!/bin/bash
# daily-report.sh

DATE=$(date -d "yesterday" +%Y-%m-%d)
REPORT=$(npx llm-cost-telemetry report --period day --start $DATE --end $DATE --format json)

# Send to Slack, email, etc.
echo "$REPORT" | jq '.totalCostUsd'
```

### Automated Export

```bash
#!/bin/bash
# hourly-export.sh

npx llm-cost-telemetry export --exporter cloudwatch --period hour
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (budget exceeded, export failed, invalid arguments) |

## Best Practices

1. **Use JSON format for scripts** — Easier to parse with `jq` or similar tools
2. **Set appropriate thresholds** — Don't wait until 100% to alert
3. **Use environment variables** — Don't hardcode configuration
4. **Check exit codes** — Especially for budget checks in CI/CD
5. **Use table format for debugging** — Human-readable output

## Common Pitfalls

- **Forgetting required arguments** — `--tenant` is required for `check`
- **Wrong exporter name** — Use `cloudwatch`, `cloud-monitoring`, or `phoenix`
- **Not setting environment variables** — Exporters need configuration
- **Ignoring exit codes** — Always check `$?` in scripts

## Related Skills

- [CloudWatch Export](../cloudwatch-export/skill.md)
- [Cloud Monitoring Export](../cloud-monitoring-export/skill.md)
- [Phoenix Export](../phoenix-export/skill.md)
- [Budget Alerts](../budget-alerts/skill.md)
