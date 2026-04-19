# llm-cost-telemetry — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │     CLI     │    │   Library   │    │  MCP Client │                  │
│  │   (npx)     │    │  (import)   │    │  (Agent)    │                  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                  │
│         │                   │                   │                         │
│         └───────────────────┼───────────────────┘                         │
│                             │                                               │
└─────────────────────────────┼─────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Telemetry Core                                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Three-Layer Architecture                     │   │
│  │                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │   │
│  │  │ cost.span.* │───▶│ cost.       │───▶│ cost.       │           │   │
│  │  │  (Atomic)   │    │ aggregate.* │    │ budget.*    │           │   │
│  │  │             │    │(Aggregation)│   │  (Budget)   │           │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Telemetry Engine                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Provider   │  │    Cost     │  │ Aggregation │  │  Exporters  │    │
│  │  Wrappers   │  │  Calculator │  │   Engine    │  │             │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                 │                │                │           │
│         └─────────────────┼────────────────┼────────────────┘           │
│                           ▼                                            │
│                  ┌─────────────────┐                                    │
│                  │  Observability  │                                    │
│                  │  (OTel + Logs)  │                                    │
│                  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       External Backends                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │ CloudWatch  │  │   Cloud     │  │  Phoenix/   │                      │
│  │   (AWS)     │  │ Monitoring  │  │   Loki      │                      │
│  │             │  │   (GCP)     │  │             │                      │
│  └─────────────┘  └─────────────┘  └─────────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Zero-Overhead Wrapping
- Provider wrappers add minimal latency (<1ms)
- Non-blocking cost calculation and export
- Graceful degradation on telemetry failures

### 2. Accurate Cost Calculation
- Within 1% of provider billing
- Provider-specific token counting
- Cache-aware pricing (Anthropic prompt caching)

### 3. Provider-Agnostic Interface
- Unified API for all LLM providers
- Consistent telemetry across providers
- Easy addition of new providers

### 4. No Cost Data Loss
- Durable buffering with flush guarantees
- Retry logic with exponential backoff
- Dead letter queue for failed exports

### 5. Privacy by Design
- Never export user data or conversation content
- PII redaction in all logs
- Minimal data collection (tokens, cost, metadata only)

---

## Component Deep Dive

### Three-Layer MCP Tool Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Layer 1: cost.span.* (Atomic)                      │
│                                                                      │
│  Fast, stateless operations for recording individual cost spans      │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │     record      │    │       get       │    │      flush      │  │
│  │                 │    │                 │    │                 │  │
│  │ Record a cost   │    │ Retrieve span   │    │ Flush buffered  │  │
│  │ span            │    │ by ID           │    │ spans           │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                Layer 2: cost.aggregate.* (Aggregation)               │
│                                                                      │
│  Stateful operations for cost aggregation by dimensions              │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   by_tenant     │    │   by_feature    │    │    by_route     │  │
│  │                 │    │                 │    │                 │  │
│  │ Get costs by    │    │ Get costs by    │    │ Get costs by    │  │
│  │ tenant          │    │ feature         │    │ route           │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                         │
│  │     summary     │    │                 │                         │
│  │                 │    │                 │                         │
│  │ Get cost        │    │                 │                         │
│  │ summary         │    │                 │                         │
│  └─────────────────┘    └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                Layer 3: cost.budget.* (Budget Management)            │
│                                                                      │
│  Opinionated operations for budget enforcement                       │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │      check      │    │       set       │    │      alert      │  │
│  │                 │    │                 │    │                 │  │
│  │ Check budget    │    │ Set budget      │    │ Configure       │  │
│  │ status          │    │ limits          │    │ alerts          │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Provider Wrappers

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Provider Wrapper Layer                           │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   OpenAI    │    │  Anthropic  │    │    Google   │              │
│  │   Wrapper   │    │   Wrapper   │    │   Wrapper   │              │
│  │             │    │             │    │             │              │
│  │ - Intercept │    │ - Intercept │    │ - Intercept │              │
│  │   requests  │    │   requests  │    │   requests  │              │
│  │ - Extract   │    │ - Extract   │    │ - Extract   │              │
│  │   usage     │    │   usage     │    │   usage     │              │
│  │ - Handle    │    │ - Cache-    │    │ - Handle    │              │
│  │   streaming │    │   aware     │    │   streaming │              │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘              │
│         │                   │                   │                     │
│         └───────────────────┼───────────────────┘                     │
│                             ▼                                         │
│                  ┌─────────────────┐                                  │
│                  │  Base Wrapper   │                                  │
│                  │   (Abstract)    │                                  │
│                  └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Cost Calculator

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Cost Calculator Engine                           │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    Pricing      │    │    Engine       │    │    Tokens       │  │
│  │                 │    │                 │    │                 │  │
│  │ - Model pricing │    │ - Provider-     │    │ - tiktoken      │  │
│  │ - Custom rates  │    │   agnostic      │    │ - Fallback      │  │
│  │ - Currency      │    │ - Cache-aware   │    │   estimation    │  │
│  │   conversion    │    │ - Batch support │    │ - Function call │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Input: { provider, model, input_tokens, output_tokens, ... }       │
│  Output: { cost_usd, breakdown: { input, output, cache } }          │
└─────────────────────────────────────────────────────────────────────┘
```

### Aggregation Engine

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Aggregation Engine                               │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Collector     │    │   Aggregator    │    │    Budget       │  │
│  │                 │    │                 │    │   Manager       │  │
│  │ - In-memory     │    │ - By tenant     │    │ - Per-tenant    │  │
│  │   buffering     │    │ - By feature    │    │   budgets       │  │
│  │ - Flush         │    │ - By route      │    │ - Alerts and    │  │
│  │   intervals     │    │ - Time windows  │    │   warnings      │  │
│  │ - Backpressure  │    │                 │    │ - Exhaustion    │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: CostRecord { tenant, feature, route, period, total_cost }  │
└─────────────────────────────────────────────────────────────────────┘
```

