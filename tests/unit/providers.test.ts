import { describe, it, expect, vi } from 'vitest';
import { BaseProviderWrapper } from '../../src/providers/base.js';
import { OpenAIWrapper } from '../../src/providers/openai.js';
import { AnthropicWrapper } from '../../src/providers/anthropic.js';
import { GoogleGenerativeAIWrapper } from '../../src/providers/google.js';
import type { CostSpan, TelemetryContext } from '../../src/types/index.js';

class TestProviderWrapper extends BaseProviderWrapper<Record<string, unknown>> {
  get provider(): 'openai' {
    return 'openai';
  }
}

describe('Providers', () => {
  describe('BaseProviderWrapper', () => {
    it('should store the client', () => {
      const client = { test: true };
      const wrapper = new TestProviderWrapper(client);
      expect(wrapper.unwrap()).toBe(client);
    });

    it('should set and call onSpan callback', () => {
      const wrapper = new TestProviderWrapper({});
      const callback = vi.fn();
      wrapper.onSpan(callback);

      const span = { id: 'test' } as unknown as CostSpan;
      wrapper['emitSpan'](span);
      expect(callback).toHaveBeenCalledWith(span);
    });

    it('should not throw when emitting without callback', () => {
      const wrapper = new TestProviderWrapper({});
      expect(() => wrapper['emitSpan']({ id: 'test' } as unknown as CostSpan)).not.toThrow();
    });

    it('should set default context', () => {
      const wrapper = new TestProviderWrapper({});
      const ctx: Partial<TelemetryContext> = { tenant: 'acme' };
      wrapper.setDefaultContext(ctx);
      expect(wrapper['defaultContext']).toEqual(ctx);
    });

    it('should create a span from request and response metadata', () => {
      const wrapper = new TestProviderWrapper({});
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 100);

      const span = wrapper['createSpan'](
        { model: 'gpt-4', params: {}, telemetry: { tenant: 'acme' }, startTime },
        { inputTokens: 100, outputTokens: 50, endTime },
      );

      expect(span.provider).toBe('openai');
      expect(span.model).toBe('gpt-4');
      expect(span.inputTokens).toBe(100);
      expect(span.outputTokens).toBe(50);
      expect(span.totalTokens).toBe(150);
      expect(span.durationMs).toBe(100);
      expect(span.telemetry).toEqual({ tenant: 'acme' });
    });

    it('should merge default context with request telemetry', () => {
      const wrapper = new TestProviderWrapper({});
      wrapper.setDefaultContext({ tenant: 'default-tenant', feature: 'default-feature' });

      const startTime = new Date();
      const endTime = new Date();

      const span = wrapper['createSpan'](
        { model: 'gpt-4', params: {}, telemetry: { tenant: 'override-tenant' }, startTime },
        { inputTokens: 0, outputTokens: 0, endTime },
      );

      expect(span.telemetry?.tenant).toBe('override-tenant');
      expect(span.telemetry?.feature).toBe('default-feature');
    });

    describe('extractTelemetryContext', () => {
      it('should extract telemetry context from options', () => {
        const wrapper = new TestProviderWrapper({});
        const result = wrapper['extractTelemetryContext']({
          telemetry: { tenant: 'acme', feature: 'chat', route: '/api/chat' },
        });
        expect(result).toEqual({ tenant: 'acme', feature: 'chat', route: '/api/chat' });
      });

      it('should return undefined for no telemetry', () => {
        const wrapper = new TestProviderWrapper({});
        const result = wrapper['extractTelemetryContext']({});
        expect(result).toBeUndefined();
      });

      it('should return undefined for empty telemetry object', () => {
        const wrapper = new TestProviderWrapper({});
        const result = wrapper['extractTelemetryContext']({ telemetry: {} });
        expect(result).toBeUndefined();
      });

      it('should ignore non-string telemetry values', () => {
        const wrapper = new TestProviderWrapper({});
        const result = wrapper['extractTelemetryContext']({
          telemetry: { tenant: 123 },
        });
        expect(result).toBeUndefined();
      });
    });
  });

  describe('OpenAI Wrapper', () => {
    it('should wrap chat.completions.create and emit span on success', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              usage: { prompt_tokens: 100, completion_tokens: 50 },
              choices: [],
            }),
          },
        },
        completions: {
          create: vi.fn().mockResolvedValue({
            usage: { prompt_tokens: 50, completion_tokens: 25 },
          }),
        },
      } as any;

      const wrapper = new OpenAIWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      await wrapped.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
        telemetry: { tenant: 'acme', feature: 'chat' },
      } as any);

      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].provider).toBe('openai');
      expect(capturedSpans[0].model).toBe('gpt-4');
      expect(capturedSpans[0].inputTokens).toBe(100);
      expect(capturedSpans[0].outputTokens).toBe(50);
      expect(capturedSpans[0].telemetry?.tenant).toBe('acme');
    });

    it('should emit span on chat completion error', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('API error')),
          },
        },
        completions: {
          create: vi.fn(),
        },
      } as any;

      const wrapper = new OpenAIWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      await expect(
        wrapped.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello!' }],
        } as any),
      ).rejects.toThrow('API error');

      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].inputTokens).toBe(0);
      expect(capturedSpans[0].outputTokens).toBe(0);
    });

    it('should wrap completions.create and emit span', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
        completions: {
          create: vi.fn().mockResolvedValue({
            usage: { prompt_tokens: 50, completion_tokens: 25 },
          }),
        },
      } as any;

      const wrapper = new OpenAIWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      await wrapped.completions.create({
        model: 'gpt-3.5-turbo-instruct',
        prompt: 'Hello!',
        telemetry: { tenant: 'test' },
      } as any);

      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].model).toBe('gpt-3.5-turbo-instruct');
    });

    it('should emit span on completion error', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
        completions: {
          create: vi.fn().mockRejectedValue(new Error('fail')),
        },
      } as any;

      const wrapper = new OpenAIWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      await expect(
        wrapped.completions.create({
          model: 'gpt-3.5-turbo-instruct',
          prompt: 'Hello!',
        } as any),
      ).rejects.toThrow('fail');

      expect(capturedSpans).toHaveLength(1);
    });

    it('should unwrap to original client', () => {
      const mockClient = {
        chat: { completions: { create: vi.fn() } },
        completions: { create: vi.fn() },
      } as any;
      const wrapper = new OpenAIWrapper(mockClient);
      const wrapped = wrapper.wrap();
      expect(wrapped).toBe(mockClient);
    });
  });

  describe('Anthropic Wrapper', () => {
    it('should wrap messages.create and emit span with cache tokens', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            usage: {
              input_tokens: 200,
              output_tokens: 100,
              cache_read_input_tokens: 50,
              cache_creation_input_tokens: 30,
            },
          }),
        },
      } as any;

      const wrapper = new AnthropicWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      await wrapped.messages.create({
        model: 'claude-opus-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello!' }],
        telemetry: { tenant: 'acme' },
      } as any);

      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].provider).toBe('anthropic');
      expect(capturedSpans[0].inputTokens).toBe(200);
      expect(capturedSpans[0].outputTokens).toBe(100);
      expect(capturedSpans[0].cacheReadTokens).toBe(50);
      expect(capturedSpans[0].cacheCreationTokens).toBe(30);
    });

    it('should emit span on error', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockClient = {
        messages: {
          create: vi.fn().mockRejectedValue(new Error('API error')),
        },
      } as any;

      const wrapper = new AnthropicWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      await expect(
        wrapped.messages.create({
          model: 'claude-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Hello!' }],
        } as any),
      ).rejects.toThrow('API error');

      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].inputTokens).toBe(0);
    });

    it('should handle response without cache tokens', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockClient = {
        messages: {
          create: vi.fn().mockResolvedValue({
            usage: {
              input_tokens: 100,
              output_tokens: 50,
            },
          }),
        },
      } as any;

      const wrapper = new AnthropicWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      await wrapped.messages.create({
        model: 'claude-sonnet-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello!' }],
      } as any);

      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].cacheReadTokens).toBeUndefined();
      expect(capturedSpans[0].cacheCreationTokens).toBeUndefined();
    });
  });

  describe('Google Wrapper', () => {
    it('should wrap getGenerativeModel and generateContent', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
        }),
        generateContentStream: vi.fn(),
      };

      const mockClient = {
        getGenerativeModel: vi.fn().mockReturnValue(mockModel),
      } as any;

      const wrapper = new GoogleGenerativeAIWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      const model = wrapped.getGenerativeModel({ model: 'gemini-pro' });

      await model.generateContent(
        'Hello!' as any,
        {
          telemetry: { tenant: 'acme', feature: 'chat' },
        } as any,
      );

      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].provider).toBe('google');
      expect(capturedSpans[0].model).toBe('gemini-pro');
      expect(capturedSpans[0].inputTokens).toBe(100);
      expect(capturedSpans[0].outputTokens).toBe(50);
    });

    it('should emit span on generateContent error', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockModel = {
        generateContent: vi.fn().mockRejectedValue(new Error('API error')),
        generateContentStream: vi.fn(),
      };

      const mockClient = {
        getGenerativeModel: vi.fn().mockReturnValue(mockModel),
      } as any;

      const wrapper = new GoogleGenerativeAIWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      const model = wrapped.getGenerativeModel({ model: 'gemini-pro' });

      await expect(model.generateContent('Hello!' as any)).rejects.toThrow('API error');

      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].inputTokens).toBe(0);
    });

    it('should wrap generateContentStream and accumulate tokens', async () => {
      const capturedSpans: CostSpan[] = [];

      async function* mockStream() {
        yield { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30 } };
        yield { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 } };
      }

      const mockModel = {
        generateContent: vi.fn(),
        generateContentStream: vi.fn().mockResolvedValue({
          stream: mockStream(),
          response: {},
        }),
      };

      const mockClient = {
        getGenerativeModel: vi.fn().mockReturnValue(mockModel),
      } as any;

      const wrapper = new GoogleGenerativeAIWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      const model = wrapped.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContentStream('Hello!' as any);

      const chunks: unknown[] = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].inputTokens).toBe(100);
      expect(capturedSpans[0].outputTokens).toBe(20);
    });

    it('should handle generateContentStream errors', async () => {
      const capturedSpans: CostSpan[] = [];

      async function* mockStream() {
        yield { usageMetadata: { promptTokenCount: 100 } };
        throw new Error('stream error');
      }

      const mockModel = {
        generateContent: vi.fn(),
        generateContentStream: vi.fn().mockResolvedValue({
          stream: mockStream(),
          response: {},
        }),
      };

      const mockClient = {
        getGenerativeModel: vi.fn().mockReturnValue(mockModel),
      } as any;

      const wrapper = new GoogleGenerativeAIWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      const model = wrapped.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContentStream('Hello!' as any);

      await expect(async () => {
        for await (const _ of result.stream) {
          /* iterate stream */
        }
      }).rejects.toThrow('stream error');

      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].inputTokens).toBe(0);
    });

    it('should handle generateContent with object request', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 40 },
        }),
        generateContentStream: vi.fn(),
      };

      const mockClient = {
        getGenerativeModel: vi.fn().mockReturnValue(mockModel),
      } as any;

      const wrapper = new GoogleGenerativeAIWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      const model = wrapped.getGenerativeModel({ model: 'gemini-pro' });

      await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Hello!' }] }],
      } as any);

      expect(capturedSpans).toHaveLength(1);
    });

    it('should handle generateContent without telemetry', async () => {
      const capturedSpans: CostSpan[] = [];

      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 25 },
        }),
        generateContentStream: vi.fn(),
      };

      const mockClient = {
        getGenerativeModel: vi.fn().mockReturnValue(mockModel),
      } as any;

      const wrapper = new GoogleGenerativeAIWrapper(mockClient);
      wrapper.onSpan((span) => capturedSpans.push(span));
      const wrapped = wrapper.wrap();

      const model = wrapped.getGenerativeModel({ model: 'gemini-pro' });
      await model.generateContent('Hello!' as any);

      expect(capturedSpans).toHaveLength(1);
      expect(capturedSpans[0].telemetry).toEqual({});
    });
  });
});
