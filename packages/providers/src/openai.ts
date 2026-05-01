/**
 * OpenAI SDK wrapper for cost telemetry
 */
import type OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import type { CompletionCreateParamsNonStreaming } from 'openai/resources/completions';
import { BaseProviderWrapper, type RequestMetadata, type ResponseMetadata } from './base.js';
import { now } from '@reaatech/llm-cost-telemetry';

/**
 * Wrapped OpenAI client type
 */
export type WrappedOpenAI = OpenAI & {
  chat: {
    completions: {
      create: OpenAI['chat']['completions']['create'];
    };
  };
  completions: {
    create: OpenAI['completions']['create'];
  };
};

/**
 * OpenAI provider wrapper
 */
export class OpenAIWrapper extends BaseProviderWrapper<OpenAI> {
  /**
   * Get the provider name
   */
  get provider(): 'openai' {
    return 'openai';
  }

  /**
   * Wrap the OpenAI client to intercept chat completions
   */
  wrap(): WrappedOpenAI {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const wrapper = this;
    const originalClient = this.client;

    // Wrap chat.completions.create
    const originalChatCreate = originalClient.chat.completions.create.bind(
      originalClient.chat.completions,
    );

    originalClient.chat.completions.create = async function (
      options: ChatCompletionCreateParamsNonStreaming,
      ...rest
    ) {
      const startTime = now();
      const telemetry = wrapper.extractTelemetryContext(
        options as unknown as Record<string, unknown>,
      );
      const model = options.model;

      // Remove telemetry from options before passing to original
      const optionsObj = options as unknown as Record<string, unknown>;
      const { telemetry: _, ...cleanOptionsObj } = optionsObj;
      const cleanOptions = cleanOptionsObj as unknown as ChatCompletionCreateParamsNonStreaming;

      try {
        const response = await originalChatCreate(cleanOptions, ...rest);

        const endTime = now();

        const requestMetadata: RequestMetadata = {
          model,
          params: cleanOptions,
          telemetry,
          startTime,
        };

        const responseMetadata: ResponseMetadata = {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          endTime,
        };

        const span = wrapper.createSpan(requestMetadata, responseMetadata);
        wrapper.emitSpan(span);

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

        const span = wrapper.createSpan(requestMetadata, responseMetadata);
        wrapper.emitSpan(span);

        throw error;
      }
    } as typeof originalClient.chat.completions.create;

    // Wrap completions.create
    const originalCompletionCreate = originalClient.completions.create.bind(
      originalClient.completions,
    );

    originalClient.completions.create = async function (
      options: CompletionCreateParamsNonStreaming,
      ...rest
    ) {
      const startTime = now();
      const telemetry = wrapper.extractTelemetryContext(
        options as unknown as Record<string, unknown>,
      );
      const model = options.model;

      const optionsObj = options as unknown as Record<string, unknown>;
      const { telemetry: _, ...cleanOptionsObj } = optionsObj;
      const cleanOptions = cleanOptionsObj as unknown as CompletionCreateParamsNonStreaming;

      try {
        const response = await originalCompletionCreate(cleanOptions, ...rest);

        const endTime = now();

        const requestMetadata: RequestMetadata = {
          model,
          params: cleanOptions,
          telemetry,
          startTime,
        };

        const responseMetadata: ResponseMetadata = {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          endTime,
        };

        const span = wrapper.createSpan(requestMetadata, responseMetadata);
        wrapper.emitSpan(span);

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

        const span = wrapper.createSpan(requestMetadata, responseMetadata);
        wrapper.emitSpan(span);

        throw error;
      }
    } as typeof originalClient.completions.create;

    return originalClient as WrappedOpenAI;
  }
}

/**
 * Wrap an OpenAI client for cost telemetry
 */
export function wrapOpenAI(client: OpenAI): WrappedOpenAI {
  const wrapper = new OpenAIWrapper(client);
  return wrapper.wrap();
}
