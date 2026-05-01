import { describe, it, expect } from 'vitest';
import {
  countOpenAITokens,
  countAnthropicTokens,
  countGoogleTokens,
  countMessageTokens,
  countText,
  estimateOutputTokens,
  countFunctionTokens,
  calculateTotalTokens,
} from './tokens.js';

describe('Token Counting', () => {
  describe('countOpenAITokens', () => {
    it('should count tokens using tiktoken', async () => {
      const result = await countOpenAITokens('gpt-4', 'Hello, world!');
      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should return 0 tokens for empty string', async () => {
      const result = await countOpenAITokens('gpt-4', '');
      expect(result.tokens).toBe(0);
    });

    it('should count tokens for long text', async () => {
      const longText = 'a'.repeat(1000);
      const result = await countOpenAITokens('gpt-4', longText);
      expect(result.tokens).toBeGreaterThan(0);
    });
  });

  describe('countAnthropicTokens', () => {
    it('should estimate tokens for Anthropic models', async () => {
      const result = await countAnthropicTokens('claude-opus-20240229', 'Hello, world!');
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.estimated).toBe(true);
    });
  });

  describe('countGoogleTokens', () => {
    it('should estimate tokens for Google models', async () => {
      const result = await countGoogleTokens('gemini-pro', 'Hello, world!');
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.estimated).toBe(true);
    });
  });

  describe('countText', () => {
    it('should dispatch to OpenAI counter', async () => {
      const result = await countText('openai', 'gpt-4', 'Hello');
      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should dispatch to Anthropic counter', async () => {
      const result = await countText('anthropic', 'claude-opus-20240229', 'Hello');
      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should dispatch to Google counter', async () => {
      const result = await countText('google', 'gemini-pro', 'Hello');
      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should use estimation for unknown provider', async () => {
      const result = await countText('unknown' as any, 'model-1', 'Hello');
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.estimated).toBe(true);
    });
  });

  describe('countMessageTokens', () => {
    it('should count tokens across multiple messages', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hello!' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];
      const result = await countMessageTokens('openai', 'gpt-4', messages);
      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should add overhead per message', async () => {
      const singleMessage = [{ role: 'user' as const, content: 'Hello' }];
      const result1 = await countMessageTokens('openai', 'gpt-4', singleMessage);

      const twoMessages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi' },
      ];
      const result2 = await countMessageTokens('openai', 'gpt-4', twoMessages);

      expect(result2.tokens).toBeGreaterThan(result1.tokens);
    });

    it('should handle empty messages array', async () => {
      const result = await countMessageTokens('openai', 'gpt-4', []);
      expect(result.tokens).toBe(0);
    });
  });

  describe('estimateOutputTokens', () => {
    it('should estimate 70% of max tokens', () => {
      expect(estimateOutputTokens(1000)).toBe(700);
    });

    it('should return 0 for undefined', () => {
      expect(estimateOutputTokens(undefined)).toBe(0);
    });

    it('should return 0 for zero', () => {
      expect(estimateOutputTokens(0)).toBe(0);
    });

    it('should handle fractional results', () => {
      const result = estimateOutputTokens(1);
      expect(result).toBe(1);
    });
  });

  describe('countFunctionTokens', () => {
    it('should count tokens for function definitions', async () => {
      const functions = [
        {
          name: 'get_weather',
          description: 'Get weather for a city',
          parameters: { type: 'object' },
        },
      ];
      const result = await countFunctionTokens('gpt-4', functions);
      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should add overhead per function', async () => {
      const oneFunc = [{ name: 'f1', description: 'Function 1' }];
      const twoFuncs = [
        { name: 'f1', description: 'Function 1' },
        { name: 'f2', description: 'Function 2' },
      ];
      const result1 = await countFunctionTokens('gpt-4', oneFunc);
      const result2 = await countFunctionTokens('gpt-4', twoFuncs);
      expect(result2.tokens).toBeGreaterThan(result1.tokens);
    });

    it('should handle empty functions array', async () => {
      const result = await countFunctionTokens('gpt-4', []);
      expect(result.tokens).toBe(0);
    });
  });

  describe('calculateTotalTokens', () => {
    it('should calculate total tokens for messages', async () => {
      const result = await calculateTotalTokens({
        provider: 'openai',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
        maxTokens: 100,
      });

      expect(result.inputTokens).toBeGreaterThan(0);
      expect(result.outputTokens).toBeGreaterThan(0);
      expect(result.totalTokens).toBe(result.inputTokens + result.outputTokens);
    });

    it('should include function tokens when provided', async () => {
      const resultWithout = await calculateTotalTokens({
        provider: 'openai',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      const resultWith = await calculateTotalTokens({
        provider: 'openai',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        functions: [{ name: 'get_weather', description: 'Get weather' }],
      });

      expect(resultWith.inputTokens).toBeGreaterThan(resultWithout.inputTokens);
    });

    it('should return 0 output tokens when no maxTokens', async () => {
      const result = await calculateTotalTokens({
        provider: 'openai',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.outputTokens).toBe(0);
    });
  });
});