### Exporter Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Exporter Layer                                │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Base Exporter (Abstract)                  │    │
│  │  - Batch export support                                      │    │
│  │  - Error handling and retries                                │    │
│  │  - Circuit breaker pattern                                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                  │
│         ▼                    ▼                    ▼                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐          │
│  │ CloudWatch  │      │   Cloud     │      │  Phoenix/   │          │
│  │  Exporter   │      │ Monitoring  │      │   Loki      │          │
│  │             │      │  Exporter   │      │  Exporter   │          │
│  │ - PutMetric │      │ - Time      │      │ - Push      │          │
│  │   Data API  │      │   Series    │      │   API       │          │
│  │ - EMF       │      │   API       │      │ - Structured│          │
│  │   format    │      │ - Resource  │      │   logs      │          │
│  │             │      │   labels    │      │ - Labels    │          │
│  └─────────────┘      └─────────────┘      └─────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Complete Cost Tracking Flow

```
1. Application calls wrapped provider SDK
   (e.g., wrappedOpenAI.chat.completions.create())
         │
2. Wrapper intercepts request:
   - Extract model, messages, metadata
   - Capture telemetry context (tenant, feature, route)
         │
3. Forward request to actual provider SDK
         │
4. Provider returns response:
   - Extract usage (input_tokens, output_tokens)
   - Handle streaming responses (aggregate chunks)
         │
5. Calculate cost:
   - Look up model pricing
   - Calculate input + output costs
   - Apply cache discounts (if applicable)
         │
6. Create cost span:
   - Span ID, trace ID
   - Timestamp, duration
   - Provider, model, tokens, cost
   - Aggregation dimensions
         │
7. Buffer span in aggregation engine:
   - In-memory buffer
   - Configurable flush interval
         │
8. Aggregate by dimensions:
   - By tenant
   - By feature
   - By route
   - Time-windowed
         │
9. Export to backends:
   - CloudWatch (AWS)
   - Cloud Monitoring (GCP)
   - Phoenix/Loki (Grafana)
         │
10. Emit observability data:
    - OTel spans and metrics
    - Structured logs
```

---

