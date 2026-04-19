/**
 * Unit tests for cost calculator
 */
import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  estimateCost,
  getCostPerToken,
  compareModelCosts,
  calculateSavings,
  DEFAULT_PRICING,
  getPricing,
  addCustomPricing,
  getProviderPricing,
} from '../../src/calculator/index.js';

describe('Cost Calculator', () => {
  describe('calculateCost', () => {
    it('should calculate cost for OpenAI gpt-4', () => {
      const result = calculateCost({
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(result.costUsd).toBeGreaterThan(0);
      expect(result.breakdown.inputCostUsd).toBeGreaterThan(0);
      expect(result.breakdown.outputCostUsd).toBeGreaterThan(0);
    });

    it('should calculate cost for Anthropic Claude', () => {
      const result = calculateCost({
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(result.costUsd).toBeGreaterThan(0);
    });

    it('should calculate cost for Google Gemini', () => {
      const result = calculateCost({
        provider: 'google',
        model: 'gemini-pro',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(result.costUsd).toBeGreaterThanOrEqual(0);
    });

    it('should handle cache read tokens for Anthropic', () => {
      const result = calculateCost({
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 500,
      });

      expect(result.costUsd).toBeGreaterThan(0);
      expect(result.breakdown.cacheReadCostUsd).toBeGreaterThan(0);
    });

    it('should handle cache creation tokens for Anthropic', () => {
      const result = calculateCost({
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 200,
      });

      expect(result.costUsd).toBeGreaterThan(0);
      expect(result.breakdown.cacheCreationCostUsd).toBeGreaterThan(0);
    });

    it('should subtract cache read tokens from input before calculating input cost', () => {
      const result = calculateCost({
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 400,
      });

      // Input cost should be for (1000 - 400) = 600 tokens at $15/M
      // Cache read cost should be for 400 tokens at $1.5/M
      // Output cost should be for 500 tokens at $75/M
      const expectedInputCost = (600 * 15) / 1_000_000;
      const expectedCacheReadCost = (400 * 1.5) / 1_000_000;
      const expectedOutputCost = (500 * 75) / 1_000_000;
      const expectedTotal = expectedInputCost + expectedCacheReadCost + expectedOutputCost;

      expect(result.breakdown.inputCostUsd).toBeCloseTo(expectedInputCost, 6);
      expect(result.breakdown.cacheReadCostUsd).toBeCloseTo(expectedCacheReadCost, 6);
      expect(result.breakdown.outputCostUsd).toBeCloseTo(expectedOutputCost, 6);
      expect(result.costUsd).toBeCloseTo(expectedTotal, 6);
    });

    it('should return zero cost for unknown model', () => {
      const result = calculateCost({
        provider: 'openai',
        model: 'unknown-model',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(result.costUsd).toBe(0);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost based on token count', async () => {
      const result = await estimateCost({
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(result.usd).toBeGreaterThan(0);
    });
  });

  describe('getCostPerToken', () => {
    it('should return cost per token for input', () => {
      const result = getCostPerToken('openai', 'gpt-4', 'input');
      expect(result).toBeGreaterThan(0);
    });

    it('should return cost per token for output', () => {
      const result = getCostPerToken('openai', 'gpt-4', 'output');
      expect(result).toBeGreaterThan(0);
    });

    it('should return 0 for unknown model', () => {
      const result = getCostPerToken('openai', 'unknown', 'input');
      expect(result).toBe(0);
    });
  });

  describe('compareModelCosts', () => {
    it('should compare costs between models', () => {
      const result = compareModelCosts({
        models: [
          { provider: 'openai', model: 'gpt-4' },
          { provider: 'openai', model: 'gpt-4-turbo' },
        ],
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(result.length).toBe(2);
      expect(result[0].costUsd).toBeGreaterThan(0);
    });
  });

  describe('calculateSavings', () => {
    it('should calculate savings between two models', () => {
      const result = calculateSavings({
        currentModel: { provider: 'openai', model: 'gpt-4' },
        targetModel: { provider: 'openai', model: 'gpt-4-turbo' },
        inputTokens: 10000,
        outputTokens: 5000,
      });

      expect(result.currentCost).toBeGreaterThan(0);
      expect(result.targetCost).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_PRICING', () => {
    it('should have pricing for openai models', () => {
      const openaiPricing = DEFAULT_PRICING.filter((p) => p.provider === 'openai');
      expect(openaiPricing.length).toBeGreaterThan(0);
    });

    it('should have pricing for anthropic models', () => {
      const anthropicPricing = DEFAULT_PRICING.filter((p) => p.provider === 'anthropic');
      expect(anthropicPricing.length).toBeGreaterThan(0);
    });

    it('should have pricing for google models', () => {
      const googlePricing = DEFAULT_PRICING.filter((p) => p.provider === 'google');
      expect(googlePricing.length).toBeGreaterThan(0);
    });
  });

  describe('getPricing', () => {
    it('should get pricing for a specific model', () => {
      const pricing = getPricing('openai', 'gpt-4');
      expect(pricing).toBeDefined();
      expect(pricing?.inputPricePerMillion).toBeGreaterThan(0);
      expect(pricing?.outputPricePerMillion).toBeGreaterThan(0);
    });

    it('should return undefined for unknown model', () => {
      const pricing = getPricing('openai', 'unknown-model');
      expect(pricing).toBeUndefined();
    });
  });

  describe('addCustomPricing', () => {
    it('should add custom pricing for a model', () => {
      const customPricing = addCustomPricing([
        {
          provider: 'openai',
          model: 'custom-model',
          inputPricePerMillion: 10,
          outputPricePerMillion: 20,
        },
      ]);

      const pricing = getPricing('openai', 'custom-model', customPricing);
      expect(pricing).toBeDefined();
      expect(pricing?.inputPricePerMillion).toBe(10);
      expect(pricing?.outputPricePerMillion).toBe(20);
    });
  });

  describe('getProviderPricing', () => {
    it('should get all pricing for a provider', () => {
      const pricing = getProviderPricing('openai');
      expect(pricing).toBeDefined();
      expect(pricing.length).toBeGreaterThan(0);
    });
  });
});
