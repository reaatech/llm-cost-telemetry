# Skill: Token Counting

## What It Is

Token counting provides accurate token enumeration for LLM API calls using provider-specific tokenizers. It integrates with tiktoken for OpenAI models and provides fallback estimation for other providers, ensuring cost calculations are within 1% of actual billing.

## Why It Matters

- **Accurate Costs** — Token count directly determines billing
- **Provider-Specific** — Each provider has different tokenization
- **Pre-Call Estimation** — Estimate costs before making API calls
- **Function Call Support** — Accurate counting for tool use

## How to Use It

### Count Tokens for OpenAI

```typescript
import { countOpenAITokens } from 'llm-cost-telemetry';

// Count tokens for a single text string
const result = await countOpenAITokens('gpt-4', 'Hello, world!');

console.log(`Total tokens: ${result.tokens}`);
console.log(`Estimated: ${result.estimated}`);
```

### Count Tokens for Multiple Messages

```typescript
import { countMessageTokens } from 'llm-cost-telemetry';

// Count tokens for a list of messages
const result = await countMessageTokens('openai', 'gpt-4', [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello, world!' }
]);

console.log(`Total tokens: ${result.tokens}`);
```

### Count Tokens for Anthropic

```typescript
import { countAnthropicTokens } from 'llm-cost-telemetry';

// Count tokens for Anthropic (uses estimation)
const result = await countAnthropicTokens('claude-3-opus-20240229', 'Hello, world!');

console.log(`Total tokens: ${result.tokens}`);
console.log(`Estimated: ${result.estimated}`);
```

### Count Function Definition Tokens

```typescript
import { countFunctionTokens } from 'llm-cost-telemetry';

// Count tokens for function definitions separately
const functionDefTokens = await countFunctionTokens('gpt-4', [
  {
    name: 'get_weather',
    description: 'Get weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string' }
      }
    }
  }
]);

console.log(`Function definition tokens: ${functionDefTokens.tokens}`);
```

### Pre-Call Cost Estimation

```typescript
import { estimateCost } from 'llm-cost-telemetry';

// Estimate cost before making the call
const estimate = await estimateCost({
  provider: 'openai',
  model: 'gpt-4',
  inputTokens: 1000,
  maxTokens: 500
});

console.log(`Estimated cost: $${estimate.usd}`);
console.log(`Estimated input tokens: ${estimate.inputTokens}`);
console.log(`Estimated output tokens: ${estimate.outputTokens}`);
console.log(`Confidence: ${estimate.confidence}`);
```

## Key Metrics

| Metric | Description | Accuracy |
|--------|-------------|----------|
| `input_tokens` | Prompt tokens | Exact (from tiktoken) |
| `output_tokens` | Completion tokens | Exact (from response) |
| `function_tokens` | Function definition tokens | Exact (from tiktoken) |
| `estimated_tokens` | Pre-call estimation | ~95% accurate |

## Best Practices

1. **Use provider-specific tokenizers** — Don't use generic token counting
2. **Count function definitions separately** — They add to input tokens
3. **Estimate before calling** — Check budget before expensive calls
4. **Cache token counts** — Avoid recounting the same messages
5. **Handle edge cases** — System messages, few-shot examples

## Common Pitfalls

- **Using wrong tokenizer** — GPT-4 and GPT-3.5 have different tokenizers
- **Ignoring function tokens** — Function definitions add significant tokens
- **Not counting system messages** — System prompts count toward input
- **Assuming exact pre-call estimates** — Actual output tokens vary
- **Forgetting to await** — All token counting functions are async

## Provider Differences

| Provider | Tokenizer | Cache Support |
|----------|-----------|---------------|
| OpenAI | tiktoken (cl100k_base) | No |
| Anthropic | Estimation (~4 chars/token) | Yes (prompt caching) |
| Google | Estimation (~4 chars/token) | No |

## Token Counting Functions

| Function | Parameters | Returns |
|----------|------------|---------|
| `countOpenAITokens(model, text)` | Model name, text string | `Promise<TokenCountResult>` |
| `countAnthropicTokens(model, text)` | Model name, text string | `Promise<TokenCountResult>` |
| `countGoogleTokens(model, text)` | Model name, text string | `Promise<TokenCountResult>` |
| `countMessageTokens(provider, model, messages)` | Provider, model, message array | `Promise<TokenCountResult>` |
| `countFunctionTokens(model, functions)` | Model, function definitions | `Promise<TokenCountResult>` |
| `countText(provider, text)` | Provider, text string | `TokenCountResult` (sync) |

## Related Skills

- [Cost Interception](../cost-interception/skill.md)
- [Cost Optimization](../cost-optimization/skill.md)
- [Budget Alerts](../budget-alerts/skill.md)
