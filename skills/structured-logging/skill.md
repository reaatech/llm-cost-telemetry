# Skill: Structured Logging

## What It Is

Structured logging provides JSON-formatted log output with automatic PII redaction for all cost telemetry events. It uses Pino for high-performance logging and pattern-based redaction to prevent accidental exposure of API keys, tokens, and secrets.

## Why It Matters

- **Compliance** — Never log sensitive data like API keys or user information
- **Observability** — Structured JSON logs integrate with log aggregation systems
- **Performance** — Pino is one of the fastest Node.js logging libraries
- **Consistency** — Standardized log format across all cost events

## How to Use It

### Get the Default Logger

```typescript
import { getLogger } from 'llm-cost-telemetry';

const logger = getLogger();

// Log cost events
logger.logCostSpan(costSpan);
logger.logInfo('Telemetry initialized');
```

### Create a Custom Logger

```typescript
import { CostLogger } from 'llm-cost-telemetry';

const logger = new CostLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'my-service'
});
```

### Log Cost Spans

```typescript
import { getLogger } from 'llm-cost-telemetry';

const logger = getLogger();

logger.logCostSpan({
  spanId: 'abc123',
  provider: 'openai',
  model: 'gpt-4',
  inputTokens: 150,
  outputTokens: 45,
  costUsd: 0.0123,
  telemetry: {
    tenant: 'acme-corp',
    feature: 'chat-support',
    route: '/api/chat'
  }
});
```

### Log Aggregation Events

```typescript
logger.logAggregation({
  dimension: 'tenant',
  value: 'acme-corp',
  totalUsd: 12.50,
  totalCalls: 250,
  window: 'day'
});
```

### Log Budget Alerts

```typescript
logger.logBudgetAlert({
  tenant: 'acme-corp',
  threshold: 0.75,
  percentage: 78,
  action: 'notify'
});
```

### Log Export Results

```typescript
logger.logExport('cloudwatch', 100, 250, true);
// Output: {"exporter":"cloudwatch","count":100,"duration_ms":250,"success":true,"level":"info","message":"Export succeeded"}
```

### Log Errors with Context

```typescript
try {
  await exporter.exportRecords(records);
} catch (error) {
  logger.logError(error, {
    exporter: 'cloudwatch',
    recordCount: records.length
  });
}
```

### Log Info, Debug, and Warn Messages

```typescript
logger.logInfo('Service started', { version: '0.1.0' });
logger.logDebug('Processing span', { spanId: 'abc123' });
logger.logWarn('High latency detected', { durationMs: 5000 });
```

## PII Redaction

The logger automatically redacts sensitive patterns from all log output:

| Pattern | Example | Redacted |
|---------|---------|----------|
| API keys | `sk-abcdefghijklmnop` | `[REDACTED]` |
| Bearer tokens | `Bearer eyJhbG...` | `[REDACTED]` |
| API key assignments | `api_key="secret123"` | `[REDACTED]` |
| Passwords | `password=secret` | `[REDACTED]` |
| Secrets | `secret: abc123` | `[REDACTED]` |
| Long tokens | `token=abcdefghij...` | `[REDACTED]` |

### How It Works

```typescript
// Input
logger.logInfo('Config loaded', {
  apiKey: 'sk-abcdefghijklmnopqrstuvwxyz',
  service: 'my-app'
});

// Output (API key is redacted)
{
  "level": "info",
  "message": "Config loaded",
  "apiKey": "[REDACTED]",
  "service": "my-app"
}
```

## Log Output Format

All logs are structured JSON:

```json
{
  "level": "info",
  "time": "2026-04-15T23:00:00.000Z",
  "hostname": "my-host",
  "pid": 12345,
  "name": "llm-cost-telemetry",
  "span_id": "abc123",
  "trace_id": "def456",
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

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log level (trace, debug, info, warn, error, fatal) |

### Logger Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | string | `info` | Minimum log level |
| `name` | string | `llm-cost-telemetry` | Logger name |

## Best Practices

1. **Use getLogger() singleton** — Reuse the default logger instance
2. **Include context in errors** — Pass relevant data as the second argument
3. **Set appropriate log level** — Use `debug` in development, `info` in production
4. **Never log raw objects with secrets** — The redactor catches common patterns but not all
5. **Use structured fields** — Pass data as object properties, not in messages

## Common Pitfalls

- **Creating multiple loggers** — Use `getLogger()` singleton instead
- **Logging sensitive objects directly** — Redact before logging
- **Using wrong log level** — Reserve `error` for actual errors
- **Not including context** — Always add relevant fields for debugging

## Integration with Observability Stacks

### ELK Stack (Elasticsearch, Logstash, Kibana)

```typescript
// Logs are JSON by default — ready for Elasticsearch ingestion
// Configure Logstash to parse JSON and index by level, message, timestamp
```

### Grafana Loki

```typescript
// Use PhoenixExporter to push logs to Loki
// Structured JSON format works with LogQL parsing
```

### CloudWatch Logs

```typescript
// Use CloudWatchExporter with EMF format
// Logs appear in CloudWatch Logs Insights with structured fields
```

## Related Skills

- [Cost Interception](../cost-interception/skill.md)
- [CloudWatch Export](../cloudwatch-export/skill.md)
- [Phoenix Export](../phoenix-export/skill.md)
