/**
 * Built-in pricing data for major LLM models
 */
import type { PricingTier, Provider } from '@reaatech/llm-cost-telemetry';

/**
 * Default pricing tiers for all supported providers and models
 * Prices are per 1 million tokens in USD
 * Last updated: 2026-04
 */
export const DEFAULT_PRICING: PricingTier[] = [
  // OpenAI Models
  {
    provider: 'openai',
    model: 'gpt-4',
    inputPricePerMillion: 30.0,
    outputPricePerMillion: 60.0,
  },
  {
    provider: 'openai',
    model: 'gpt-4-turbo',
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 30.0,
  },
  {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 30.0,
  },
  {
    provider: 'openai',
    model: 'gpt-4-0125-preview',
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 30.0,
  },
  {
    provider: 'openai',
    model: 'gpt-4-1106-preview',
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 30.0,
  },
  {
    provider: 'openai',
    model: 'gpt-4-vision-preview',
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 30.0,
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    inputPricePerMillion: 5.0,
    outputPricePerMillion: 15.0,
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo-0125',
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo-1106',
    inputPricePerMillion: 1.0,
    outputPricePerMillion: 2.0,
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo-instruct',
    inputPricePerMillion: 1.5,
    outputPricePerMillion: 2.0,
  },
  // Anthropic Models
  {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
    cacheReadPricePerMillion: 1.5,
    cacheCreationPricePerMillion: 18.75,
  },
  {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheReadPricePerMillion: 0.3,
    cacheCreationPricePerMillion: 3.75,
  },
  {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
    cacheReadPricePerMillion: 0.025,
    cacheCreationPricePerMillion: 0.3125,
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheReadPricePerMillion: 0.3,
    cacheCreationPricePerMillion: 3.75,
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4.0,
    cacheReadPricePerMillion: 0.08,
    cacheCreationPricePerMillion: 1.0,
  },
  // Google Models
  {
    provider: 'google',
    model: 'gemini-pro',
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },
  {
    provider: 'google',
    model: 'gemini-1.0-pro',
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },
  {
    provider: 'google',
    model: 'gemini-1.5-pro',
    inputPricePerMillion: 3.5,
    outputPricePerMillion: 10.5,
  },
  {
    provider: 'google',
    model: 'gemini-1.5-flash',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.3,
  },
  {
    provider: 'google',
    model: 'text-embedding-004',
    inputPricePerMillion: 0.025,
    outputPricePerMillion: 0.025,
  },
];

/**
 * Get pricing for a specific model and provider
 */
export function getPricing(
  provider: Provider,
  model: string,
  customPricing?: PricingTier[],
): PricingTier | undefined {
  const pricingList = customPricing ?? DEFAULT_PRICING;

  // Try exact match first
  let pricing = pricingList.find((p) => p.provider === provider && p.model === model);

  // Try pattern match (e.g., gpt-4-* matches gpt-4-turbo)
  if (!pricing) {
    pricing = pricingList.find((p) => {
      if (p.provider !== provider) return false;
      if (p.model.includes('*')) {
        const pattern = p.model.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(model);
      }
      return false;
    });
  }

  return pricing;
}

/**
 * Add custom pricing tiers (overrides defaults for matching models)
 */
export function addCustomPricing(
  customTiers: PricingTier[],
  existingTiers: PricingTier[] = DEFAULT_PRICING,
): PricingTier[] {
  const result = [...existingTiers];

  for (const custom of customTiers) {
    const index = result.findIndex(
      (p) => p.provider === custom.provider && p.model === custom.model,
    );

    if (index >= 0) {
      result[index] = custom;
    } else {
      result.push(custom);
    }
  }

  return result;
}

/**
 * Get all pricing tiers for a provider
 */
export function getProviderPricing(provider: Provider): PricingTier[] {
  return DEFAULT_PRICING.filter((p) => p.provider === provider);
}
