/**
 * Anthropic SDK wrapper for cost telemetry
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { now } from '@reaatech/llm-cost-telemetry';
import { BaseProviderWrapper, type RequestMetadata, type ResponseMetadata } from './base.js';

/**
 * Wrapped Anthropic client type
 */
export type WrappedAnthropic = Anthropic & {
  messages: {
    create: Anthropic['messages']['create'];
  };
};

/**
 * Anthropic provider wrapper with cache-aware cost tracking
 */
export class AnthropicWrapper extends BaseProviderWrapper<Anthropic> {
  /**
   * Get the provider name
   */
  get provider(): 'anthropic' {
    return 'anthropic';
  }

  /**
   * Wrap the Anthropic client to intercept messages.create
   */
  wrap(): WrappedAnthropic {
    const originalClient = this.client;

    // Wrap messages.create
    const originalCreate = originalClient.messages.create.bind(originalClient.messages);

    originalClient.messages.create = (async (options: MessageCreateParamsNonStreaming, ...rest) => {
      const startTime = now();
      const telemetry = this.extractTelemetryContext(
        options as unknown as { [key: string]: unknown },
      );
      const model = options.model;

      // Remove telemetry from options before passing to original
      const { telemetry: _, ...cleanOptions } = options as unknown as { [key: string]: unknown };

      try {
        const response = await originalCreate(
          cleanOptions as unknown as MessageCreateParamsNonStreaming,
          ...rest,
        );

        const endTime = now();

        const requestMetadata: RequestMetadata = {
          model,
          params: cleanOptions,
          telemetry,
          startTime,
        };

        // Extract token usage with cache awareness
        const inputTokens = response.usage.input_tokens ?? 0;
        const outputTokens = response.usage.output_tokens ?? 0;

        // Anthropic provides cache token counts separately
        let cacheReadTokens: number | undefined;
        let cacheCreationTokens: number | undefined;

        // Check for cache tokens in the response
        const usage = response.usage as unknown as { [key: string]: unknown };
        if ('cache_read_input_tokens' in usage) {
          cacheReadTokens = usage.cache_read_input_tokens as number;
        }
        if ('cache_creation_input_tokens' in usage) {
          cacheCreationTokens = usage.cache_creation_input_tokens as number;
        }

        const responseMetadata: ResponseMetadata = {
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheCreationTokens,
          endTime,
        };

        const span = this.createSpan(requestMetadata, responseMetadata);
        this.emitSpan(span);

        return response;
      } catch (error) {
        const endTime = now();

        const requestMetadata: RequestMetadata = {
          model,
          params: cleanOptions,
          telemetry,
          startTime,
        };

        const responseMetadata: ResponseMetadata = {
          inputTokens: 0,
          outputTokens: 0,
          endTime,
          error: error as Error,
        };

        const span = this.createSpan(requestMetadata, responseMetadata);
        this.emitSpan(span);

        throw error;
      }
    }) as typeof originalClient.messages.create;

    return originalClient as WrappedAnthropic;
  }
}

/**
 * Wrap an Anthropic client for cost telemetry
 */
export function wrapAnthropic(client: Anthropic): WrappedAnthropic {
  const wrapper = new AnthropicWrapper(client);
  return wrapper.wrap();
}
