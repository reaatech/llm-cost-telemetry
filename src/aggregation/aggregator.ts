/**
 * Cost aggregation engine
 * Aggregates costs by tenant, feature, route, and time windows
 */
import type { CostSpan, CostRecord, TimeWindow, CostSummary } from '../types/index.js';
import { generateId, getWindowStart, getWindowEnd, roundTo } from '../utils/index.js';

/**
 * Aggregation dimension type
 */
export type AggregationDimension = 'tenant' | 'feature' | 'route' | 'provider' | 'model';

/**
 * Options for the aggregation engine
 */
export interface AggregatorOptions {
  /** Dimensions to aggregate by */
  dimensions: AggregationDimension[];
  /** Time windows to use for aggregation */
  timeWindows: TimeWindow[];
  /** Maximum number of records to store (0 = unlimited) */
  maxRecords?: number;
}

/**
 * Default aggregator options
 */
const DEFAULT_OPTIONS: AggregatorOptions = {
  dimensions: ['tenant', 'feature', 'route'],
  timeWindows: ['minute', 'hour', 'day'],
  maxRecords: 10000,
};

/**
 * Key for aggregation storage
 */
interface AggregationKeyInternal {
  dimension: string;
  value: string;
  window: TimeWindow;
  windowStart: string;
}

/**
 * Cost aggregation engine
 */
export class CostAggregator {
  private options: AggregatorOptions;

  /** Storage for aggregated costs: key -> CostRecord */
  private storage: Map<string, CostRecord> = new Map();
  /** Canonical span storage for accurate summaries and retrieval */
  private spans: Map<string, CostSpan> = new Map();

