# @reaatech/llm-cost-telemetry-calculator

[![npm version](https://img.shields.io/npm/v/@reaatech/llm-cost-telemetry-calculator.svg)](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-calculator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/llm-cost-telemetry/ci.yml?branch=main&label=CI)](https://github.com/reaatech/llm-cost-telemetry/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Cost calculation engine for LLM API usage. Provides provider-agnostic cost calculation with cache-aware pricing, token counting across OpenAI, Anthropic, and Google models, and pre-call cost estimation.

## Installation

```bash
npm install @reaatech/llm-cost-telemetry-calculator
# or
pnpm add @reaatech/llm-cost-telemetry-calculator
```

## Feature Overview

- **Cost calculation** — provider-agnostic engine with cache-aware pricing (Anthropic prompt caching)
- **Built-in pricing table** — 19+ models across OpenAI, Anthropic, and Google with pattern-based lookup
- **Token counting** — tiktoken-based counting for OpenAI, estimation for Anthropic and Google
- **Cost estimation** — pre-call budgeting with confidence scores
- **Model comparison** — side-by-side cost comparison and savings calculation
- **Custom pricing** — override or append pricing tiers at runtime

## Quick Start

```typescript
import { calculateCost, estimateCost, getPricing } from "@reaatech/llm-cost-telemetry-calculator";

const result = calculateCost({
  provider: "openai",
  model: "gpt-4",
  inputTokens: 500,
  outputTokens: 200,
});

console.log(`Cost: $${result.costUsd}`);           // $0.021
console.log(result.breakdown);                      // { inputCostUsd: 0.015, outputCostUsd: 0.006 }
```

## API Reference

### Cost Calculation

#### `calculateCost(options: CostCalculationOptions): { costUsd, breakdown, pricing }`

Core calculation engine. Options:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `provider` | `"openai" \| "anthropic" \| "google"` | Yes | LLM provider |
| `model` | `string` | Yes | Model name (e.g. `"gpt-4"`, `"claude-opus-20240229"`) |
| `inputTokens` | `number` | Yes | Number of input/prompt tokens |
| `outputTokens` | `number` | Yes | Number of output/completion tokens |
| `cacheReadTokens` | `number` | No | Anthropic cache read tokens |
| `cacheCreationTokens` | `number` | No | Anthropic cache creation tokens |

Returns a `CostBreakdown` with per-category costs and the matched `PricingTier`.

#### `estimateCost(request: CostEstimateRequest): Promise<CostEstimateResult>`

Pre-call estimation for budget gating:

```typescript
const estimate = await estimateCost({
  provider: "openai",
  model: "gpt-4",
  estimatedInputTokens: 1000,
  estimatedOutputTokens: 500,
});

console.log(`Estimated: $${estimate.costUsd} (confidence: ${estimate.confidence})`);
```

#### `getCostPerToken(provider, model): { inputPerToken, outputPerToken }`

#### `compareModelCosts(options): ModelCostComparison[]`

Compare the cost of running the same workload across different models or providers.

#### `calculateSavings(options): CostSavings`

Calculate potential savings from switching models or enabling prompt caching.

### Pricing

#### `getPricing(provider, model): PricingTier | undefined`

Look up pricing for a specific model. Uses exact match first, then glob pattern matching (e.g. `gpt-4*` matches `gpt-4-0314`):

```typescript
import { getPricing } from "@reaatech/llm-cost-telemetry-calculator";

const pricing = getPricing("openai", "gpt-4");
// → { input: 30, output: 60, cacheRead: undefined, cacheCreation: undefined }
```

#### `getProviderPricing(provider): PricingTier[]`

Returns all pricing tiers for a provider.

#### `addCustomPricing(pricing: PricingTier | PricingTier[]): void`

Override or append pricing at runtime:

```typescript
import { addCustomPricing } from "@reaatech/llm-cost-telemetry-calculator";

addCustomPricing({
  provider: "openai",
  model: "gpt-4o-custom",
  input: 2.5,
  output: 10,
});
```

#### `DEFAULT_PRICING`

The built-in pricing table (readonly).

### Token Counting

#### `countOpenAITokens(model, text): Promise<TokenCountResult>`

Uses `tiktoken` for accurate OpenAI token counts.

#### `countAnthropicTokens(model, text): Promise<TokenCountResult>`

Estimation-based counting (Anthropic has no public tokenizer).

#### `countGoogleTokens(model, text): Promise<TokenCountResult>`

Estimation-based counting (Google uses SentencePiece internally).

#### `countMessageTokens(messages, options?): Promise<TokenCountResult>`

Count tokens across a complete message array (system, user, assistant).

#### `countText(text): number`

Simple character-based estimation for quick checks.

#### `estimateOutputTokens(inputTokens, ratio?): number`

Estimate output tokens as a multiple of input tokens (default 0.3).

#### `countFunctionTokens(functions): number`

Count tokens consumed by function/tool definitions.

#### `calculateTotalTokens(request): TotalTokenCalculation`

Calculate tokens for an entire request including messages, functions, and max output.

## Usage Patterns

### Cache-Aware Anthropic Pricing

```typescript
const result = calculateCost({
  provider: "anthropic",
  model: "claude-sonnet-20240229",
  inputTokens: 1000,
  cacheReadTokens: 3000,        // cached system prompt
  cacheCreationTokens: 1000,    // tokens written to cache
  outputTokens: 200,
});

console.log(result.breakdown);
// { inputCostUsd: 0.003, outputCostUsd: 0.003, cacheReadCostUsd: 0.0009, cacheCreationCostUsd: 0.00375 }
```

### Pre-Call Budget Check

```typescript
import { estimateCost } from "@reaatech/llm-cost-telemetry-calculator";

async function withinBudget(limit: number): Promise<boolean> {
  const estimate = await estimateCost({
    provider: "anthropic",
    model: "claude-opus-20240229",
    estimatedInputTokens: 2000,
    estimatedOutputTokens: 1000,
  });
  return estimate.costUsd <= limit;
}
```

## Related Packages

- [@reaatech/llm-cost-telemetry](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry) — Core types and utilities
- [@reaatech/llm-cost-telemetry-providers](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-providers) — Provider SDK wrappers

## License

[MIT](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