## Security Model

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1: Data Collection                                             │
│ - Minimal data collection (tokens, cost, metadata only)              │
│ - Never collect conversation content                                 │
│ - Never collect user PII                                             │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 2: API Keys                                                    │
│ - All provider API keys from environment variables                   │
│ - Never log API keys or tokens                                       │
│ - Separate keys per provider for isolation                           │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 3: Export Security                                             │
│ - PII sanitization before export                                     │
│ - Secure transport (HTTPS) for all exporters                         │
│ - Configurable data retention                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 4: Access Control                                              │
│ - IAM roles for CloudWatch/Cloud Monitoring                          │
│ - Minimal required permissions                                       │
│ - Audit logging for budget changes                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### PII Handling

- **No conversation content** — Only token counts and cost data
- **No user identifiers** — Tenant IDs are opaque strings
- **No message content** — Never log or export message bodies
- **Configurable redaction** — Pattern-based redaction for any accidental captures

---

## Observability

### Tracing

Every LLM call generates OpenTelemetry spans:

| Span | Attributes |
|------|------------|
| `llm.call` | provider, model, input_tokens, output_tokens, cost_usd |
| `llm.cost.calculate` | model, tokens, pricing_tier |
| `llm.cost.export` | exporter, batch_size, status |

### Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `llm.cost.tokens` | Counter | `provider`, `model`, `type` | Token usage |
| `llm.cost.amount` | Histogram | `provider`, `model`, `tenant` | Cost in USD |
| `llm.cost.calls` | Counter | `provider`, `model`, `status` | API calls |
| `llm.cost.errors` | Counter | `provider`, `error_type` | Errors |
| `llm.budget.utilization` | Gauge | `tenant` | Budget usage % |

### Logging

All logs are structured JSON with standard fields:

```json
{
  "timestamp": "2026-04-15T23:00:00Z",
  "service": "llm-cost-telemetry",
  "span_id": "abc123",
  "trace_id": "def456",
  "level": "info",
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

---

## Deployment Architecture

### AWS (CloudWatch)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS Deployment                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Application (EC2/Lambda/ECS)                │    │
│  │  ┌───────────────────────────────────────────────────────┐  │    │
│  │  │              llm-cost-telemetry Library                 │  │    │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐          │  │    │
│  │  │  │ Provider  │  │    Cost   │  │CloudWatch │          │  │    │
│  │  │  │ Wrappers  │  │ Calculator│  │ Exporter  │          │  │    │
│  │  │  └───────────┘  └───────────┘  └───────────┘          │  │    │
│  │  └───────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      CloudWatch                              │    │
│  │  - CloudWatch Metrics (PutMetricData)                        │    │
│  │  - CloudWatch Logs (EMF format for Logs Insights)            │    │
│  │  - CloudWatch Alarms (budget alerts)                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### GCP (Cloud Monitoring)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GCP Deployment                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                 Application (GCE/Cloud Run/GKE)               │    │
│  │  ┌───────────────────────────────────────────────────────┐  │    │
│  │  │              llm-cost-telemetry Library                 │  │    │
│  │  │  ┌───────────┐  ┌───────────┐  ┌──────────────────┐  │  │    │
│  │  │  │ Provider  │  │    Cost   │  │ Cloud Monitoring │  │  │    │
│  │  │  │ Wrappers  │  │ Calculator│  │    Exporter      │  │  │    │
│  │  │  └───────────┘  └───────────┘  └──────────────────┘  │  │    │
│  │  └───────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Cloud Monitoring                           │    │
│  │  - Custom Metrics (Time Series API)                          │    │
│  │  - Dashboards (cost by tenant/feature)                       │    │
│  │  - Alerting Policies (budget alerts)                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Provider API error | Non-2xx response | Retry with backoff, record error span |
| Cost calculation error | Exception in calculator | Log error, use fallback estimation |
| Export failure | Exporter returns error | Retry with backoff, buffer for later |
| Buffer overflow | Memory threshold exceeded | Drop oldest spans, emit warning |
| Budget exceeded | Budget check fails | Block request (if configured), alert |
| Timeout | Request exceeds timeout | Return partial results, log warning |

---

## References

- **AGENTS.md** — Agent development guide
- **DEV_PLAN.md** — Development checklist
- **README.md** — Quick start and overview
- **MCP Specification** — https://modelcontextprotocol.io/
- **OpenTelemetry Semantic Conventions** — https://opentelemetry.io/docs/specs/semconv/
