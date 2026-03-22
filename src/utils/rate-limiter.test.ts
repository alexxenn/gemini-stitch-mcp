import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('acquires immediately when tokens are available', async () => {
    const limiter = new RateLimiter({ maxTokens: 5, refillRate: 1 });
    const start = Date.now();

    // All 5 should resolve without any timer advancement
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    // No time should have elapsed because no timers were needed
    expect(Date.now() - start).toBe(0);
  });

  it('queues acquire when tokens are depleted', async () => {
    const limiter = new RateLimiter({ maxTokens: 2, refillRate: 1 });

    await limiter.acquire();
    await limiter.acquire();

    // 3rd acquire should be pending
    let resolved = false;
    const pending = limiter.acquire().then(() => {
      resolved = true;
    });

    // Not yet resolved before timer fires
    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    await pending;

    expect(resolved).toBe(true);
  });

  it('resolves queued acquire after refill interval', async () => {
    // refillRate: 2 tokens/sec, so 1 token refills in 500ms
    const limiter = new RateLimiter({ maxTokens: 2, refillRate: 2 });

    await limiter.acquire();
    await limiter.acquire(); // depleted

    let resolved = false;
    const pending = limiter.acquire().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    // Advance time by 1 second (enough for 2 token refills)
    await vi.advanceTimersByTimeAsync(1000);
    await pending;

    expect(resolved).toBe(true);
  });

  it('token count does not exceed maxTokens after long idle', async () => {
    const limiter = new RateLimiter({ maxTokens: 5, refillRate: 1 });

    // Deplete tokens
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    // Advance 1 hour to let tokens refill
    await vi.advanceTimersByTimeAsync(3600 * 1000);

    // Should be able to acquire 5 times (maxTokens) immediately
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    // 6th should queue
    let resolved = false;
    const pending = limiter.acquire().then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    await pending;
    expect(resolved).toBe(true);
  });

  it('multiple concurrent acquires resolve in FIFO order', async () => {
    const limiter = new RateLimiter({ maxTokens: 1, refillRate: 1 });

    // Deplete the single token
    await limiter.acquire();

    const order: number[] = [];
    const p1 = limiter.acquire().then(() => order.push(1));
    const p2 = limiter.acquire().then(() => order.push(2));
    const p3 = limiter.acquire().then(() => order.push(3));

    // Advance enough time for 3 tokens to refill (1 token/sec)
    await vi.advanceTimersByTimeAsync(4000);
    await Promise.all([p1, p2, p3]);

    expect(order).toEqual([1, 2, 3]);
  });

  it('max tokens cap on refill — tokens do not exceed maxTokens', async () => {
    const limiter = new RateLimiter({ maxTokens: 3, refillRate: 10 });

    // Deplete
    for (let i = 0; i < 3; i++) {
      await limiter.acquire();
    }

    // Advance a lot of time
    await vi.advanceTimersByTimeAsync(60000);

    // Should get exactly 3 immediate acquires and then queue on 4th
    for (let i = 0; i < 3; i++) {
      await limiter.acquire();
    }

    let resolved = false;
    const pending = limiter.acquire().then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    await pending;
    expect(resolved).toBe(true);
  });

  it('processQueue drains multiple tokens if time elapsed', async () => {
    const limiter = new RateLimiter({ maxTokens: 5, refillRate: 1 });

    // Deplete all tokens
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    const order: number[] = [];
    const p1 = limiter.acquire().then(() => order.push(1));
    const p2 = limiter.acquire().then(() => order.push(2));
    const p3 = limiter.acquire().then(() => order.push(3));

    // Advance enough time to refill 3 tokens
    await vi.advanceTimersByTimeAsync(4000);
    await Promise.all([p1, p2, p3]);

    expect(order.length).toBe(3);
  });
});
