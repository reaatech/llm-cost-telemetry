import { readFile } from 'node:fs/promises';
import type { CostSpan } from '@reaatech/llm-cost-telemetry';

export async function loadSpansInput(inputPath?: string): Promise<CostSpan[]> {
  const raw = inputPath ? await readFile(inputPath, 'utf-8') : await readStdinIfPiped();

  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Input must be a JSON array of cost spans');
  }

  return parsed.map((item) => normalizeSpan(item));
}

function normalizeSpan(value: unknown): CostSpan {
  if (!value || typeof value !== 'object') {
    throw new Error('Each input item must be an object');
  }

  const item = value as Record<string, unknown>;
  if (typeof item.provider !== 'string' || typeof item.model !== 'string') {
    throw new Error('Each span must include provider and model');
  }
  if (typeof item.inputTokens !== 'number' || typeof item.outputTokens !== 'number') {
    throw new Error('Each span must include numeric inputTokens and outputTokens');
  }
  if (typeof item.costUsd !== 'number') {
    throw new Error('Each span must include numeric costUsd');
  }

  const startTime = parseOptionalDate(item.startTime) ?? parseOptionalDate(item.timestamp);
  const endTime = parseOptionalDate(item.endTime) ?? startTime;

  return {
    ...(item as unknown as CostSpan),
    startTime,
    endTime,
    timestamp: parseOptionalDate(item.timestamp),
  };
}

function parseOptionalDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return undefined;
}

async function readStdinIfPiped(): Promise<string | undefined> {
  if (process.stdin.isTTY) {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const input = Buffer.concat(chunks).toString('utf-8').trim();
  return input.length > 0 ? input : undefined;
}
