import type { CacheEntry } from "../types.js";

const DEFAULT_MAX_SIZE = 50;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class ScreenCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = DEFAULT_MAX_SIZE, ttlMs = DEFAULT_TTL_MS) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
