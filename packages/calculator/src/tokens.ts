/**
 * Token counting utilities
 * Integrates with tiktoken for OpenAI models and provides fallback estimation
 */
import type { Provider } from '@reaatech/llm-cost-telemetry';

/**
 * Token counter interface for different providers
 */
export interface TokenCountOptions {
  /** Model name */
  model: string;
  /** Text to count tokens for */
  text: string;
}

/**
 * Message format for counting tokens in conversations
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Token count result
 */
export interface TokenCountResult {
  /** Number of tokens */
  tokens: number;
  /** Whether this was an estimate */
  estimated: boolean;
}

/**
 * Approximate tokens per character for different models
 * These are rough estimates for fallback counting
 */
const TOKENS_PER_CHAR: Record<string, number> = {
  openai: 0.25, // ~4 chars per token for GPT models
  anthropic: 0.25, // Similar to OpenAI
  google: 0.25, // Similar ratio
};

/**
 * Count tokens for OpenAI models using tiktoken
 * Falls back to estimation if tiktoken is not available
 */
export async function countOpenAITokens(model: string, text: string): Promise<TokenCountResult> {
  try {
    // Try to use tiktoken if available
    const tiktoken = await import('tiktoken');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const encoding = tiktoken.encoding_for_model(model as any);
    const tokens = encoding.encode(text).length;
    encoding.free();
    return { tokens, estimated: false };
  } catch {
    // Fallback to estimation
    return estimateTokens('openai', text);
  }
}

/**
 * Count tokens for Anthropic models
 * Falls back to estimation if tokenizer is not available
 */
export async function countAnthropicTokens(_model: string, text: string): Promise<TokenCountResult> {
  // Anthropic doesn't have a public tokenizer package
  // Use estimation for now
  return estimateTokens('anthropic', text);
}

/**
 * Count tokens for Google models
 * Falls back to estimation
 */
export async function countGoogleTokens(_model: string, text: string): Promise<TokenCountResult> {
  // Google uses sentencepiece, no public package
  // Use estimation
  return estimateTokens('google', text);
}

/**
 * Estimate tokens based on character count
 */
function estimateTokens(provider: Provider, text: string): TokenCountResult {
  const charsPerToken = 1 / (TOKENS_PER_CHAR[provider] ?? 0.25);
  const tokens = Math.ceil(text.length / charsPerToken);
  return { tokens, estimated: true };
}

/**
 * Count tokens for a list of messages
 */
export async function countMessageTokens(
  provider: Provider,
  model: string,
  messages: Message[],
): Promise<TokenCountResult> {
  let totalTokens = 0;
  let estimated = false;

  for (const message of messages) {
    // Count role and content
    const roleText = `${message.role}: `;
    const result = await countText(provider, model, roleText + message.content);
    totalTokens += result.tokens;
    if (result.estimated) {
      estimated = true;
    }
  }

  // Add overhead for message formatting
  totalTokens += messages.length * 3; // Approximate overhead per message

  return { tokens: totalTokens, estimated };
}

/**
 * Count tokens for text based on provider
 */
export async function countText(
  provider: Provider,
  model: string,
  text: string,
): Promise<TokenCountResult> {
  switch (provider) {
    case 'openai':
      return countOpenAITokens(model, text);
    case 'anthropic':
      return countAnthropicTokens(model, text);
    case 'google':
      return countGoogleTokens(model, text);
    default:
      return estimateTokens(provider, text);
  }
}

/**
 * Estimate output tokens based on max_tokens parameter
 */
export function estimateOutputTokens(maxTokens?: number): number {
  if (!maxTokens) return 0;
  // Assume average output is about 70% of max
  return Math.ceil(maxTokens * 0.7);
}

/**
 * Count tokens for function definitions (OpenAI)
 */
export async function countFunctionTokens(
  model: string,
  functions: Array<{ name: string; description?: string; parameters?: unknown }>,
): Promise<TokenCountResult> {
  let totalTokens = 0;
  let estimated = false;

  for (const func of functions) {
    // Count function name and description
    const funcText = JSON.stringify(func);
    const result = await countOpenAITokens(model, funcText);
    totalTokens += result.tokens;
    if (result.estimated) {
      estimated = true;
    }
  }

  // Add overhead for function calling format
  totalTokens += functions.length * 5;

  return { tokens: totalTokens, estimated };
}

/**
 * Calculate total tokens for a request
 */
export interface TotalTokenCalculation {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimated: boolean;
}

export async function calculateTotalTokens(options: {
  provider: Provider;
  model: string;
  messages: Message[];
  maxTokens?: number;
  functions?: Array<{ name: string; description?: string; parameters?: unknown }>;
}): Promise<TotalTokenCalculation> {
  const { provider, model, messages, maxTokens, functions } = options;

  // Count input tokens
  const inputResult = await countMessageTokens(provider, model, messages);
  let inputTokens = inputResult.tokens;
  let estimated = inputResult.estimated;

  // Add function tokens if present
  if (functions && functions.length > 0) {
    const funcResult = await countFunctionTokens(model, functions);
    inputTokens += funcResult.tokens;
    if (funcResult.estimated) {
      estimated = true;
    }
  }

  // Estimate output tokens
  const outputTokens = estimateOutputTokens(maxTokens);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimated,
  };
}
