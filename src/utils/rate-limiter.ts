import type { RateLimiterConfig } from "../types.js";

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private queue: Array<() => void> = [];

  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.maxTokens;
    this.refillRate = config.refillRate;
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
      setTimeout(() => this.processQueue(), waitMs);
    });
  }

  private processQueue(): void {
    this.refill();
    while (this.queue.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const next = this.queue.shift();
      next?.();
    }
  }
}

// Pre-configured limiters
export const geminiProLimiter = new RateLimiter({ maxTokens: 10, refillRate: 10 / 60 });
export const geminiFlashLimiter = new RateLimiter({ maxTokens: 60, refillRate: 60 / 60 });
export const stitchLimiter = new RateLimiter({ maxTokens: 30, refillRate: 30 / 60 });
