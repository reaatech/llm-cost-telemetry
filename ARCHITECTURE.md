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
│  │            @reaatech/llm-cost-telemetry (core)                    │   │
│  │            types, schemas, utilities, config                      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │  calculator  │ │  providers   │ │ aggregation  │ │ observability│   │
│  │  cost engine │ │  OpenAI,     │ │ collector,   │ │ OTel + Pino  │   │
│  │  pricing,    │ │  Anthropic,  │ │ aggregator,  │ │              │   │
│  │  tokens      │ │  Google      │ │ budget mgr   │ │              │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘   │
│         │                │                │                │             │
│         └────────────────┼────────────────┼────────────────┘             │
│                           ▼                                              │
│                  ┌─────────────────┐                                    │
│                  │    exporters    │                                    │
│                  │ CloudWatch,     │                                    │
│                  │ Cloud Monitor,  │                                    │
│                  │ Phoenix/Loki    │                                    │
│                  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Orchestration Layer                                │
│  ┌──────────────────┐            ┌──────────────────┐                    │
│  │       mcp        │            │       cli        │                    │
│  │  MCP Server      │            │  report, check,  │                    │
│  │  3-layer tools   │            │  export, config  │                    │
│  └──────────────────┘            └──────────────────┘                    │
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

## Package Architecture

### Package Dependency Graph

```
                    ┌────────────────────────────┐
                    │     @reaatech/              │
                    │  llm-cost-telemetry (core)  │
                    │  types, schemas, utils,     │
                    │  config                     │
                    └──────────┬─────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        v                      v                      v
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  calculator   │    │   providers   │    │  aggregation  │
│  (depends on  │    │  (depends on  │    │  (depends on  │
│   core)       │    │   core)       │    │   core)       │
└───────────────┘    └───────────────┘    └───────────────┘
        │                                       │
        │         ┌───────────────┐              │
        │         │ observability │              │
        │         │  (depends on  │              │
        │         │   core)       │              │
        │         └───────┬───────┘              │
        │                 │                      │
        │    ┌────────────┼──────────────────┐   │
        │    v            v                  v   │
        │ ┌──────────────────────────────────┐   │
        │ │           exporters              │   │
        │ │  (depends on core, observability)│   │
        │ └──────────────────────────────────┘   │
        │                                        │
        v                          v             v
┌───────────────┐     ┌────────────────────────────────┐
│      mcp      │     │              cli                │
│  (depends on  │     │  (depends on core,              │
│   core, calc, │     │   aggregation, exporters)       │
│   aggregation)│     │                                 │
└───────────────┘     └────────────────────────────────┘
```

