/**
 * Cost calculation engine
 * Provider-agnostic cost calculation with cache-aware pricing
 */
import type {
  Provider,
  PricingTier,
  CostBreakdown,
  CostEstimateRequest,
  CostEstimateResult,
} from '@reaatech/llm-cost-telemetry';
import { getPricing } from './pricing.js';
import { calculateCostFromTokens, roundTo } from '@reaatech/llm-cost-telemetry';

/**
 * Options for cost calculation
 */
export interface CostCalculationOptions {
  /** LLM provider */
  provider: Provider;
  /** Model name */
  model: string;
  /** Number of input tokens */
  inputTokens: number;
  /** Number of output tokens */
  outputTokens: number;
  /** Cache read tokens (Anthropic) */
  cacheReadTokens?: number;
  /** Cache creation tokens (Anthropic) */
  cacheCreationTokens?: number;
  /** Custom pricing tiers */
  customPricing?: PricingTier[];
}

/**
 * Calculate cost for an LLM API call
 */
export function calculateCost(options: CostCalculationOptions): {
  costUsd: number;
  breakdown: CostBreakdown;
} {
  const {
    provider,
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens = 0,
    cacheCreationTokens = 0,
    customPricing,
  } = options;

  // Get pricing for the model
  const pricing = getPricing(provider, model, customPricing);

  if (!pricing) {
    // Return zero cost if pricing not found (will be logged as warning)
    return {
      costUsd: 0,
      breakdown: {
        inputCostUsd: 0,
        outputCostUsd: 0,
      },
    };
  }

  // Calculate input cost (subtract cache read tokens since they're billed at discounted rate)
  const billableInputTokens = Math.max(0, inputTokens - cacheReadTokens);
  const inputCostUsd = calculateCostFromTokens(billableInputTokens, pricing.inputPricePerMillion);

  // Calculate output cost
  const outputCostUsd = calculateCostFromTokens(outputTokens, pricing.outputPricePerMillion);

  // Calculate cache costs if applicable
  const breakdown: CostBreakdown = {
    inputCostUsd: roundTo(inputCostUsd, 6),
    outputCostUsd: roundTo(outputCostUsd, 6),
  };

  let totalCostUsd = inputCostUsd + outputCostUsd;

  if (cacheReadTokens > 0 && pricing.cacheReadPricePerMillion !== undefined) {
    const cacheReadCostUsd = calculateCostFromTokens(
      cacheReadTokens,
      pricing.cacheReadPricePerMillion,
    );
    breakdown.cacheReadCostUsd = roundTo(cacheReadCostUsd, 6);
    totalCostUsd += cacheReadCostUsd;
  }

  if (cacheCreationTokens > 0 && pricing.cacheCreationPricePerMillion !== undefined) {
    const cacheCreationCostUsd = calculateCostFromTokens(
      cacheCreationTokens,
      pricing.cacheCreationPricePerMillion,
    );
    breakdown.cacheCreationCostUsd = roundTo(cacheCreationCostUsd, 6);
    totalCostUsd += cacheCreationCostUsd;
  }

  return {
    costUsd: roundTo(totalCostUsd, 6),
    breakdown,
  };
}

/**
 * Estimate cost before making an API call
 */
export async function estimateCost(request: CostEstimateRequest): Promise<CostEstimateResult> {
  const { provider, model, inputTokens, outputTokens, maxTokens, useCache = false } = request;

  // Use provided output tokens or estimate from maxTokens
  const estimatedOutputTokens = outputTokens ?? Math.ceil((maxTokens ?? 0) * 0.7);

  // Get pricing
  const pricing = getPricing(provider, model);

  if (!pricing) {
    return {
      usd: 0,
      inputTokens,
      outputTokens: estimatedOutputTokens,
      confidence: 0,
    };
  }

  // Calculate estimated cost
  const inputCost = calculateCostFromTokens(inputTokens, pricing.inputPricePerMillion);
  const outputCost = calculateCostFromTokens(estimatedOutputTokens, pricing.outputPricePerMillion);

  let totalCost = inputCost + outputCost;
  const breakdown: CostBreakdown = {
    inputCostUsd: roundTo(inputCost, 6),
    outputCostUsd: roundTo(outputCost, 6),
  };

  // Account for cache savings if applicable
  if (useCache && pricing.cacheReadPricePerMillion !== undefined) {
    // Assume 50% cache hit rate for estimation
    const cacheSavings =
      (inputTokens * 0.5 * (pricing.inputPricePerMillion - pricing.cacheReadPricePerMillion)) /
      1_000_000;
    totalCost -= cacheSavings;
  }

  return {
    usd: roundTo(totalCost, 6),
    inputTokens,
    outputTokens: estimatedOutputTokens,
    confidence: outputTokens ? 0.95 : 0.7, // Higher confidence if output tokens provided
    breakdown,
  };
}

/**
 * Calculate cost per token for a model
 */
export function getCostPerToken(
  provider: Provider,
  model: string,
  tokenType: 'input' | 'output',
): number {
  const pricing = getPricing(provider, model);

  if (!pricing) {
    return 0;
  }

  const pricePerMillion =
    tokenType === 'input' ? pricing.inputPricePerMillion : pricing.outputPricePerMillion;

  return pricePerMillion / 1_000_000;
}

/**
 * Compare costs between different models for the same workload
 */
export function compareModelCosts(options: {
  inputTokens: number;
  outputTokens: number;
  models: Array<{ provider: Provider; model: string }>;
}): Array<{
  provider: Provider;
  model: string;
  costUsd: number;
  breakdown: CostBreakdown;
}> {
  const { inputTokens, outputTokens, models } = options;

  return models.map(({ provider, model }) => {
    const { costUsd, breakdown } = calculateCost({
      provider,
      model,
      inputTokens,
      outputTokens,
    });

    return {
      provider,
      model,
      costUsd,
      breakdown,
    };
  });
}

/**
 * Calculate potential savings from using a cheaper model
 */
export function calculateSavings(options: {
  inputTokens: number;
  outputTokens: number;
  currentModel: { provider: Provider; model: string };
  targetModel: { provider: Provider; model: string };
}): {
  currentCost: number;
  targetCost: number;
  savings: number;
  savingsPercentage: number;
} {
  const { inputTokens, outputTokens, currentModel, targetModel } = options;

  const currentResult = calculateCost({
    provider: currentModel.provider,
    model: currentModel.model,
    inputTokens,
    outputTokens,
  });

  const targetResult = calculateCost({
    provider: targetModel.provider,
    model: targetModel.model,
    inputTokens,
    outputTokens,
  });

  const savings = currentResult.costUsd - targetResult.costUsd;
  const savingsPercentage = currentResult.costUsd > 0 ? (savings / currentResult.costUsd) * 100 : 0;

  return {
    currentCost: currentResult.costUsd,
    targetCost: targetResult.costUsd,
    savings: roundTo(savings, 6),
    savingsPercentage: roundTo(savingsPercentage, 2),
  };
}
