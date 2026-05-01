# @reaatech/llm-cost-telemetry-providers

[![npm version](https://img.shields.io/npm/v/@reaatech/llm-cost-telemetry-providers.svg)](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-providers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/llm-cost-telemetry/ci.yml?branch=main&label=CI)](https://github.com/reaatech/llm-cost-telemetry/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

LLM provider SDK wrappers for automatic cost telemetry. Wraps the official OpenAI, Anthropic, and Google Generative AI SDKs to capture token usage, timing, and telemetry context from every API call without changing your application code.

## Installation

```bash
npm install @reaatech/llm-cost-telemetry-providers
# or
pnpm add @reaatech/llm-cost-telemetry-providers
```

Provider SDKs are peer dependencies — install only the ones you use:

```bash
pnpm add openai                    # for wrapOpenAI
pnpm add @anthropic-ai/sdk         # for wrapAnthropic
pnpm add @google/generative-ai     # for wrapGoogleGenerativeAI
```

## Feature Overview

- **OpenAI wrapper** — intercepts `chat.completions.create` and `completions.create`
- **Anthropic wrapper** — intercepts `messages.create` with cache token awareness
- **Google wrapper** — intercepts `generateContent` and `generateContentStream` with streaming support
- **Telemetry context injection** — attach tenant, feature, and route metadata to each call
- **Cost span emission** — every intercepted call produces a `CostSpan` with token counts and timing
- **Pluggable span handler** — register a callback to forward spans to aggregators, exporters, or your own pipeline

## Quick Start

```typescript
import { wrapOpenAI } from "@reaatech/llm-cost-telemetry-providers";
import OpenAI from "openai";

const client = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

const response = await client.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }],
  telemetry: {
    tenant: "acme-corp",
    feature: "chat-support",
    route: "/api/chat",
  },
});

// A CostSpan was automatically emitted with:
//   provider: "openai", model: "gpt-4"
//   inputTokens: response.usage.prompt_tokens
//   outputTokens: response.usage.completion_tokens
//   timing: request duration
//   telemetry: { tenant, feature, route }
```

## API Reference

### `wrapOpenAI(client: OpenAI): WrappedOpenAI`

Wraps an OpenAI client instance. The returned object preserves the full OpenAI API surface. Intercepted methods:

| Method | Telemetry Added |
|--------|----------------|
| `chat.completions.create(params)` | `telemetry?` on `params` |
| `completions.create(params)` | `telemetry?` on `params` |

```typescript
import { wrapOpenAI, type WrappedOpenAI } from "@reaatech/llm-cost-telemetry-providers";

const client: WrappedOpenAI = wrapOpenAI(new OpenAI());
```

### `wrapAnthropic(client: Anthropic): WrappedAnthropic`

Wraps an Anthropic client. Automatically captures cache read and cache creation tokens:

```typescript
import { wrapAnthropic, type WrappedAnthropic } from "@reaatech/llm-cost-telemetry-providers";
import Anthropic from "@anthropic-ai/sdk";

const client: WrappedAnthropic = wrapAnthropic(new Anthropic());

const response = await client.messages.create({
  model: "claude-sonnet-20240229",
  max_tokens: 1024,
  system: "You are a helpful assistant.", // eligible for prompt caching
  messages: [{ role: "user", content: "Hello!" }],
  telemetry: { tenant: "acme-corp" },
});

// CostSpan includes: cacheReadTokens, cacheCreationTokens from response.usage
```

### `wrapGoogleGenerativeAI(client: GoogleGenerativeAI): WrappedGoogleGenerativeAI`

Wraps a Google Generative AI client. Supports both streaming and non-streaming:

```typescript
import {
  wrapGoogleGenerativeAI,
  type WrappedGoogleGenerativeAI,
  type WrappedGenerativeModel,
} from "@reaatech/llm-cost-telemetry-providers";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI: WrappedGoogleGenerativeAI = wrapGoogleGenerativeAI(
  new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
);

const model: WrappedGenerativeModel = genAI.getGenerativeModel({ model: "gemini-pro" });

// Non-streaming
const result = await model.generateContent("Hello!", {
  telemetry: { tenant: "acme-corp" },
});

// Streaming — span emitted when the stream completes
const stream = await model.generateContentStream("Count to 10", {
  telemetry: { tenant: "acme-corp" },
});
for await (const chunk of stream.stream) {
  console.log(chunk.text());
}
```

### `BaseProviderWrapper<TClient>`

Abstract base class for building custom provider wrappers:

```typescript
import { BaseProviderWrapper } from "@reaatech/llm-cost-telemetry-providers";
import type { RequestMetadata, ResponseMetadata, SpanCallback } from "@reaatech/llm-cost-telemetry-providers";

class MyProviderWrapper extends BaseProviderWrapper<MyClient> {
  get provider(): Provider { return "openai"; }
}
```

### Span Callback

Register a callback to receive emitted `CostSpan` objects:

```typescript
import { wrapOpenAI, type SpanCallback } from "@reaatech/llm-cost-telemetry-providers";

const onSpan: SpanCallback = (span) => {
  console.log(`Cost: $${span.costUsd}`);
  // Forward to aggregator, exporter, or your own pipeline
};

const client = wrapOpenAI(new OpenAI());
// Set the callback on the wrapper
client.__telemetry.onSpan = onSpan;
```

## Usage Patterns

### Multi-Tenant Cost Tracking

```typescript
const client = wrapOpenAI(new OpenAI());

// Different tenants attach different telemetry
const acmeResp = await client.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Hi" }],
  telemetry: { tenant: "acme-corp", feature: "support" },
});

const startupResp = await client.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Hi" }],
  telemetry: { tenant: "startup-inc", feature: "onboarding" },
});

// Each span is tagged with the correct tenant
```

### Wrapping Multiple Providers

```typescript
import { wrapOpenAI, wrapAnthropic, wrapGoogleGenerativeAI } from "@reaatech/llm-cost-telemetry-providers";

const openai = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
const anthropic = wrapAnthropic(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const google = wrapGoogleGenerativeAI(new GoogleGenerativeAI(process.env.GOOGLE_API_KEY));

// Use each as normal — telemetry is transparent
```

## Related Packages

- [@reaatech/llm-cost-telemetry](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry) — Core types and utilities
- [@reaatech/llm-cost-telemetry-calculator](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-calculator) — Cost calculation engine
- [@reaatech/llm-cost-telemetry-aggregation](https://www.npmjs.com/package/@reaatech/llm-cost-telemetry-aggregation) — Span collection and aggregation

## License

[MIT](https://github.com/reaatech/llm-cost-telemetry/blob/main/LICENSE)