| Package | Directory | Dependencies |
|---------|-----------|-------------|
| `@reaatech/llm-cost-telemetry` | `packages/core` | zod |
| `@reaatech/llm-cost-telemetry-calculator` | `packages/calculator` | core, tiktoken |
| `@reaatech/llm-cost-telemetry-providers` | `packages/providers` | core (peers: openai, @anthropic-ai/sdk, @google/generative-ai) |
| `@reaatech/llm-cost-telemetry-aggregation` | `packages/aggregation` | core |
| `@reaatech/llm-cost-telemetry-observability` | `packages/observability` | core, @opentelemetry/*, pino |
| `@reaatech/llm-cost-telemetry-exporters` | `packages/exporters` | core, observability (peers: @aws-sdk/client-cloudwatch, @google-cloud/monitoring) |
| `@reaatech/llm-cost-telemetry-mcp` | `packages/mcp` | core, calculator, aggregation, @modelcontextprotocol/sdk |
| `@reaatech/llm-cost-telemetry-cli` | `packages/cli` | core, aggregation, exporters, commander |

---

## Component Deep Dive

### Core (`@reaatech/llm-cost-telemetry`)

The foundation package. All other packages depend on it.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Core Package                                    │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │     Domain      │  │    Schemas      │  │    Utilities    │     │
│  │     Types       │  │    (Zod)        │  │                 │     │
│  │                 │  │                 │  │ - ID generation │     │
│  │ - CostSpan      │  │ - CostSpanSchema│  │ - Time math     │     │
│  │ - CostBreakdown │  │ - BudgetSchema  │  │ - Cost calc     │     │
│  │ - BudgetConfig  │  │ - ExportConfig  │  │ - Retry/backoff │     │
│  │ - PricingTier   │  │                 │  │ - Hashing       │     │
│  │ - 40+ types     │  │ - 35+ schemas   │  │ - 25 functions  │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                        Configuration                          │    │
│  │  loadConfig, loadTelemetryConfig, loadBudgetConfig,          │    │
│  │  loadCloudWatchConfig, loadCloudMonitoringConfig,            │    │
│  │  loadPhoenixConfig, DEFAULT_CONFIG                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Calculator (`@reaatech/llm-cost-telemetry-calculator`)

Cost calculation engine with pricing, token counting, and estimation.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Cost Calculator Engine                           │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    Pricing      │    │    Engine       │    │    Tokens       │  │
│  │                 │    │                 │    │                 │  │
│  │ - Model pricing │    │ - Provider-     │    │ - tiktoken      │  │
│  │ - Custom rates  │    │   agnostic      │    │ - Fallback      │  │
│  │ - 19+ models    │    │ - Cache-aware   │    │   estimation    │  │
│  │ - Glob matching │    │ - Compare/save  │    │ - Function call │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Input: { provider, model, input_tokens, output_tokens, ... }       │
│  Output: { cost_usd, breakdown: { input, output, cache } }          │
└─────────────────────────────────────────────────────────────────────┘
```

### Providers (`@reaatech/llm-cost-telemetry-providers`)

SDK wrappers that intercept API calls and emit cost spans.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Provider Wrapper Layer                           │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   OpenAI    │    │  Anthropic  │    │    Google   │              │
│  │   Wrapper   │    │   Wrapper   │    │   Wrapper   │              │
│  │             │    │             │    │             │              │
│  │ - Intercept │    │ - Intercept │    │ - Intercept │              │
│  │   create()  │    │   create()  │    │   generate  │              │
│  │ - Extract   │    │ - Extract   │    │   Content   │              │
│  │   usage     │    │   usage     │    │ - Handle    │              │
│  │ - Handle    │    │ - Cache-    │    │   streaming │              │
│  │   streaming │    │   aware     │    │             │              │
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

### Aggregation (`@reaatech/llm-cost-telemetry-aggregation`)

Collection, multi-dimensional aggregation, and budget enforcement.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Aggregation Engine                               │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   Collector     │  │   Aggregator    │  │    Budget       │     │
│  │                 │  │                 │  │   Manager       │     │
│  │ - In-memory     │  │ - By tenant     │  │ - Per-tenant    │     │
│  │   buffering     │  │ - By feature    │  │   budgets       │     │
│  │ - Flush         │  │ - By route      │  │ - Alerts and    │     │
│  │   intervals     │  │ - Time windows  │  │   warnings      │     │
│  │ - Backpressure  │  │ - Canonic spans │  │ - Exhaustion    │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                      │
│  Output: CostRecord { tenant, feature, route, period, total_cost }  │
└─────────────────────────────────────────────────────────────────────┘
```

### Exporters (`@reaatech/llm-cost-telemetry-exporters`)

Push cost data to observability platforms.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Exporter Layer                                │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Base Exporter (Abstract)                  │    │
│  │  - Batch export support                                      │    │
│  │  - Error handling and retries                                │    │
│  │  - Retry with backoff                                        │    │
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

### MCP Server (`@reaatech/llm-cost-telemetry-mcp`)

Exposes LLM cost telemetry as MCP tools for agent integration.

```
┌─────────────────────────────────────────────────────────────────────┐
│                Three-Layer MCP Tool Architecture                     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │         Layer 1: cost.span.* (Atomic Operations)             │    │
│  │  ┌────────────┐    ┌────────────┐    ┌────────────┐         │    │
│  │  │   record   │    │    get     │    │   flush    │         │    │
│  │  └────────────┘    └────────────┘    └────────────┘         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │         Layer 2: cost.aggregate.* (Aggregation)              │    │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │    │
│  │  │by_tenant│ │by_feature│ │ by_route │ │ summary  │        │    │
│  │  └─────────┘ └──────────┘ └──────────┘ └──────────┘        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │         Layer 3: cost.budget.* (Budget Management)           │    │
│  │  ┌────────────┐    ┌────────────┐    ┌────────────┐         │    │
│  │  │   check    │    │    set     │    │   alert    │         │    │
│  │  └────────────┘    └────────────┘    └────────────┘         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Internally wired: CostCollector → calculateCost → CostAggregator   │
│  + BudgetManager. Spans flushed via onSpanFlush callback.            │
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
5. Calculate cost via @reaatech/llm-cost-telemetry-calculator:
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
7. Buffer span in CostCollector (@reaatech/llm-cost-telemetry-aggregation):
   - In-memory buffer
   - Configurable flush interval
                  │
8. Aggregate by dimensions:
   - By tenant
   - By feature
   - By route
   - Time-windowed
                  │
9. Export to backends (@reaatech/llm-cost-telemetry-exporters):
   - CloudWatch (AWS)
   - Cloud Monitoring (GCP)
   - Phoenix/Loki (Grafana)
                  │
10. Emit observability data (@reaatech/llm-cost-telemetry-observability):
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

Every LLM call generates OpenTelemetry spans via `@reaatech/llm-cost-telemetry-observability`:

| Span | Attributes |
|------|------------|
| `gen_ai.client.call` | provider, model, input_tokens, output_tokens, cost_usd |
| `gen_ai.client.cost.calculate` | model, tokens, pricing_tier |
| `gen_ai.client.cost.export` | exporter, batch_size, status |

### Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `gen_ai.client.token.use` | Counter | `provider`, `model`, `type` | Token usage |
| `gen_ai.client.operation.duration` | Histogram | `provider`, `model`, `tenant` | Cost in USD |
| `gen_ai.client.operation.calls` | Counter | `provider`, `model`, `status` | API calls |
| `gen_ai.client.operation.errors` | Counter | `provider`, `error_type` | Error count |
| `llm.budget.utilization` | UpDownCounter | `tenant` | Budget usage % |

### Logging

All logs are structured JSON with standard fields:

```json
{
  "timestamp": "2026-04-30T17:00:00.000Z",
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

## Build & Toolchain

| Tool | Purpose |
|------|---------|
| **pnpm** | Package manager with workspaces |
| **Turborepo** | Monorepo task orchestration |
| **tsup** | Per-package build (dual CJS/ESM) |
| **Biome** | Lint and format |
| **Vitest** | Test runner |
| **Changesets** | Versioning and changelog generation |
| **TypeScript 5.8** | Strict mode with `verbatimModuleSyntax` |

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
- **README.md** — Quick start and overview
- **MCP Specification** — https://modelcontextprotocol.io/
- **OpenTelemetry Semantic Conventions** — https://opentelemetry.io/docs/specs/semconv/
