/**
 * Cost span collector with in-memory buffering
 */
import type { CostSpan } from '@reaatech/llm-cost-telemetry';

/**
 * Options for the cost collector
 */
export interface CollectorOptions {
  /** Maximum number of spans to buffer before flushing */
  maxBufferSize: number;
  /** Interval in milliseconds to automatically flush */
  flushIntervalMs: number;
  /** Callback when spans are flushed */
  onFlush?: (spans: CostSpan[]) => void | Promise<void>;
}

/**
 * Default collector options
 */
const DEFAULT_OPTIONS: CollectorOptions = {
  maxBufferSize: 1000,
  flushIntervalMs: 60000,
};

/**
 * Collects cost spans in memory with configurable flushing
 */
export class CostCollector {
  private buffer: CostSpan[] = [];
  private options: CollectorOptions;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private closed = false;

  constructor(options: Partial<CollectorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startFlushTimer();
  }

  /**
   * Add a cost span to the buffer
   */
  add(span: CostSpan): void {
    if (this.closed) {
      throw new Error('Collector is closed');
    }

    this.buffer.push(span);

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.options.maxBufferSize) {
      // eslint-disable-next-line no-console
      this.flush().catch(console.error);
    }
  }

  /**
   * Flush all buffered spans
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;
    const spans = this.buffer.splice(0, this.buffer.length);

    try {
      if (this.options.onFlush) {
        await this.options.onFlush(spans);
      }
    } catch (error) {
      // Re-add spans to buffer on failure
      this.buffer.unshift(...spans);
      throw error;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Get the current buffer size
   */
  get size(): number {
    return this.buffer.length;
  }

  /**
   * Start the automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      // eslint-disable-next-line no-console
      this.flush().catch(console.error);
    }, this.options.flushIntervalMs);

    // Don't keep process alive just for this timer
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /**
   * Close the collector and flush remaining spans
   */
  async close(): Promise<void> {
    this.closed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }

  /**
   * Get all spans in the buffer (for testing/debugging)
   */
  getSpans(): CostSpan[] {
    return [...this.buffer];
  }
}