  constructor(options: Partial<AggregatorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Add a cost span to the aggregator
   */
  add(span: CostSpan): void {
    const spanId = span.id ?? span.spanId ?? generateId();
    span.id = spanId;
    span.spanId ??= spanId;
    this.spans.set(spanId, { ...span });

    const spanTime = span.startTime ?? span.timestamp ?? new Date();
    for (const window of this.options.timeWindows) {
      const windowStart = getWindowStart(spanTime, window);
      const windowStartStr = windowStart.toISOString();

      // Aggregate by each configured dimension
      for (const dimension of this.options.dimensions) {
        const value = this.getDimensionValue(span, dimension);
        if (value) {
          const key = this.createKey({
            dimension,
            value,
            window,
            windowStart: windowStartStr,
          });

          const existing = this.storage.get(key);

          if (existing) {
            const currentCost = existing.totalCostUsd ?? existing.totalUsd ?? 0;
            existing.totalCostUsd = roundTo(currentCost + span.costUsd, 6);
            existing.totalInputTokens += span.inputTokens;
            existing.totalOutputTokens += span.outputTokens;
            const currentCalls = existing.totalCalls ?? existing.apiCalls ?? 0;
            existing.totalCalls = currentCalls + 1;
            const newEndTime = span.endTime ?? spanTime;
            const existingEndTime = existing.endTime ?? existing.windowEnd ?? windowStart;
            existing.endTime =
              newEndTime && newEndTime > existingEndTime ? newEndTime : existingEndTime;
          } else {
            this.storage.set(key, {
              id: key,
              dimension,
              value,
              window,
              windowStart,
              windowEnd: getWindowEnd(spanTime, window),
              totalCostUsd: span.costUsd,
              totalInputTokens: span.inputTokens,
              totalOutputTokens: span.outputTokens,
              totalCalls: 1,
              startTime: spanTime,
              endTime: span.endTime ?? spanTime,
              metadata: {
                provider: span.provider,
                model: span.model,
              },
            });
          }
        }
      }
    }

    // Evict oldest records if over limit
    if (this.options.maxRecords && this.storage.size > this.options.maxRecords) {
      const toRemove = this.storage.size - this.options.maxRecords;
      const keys = Array.from(this.storage.keys());
      for (let i = 0; i < toRemove && i < keys.length; i++) {
        this.storage.delete(keys[i]);
      }
    }
  }

  /**
   * Get a span by ID
   */
  getSpan(spanId: string): CostSpan | undefined {
    const span = this.spans.get(spanId);
    return span ? { ...span } : undefined;
  }

  /**
   * Get all stored spans
   */
  getSpans(): CostSpan[] {
    return Array.from(this.spans.values(), (span) => ({ ...span }));
  }

  /**
   * Create a storage key from aggregation key
   */
  private createKey(key: AggregationKeyInternal): string {
    return `${key.dimension}:${key.value}:${key.window}:${key.windowStart}`;
  }

  /**
   * Get aggregated costs by tenant
   */
  getByTenant(tenant: string, window: TimeWindow = 'day'): CostRecord[] {
    const records: CostRecord[] = [];
    for (const record of this.storage.values()) {
      if (record.dimension === 'tenant' && record.value === tenant && record.window === window) {
        records.push(record);
      }
    }
    return records;
  }

  /**
   * Get aggregated costs by feature
   */
  getByFeature(feature: string, window: TimeWindow = 'day'): CostRecord[] {
    const records: CostRecord[] = [];
    for (const record of this.storage.values()) {
      if (record.dimension === 'feature' && record.value === feature && record.window === window) {
        records.push(record);
      }
    }
    return records;
  }

  /**
   * Get aggregated costs by route
   */
  getByRoute(route: string, window: TimeWindow = 'day'): CostRecord[] {
    const records: CostRecord[] = [];
    for (const record of this.storage.values()) {
      if (record.dimension === 'route' && record.value === route && record.window === window) {
        records.push(record);
      }
    }
    return records;
  }

  /**
   * Get cost summary for a time period
   */
  getSummary(options: {
    period?: TimeWindow;
    groupBy?: AggregationDimension[];
    tenant?: string;
  }): CostSummary {
    const { period = 'day', groupBy = ['tenant'], tenant } = options;

    const filtered = this.getSpansForPeriod(period).filter((span) => {
      if (!tenant) return true;
      return this.getDimensionValue(span, 'tenant') === tenant;
    });

    const totalCostUsd = roundTo(
      filtered.reduce((sum, span) => sum + span.costUsd, 0),
      6,
    );
    const totalInputTokens = filtered.reduce((sum, span) => sum + span.inputTokens, 0);
    const totalOutputTokens = filtered.reduce((sum, span) => sum + span.outputTokens, 0);
    const totalCalls = filtered.length;

    // Group by requested dimensions
    const byDimension: Record<string, { totalCost: number; totalCalls: number }> = {};
    for (const dim of groupBy) {
      const dimSpans = filtered.filter((span) => this.getDimensionValue(span, dim) !== undefined);
      byDimension[dim] = {
        totalCost: roundTo(
          dimSpans.reduce((sum, span) => sum + span.costUsd, 0),
          6,
        ),
        totalCalls: dimSpans.length,
      };
    }

    return {
      period,
      totalCostUsd,
      totalInputTokens,
      totalOutputTokens,
      totalCalls,
      totalApiCalls: totalCalls,
      avgCostPerCall: totalCalls > 0 ? roundTo(totalCostUsd / totalCalls, 6) : 0,
      byDimension,
    } as CostSummary;
  }

  /**
   * Get all records
   */
  getAll(): CostRecord[] {
    return Array.from(this.storage.values());
  }

  /**
   * Clear all stored records
   */
  clear(): void {
    this.storage.clear();
    this.spans.clear();
  }

  /**
   * Get the number of stored records
   */
  get size(): number {
    return this.storage.size;
  }

  private getDimensionValue(span: CostSpan, dimension: AggregationDimension): string | undefined {
    switch (dimension) {
      case 'provider':
        return span.provider;
      case 'model':
        return span.model;
      case 'tenant':
        return span.telemetry?.tenant ?? span.tenant;
      case 'feature':
        return span.telemetry?.feature ?? span.feature;
      case 'route':
        return span.telemetry?.route ?? span.route;
    }
  }

  private getSpansForPeriod(period: TimeWindow): CostSpan[] {
    void period;
    return Array.from(this.spans.values());
  }
}
