/**
 * Google Generative AI SDK wrapper for cost telemetry
 */
import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerateContentRequest, GenerativeModel } from '@google/generative-ai';
import { now } from '@reaatech/llm-cost-telemetry';
import { BaseProviderWrapper, type RequestMetadata, type ResponseMetadata } from './base.js';

/**
 * Wrapped Google Generative AI client type
 */
export type WrappedGoogleGenerativeAI = GoogleGenerativeAI & {
  getGenerativeModel: GoogleGenerativeAI['getGenerativeModel'];
};

/**
 * Wrapped GenerativeModel with telemetry support
 */
export interface WrappedGenerativeModel extends GenerativeModel {
  generateContent: GenerativeModel['generateContent'];
  generateContentStream: GenerativeModel['generateContentStream'];
}

/**
 * Google Generative AI provider wrapper
 */
export class GoogleGenerativeAIWrapper extends BaseProviderWrapper<GoogleGenerativeAI> {
  /**
   * Get the provider name
   */
  get provider(): 'google' {
    return 'google';
  }

  /**
   * Wrap the GoogleGenerativeAI client to intercept generateContent
   */
  wrap(): WrappedGoogleGenerativeAI {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const wrapper = this;
    const originalClient = this.client;

    // Wrap getGenerativeModel to also wrap the returned model
    const originalGetModel = originalClient.getGenerativeModel.bind(originalClient);

    originalClient.getGenerativeModel = ((
      modelParams: { model: string; generationConfig?: unknown; safetySettings?: unknown },
      ...rest
    ) => {
      // biome-ignore lint/suspicious/noExplicitAny: SDK type bridge
      const model = originalGetModel(modelParams as any, ...rest) as WrappedGenerativeModel;

      // Wrap generateContent
      const originalGenerate = model.generateContent.bind(model);
      model.generateContent = (async (
        request: string | GenerateContentRequest,
        options?: { telemetry?: Record<string, unknown> },
      ) => {
        const startTime = now();
        const telemetry = options?.telemetry
          ? wrapper.extractTelemetryContext(options.telemetry)
          : undefined;
        const modelId = modelParams.model;

        try {
          // biome-ignore lint/suspicious/noExplicitAny: SDK type bridge
          const response = await originalGenerate(request, options as any);

          const endTime = now();

          const requestMetadata: RequestMetadata = {
            model: modelId,
            params: typeof request === 'string' ? { prompt: request } : request,
            telemetry,
            startTime,
          };

          // biome-ignore lint/suspicious/noExplicitAny: SDK type bridge
          const responseAny = response as any;
          const responseMetadata: ResponseMetadata = {
            inputTokens: responseAny.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: responseAny.usageMetadata?.candidatesTokenCount ?? 0,
            endTime,
          };

          const span = wrapper.createSpan(requestMetadata, responseMetadata);
          wrapper.emitSpan(span);

          return response;
        } catch (error) {
          const endTime = now();

          const requestMetadata: RequestMetadata = {
            model: modelId,
            params: typeof request === 'string' ? { prompt: request } : request,
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
      }) as typeof model.generateContent;

      // Wrap generateContentStream
      const originalGenerateStream = model.generateContentStream.bind(model);
      model.generateContentStream = (async (
        request: string | GenerateContentRequest,
        options?: { telemetry?: Record<string, unknown> },
      ) => {
        const startTime = now();
        const telemetry = options?.telemetry
          ? wrapper.extractTelemetryContext(options.telemetry)
          : undefined;
        const modelId = modelParams.model;

        // biome-ignore lint/suspicious/noExplicitAny: SDK type bridge
        const responseStream = await originalGenerateStream(request, options as any);

        // Create a wrapper that collects all chunks
        const originalStream = responseStream.stream;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        const wrappedStream = new ReadableStream({
          async start(controller): Promise<void> {
            try {
              for await (const chunk of originalStream) {
                // Accumulate token counts
                if (chunk.usageMetadata) {
                  totalInputTokens = chunk.usageMetadata.promptTokenCount ?? totalInputTokens;
                  totalOutputTokens = chunk.usageMetadata.candidatesTokenCount ?? totalOutputTokens;
                }

                controller.enqueue(chunk);
              }

              const endTime = now();

              const requestMetadata: RequestMetadata = {
                model: modelId,
                params: typeof request === 'string' ? { prompt: request } : request,
                telemetry,
                startTime,
              };

              const responseMetadata: ResponseMetadata = {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                endTime,
              };

              const span = wrapper.createSpan(requestMetadata, responseMetadata);
              wrapper.emitSpan(span);

              controller.close();
            } catch (error) {
              const endTime = now();

              const requestMetadata: RequestMetadata = {
                model: modelId,
                params: typeof request === 'string' ? { prompt: request } : request,
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

              controller.error(error);
            }
          },
        });

        // Return a response-like object with our wrapped stream
        return {
          stream: wrappedStream,
          response: responseStream.response,
        } as unknown as Awaited<ReturnType<typeof model.generateContentStream>>;
      }) as typeof model.generateContentStream;

      return model;
    }) as typeof originalClient.getGenerativeModel;

    return originalClient as WrappedGoogleGenerativeAI;
  }
}

/**
 * Wrap a GoogleGenerativeAI client for cost telemetry
 */
export function wrapGoogleGenerativeAI(client: GoogleGenerativeAI): WrappedGoogleGenerativeAI {
  const wrapper = new GoogleGenerativeAIWrapper(client);
  return wrapper.wrap();
}
