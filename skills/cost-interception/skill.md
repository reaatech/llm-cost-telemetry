# Skill: Cost Interception

## What It Is

Cost interception wraps LLM provider SDKs to automatically capture cost data from every API call. It intercepts requests and responses to extract token counts, model information, and calculate costs without modifying application logic.

## Why It Matters

- **Automatic Tracking** — No manual cost calculation needed
- **Accurate Billing** — Within 1% of provider billing
- **Multi-Provider Support** — Works with OpenAI, Anthropic, Google
- **Zero Code Changes** — Drop-in wrapper for existing SDKs

## How to Use It

### Wrap OpenAI Client

```typescript
import { wrapOpenAI } from '@reaatech/llm-cost-telemetry-providers';
import OpenAI from 'openai';

const client = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// All calls are automatically tracked
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  telemetry: {
    tenant: 'acme-corp',
    feature: 'chat-support'
  }
});
```

### Wrap Anthropic Client

```typescript
import { wrapAnthropic } from '@reaatech/llm-cost-telemetry-providers';
import Anthropic from '@anthropic-ai/sdk';

const client = wrapAnthropic(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

// Supports prompt caching cost calculations
const response = await client.messages.create({
  model: 'claude-opus-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
  telemetry: {
    tenant: 'acme-corp',
    feature: 'chat-support'
  }
});
```

### Wrap Google Client

```typescript
import { wrapGoogleGenerativeAI } from '@reaatech/llm-cost-telemetry-providers';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = wrapGoogleGenerativeAI(new GoogleGenerativeAI(process.env.GOOGLE_API_KEY));

const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

const response = await model.generateContent('Hello!', {
  telemetry: {
    tenant: 'acme-corp',
    feature: 'chat-support'
  }
});
```

### Manual Span Recording

For custom integrations, use the `CostCollector` to record spans manually:

```typescript
import { CostCollector } from '@reaatech/llm-cost-telemetry-aggregation'
import { calculateCost } from '@reaatech/llm-cost-telemetry-calculator';

const collector = new CostCollector({
  maxBufferSize: 1000,
  flushIntervalMs: 60000,
  onFlush: async (spans) => {
    // Spans are flushed — export to your backend
    console.log(`Flushed ${spans.length} spans`);
  }
});

// Record a span manually
const { costUsd } = calculateCost({
  provider: 'openai',
  model: 'gpt-4',
  inputTokens: 150,
  outputTokens: 45
});

collector.add({
  provider: 'openai',
  model: 'gpt-4',
  inputTokens: 150,
  outputTokens: 45,
  costUsd,
  telemetry: {
    tenant: 'acme-corp',
    feature: 'chat-support',
    route: '/api/chat'
  }
});
```

## Key Metrics

| Metric | Description | Captured |
|--------|-------------|----------|
| `input_tokens` | Prompt tokens | From provider response |
| `output_tokens` | Completion tokens | From provider response |
| `cache_read_tokens` | Cache hit tokens | Anthropic only |
| `cache_creation_tokens` | Cache write tokens | Anthropic only |
| `cost_usd` | Total cost | Calculated from pricing |

## Best Practices

1. **Always include telemetry context** — tenant, feature, route for aggregation
2. **Use environment variables** — Never hardcode API keys
3. **Handle streaming responses** — Wrappers automatically aggregate chunks
4. **Configure pricing** — Update custom pricing for enterprise agreements
5. **Monitor wrapper overhead** — Should add <1ms latency

## Common Pitfalls

- **Missing telemetry context** — Without tenant/feature, costs can't be aggregated
- **Ignoring streaming** — Streaming responses need special handling
- **Not handling errors** — Wrapper should gracefully handle API errors
- **Forgetting cache costs** — Anthropic prompt caching has different pricing

## Related Skills

- [Token Counting](../token-counting/skill.md)
- [Tenant Aggregation](../tenant-aggregation/skill.md)
- [Budget Alerts](../budget-alerts/skill.md)
