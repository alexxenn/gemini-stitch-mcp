import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from './retry.js';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on status 429 and succeeds on retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on status 503 and succeeds on retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on ECONNRESET and succeeds on retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on status 400', async () => {
    const err = { status: 400, message: 'Bad Request' };
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn)).rejects.toMatchObject({ status: 400 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on status 404', async () => {
    const err = { status: 404, message: 'Not Found' };
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn)).rejects.toMatchObject({ status: 404 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-status errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('syntax error'));

    await expect(withRetry(fn)).rejects.toThrow('syntax error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts maxRetries and throws last error', async () => {
    const err = Object.assign(new Error('Too Many Requests'), { status: 429 });
    const fn = vi.fn().mockRejectedValue(err);

    const promise = withRetry(fn, { maxRetries: 3, initialDelayMs: 10 });
    // Attach rejection handler before advancing timers to avoid unhandled rejection
    const assertion = expect(promise).rejects.toMatchObject({ status: 429 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('respects custom maxRetries', async () => {
    const err = Object.assign(new Error('Internal Server Error'), { status: 500 });
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxRetries: 1, initialDelayMs: 10 });
    // Attach rejection handler before advancing timers to avoid unhandled rejection
    const assertion = expect(promise).rejects.toMatchObject({ status: 500 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('caps delay at maxDelayMs', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('ok');

    const promise = withRetry(fn, {
      initialDelayMs: 1000,
      maxDelayMs: 1500,
      maxRetries: 3,
    });
    await vi.runAllTimersAsync();
    await promise;

    // All setTimeout calls should have values <= maxDelayMs (1500)
    const timerCalls = setTimeoutSpy.mock.calls;
    for (const call of timerCalls) {
      const delay = call[1] as number;
      expect(delay).toBeLessThanOrEqual(1500);
    }
  });

  it('applies jitter — delay is in [0.5×base, 1.0×base]', async () => {
    // With Math.random = 0, jitter = delay * 0.5
    // With Math.random = 1, jitter = delay * 1.0
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('ok');

    const initialDelayMs = 1000;
    const promise = withRetry(fn, { initialDelayMs, maxRetries: 3 });
    await vi.runAllTimersAsync();
    await promise;

    // With random=0, jitter = 1000 * (0.5 + 0 * 0.5) = 500
    const timerCalls = setTimeoutSpy.mock.calls;
    expect(timerCalls.length).toBeGreaterThan(0);
    const delay = timerCalls[0][1] as number;
    expect(delay).toBeCloseTo(500, 0);

    randomSpy.mockRestore();
  });

  it('custom retryOn predicate prevents retry when predicate returns false', async () => {
    const err = { status: 429 };
    const fn = vi.fn().mockRejectedValue(err);
    const retryOn = vi.fn().mockReturnValue(false);

    await expect(withRetry(fn, { retryOn })).rejects.toMatchObject({ status: 429 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(retryOn).toHaveBeenCalledWith(err);
  });

  it('custom retryOn predicate triggers retry when predicate returns true', async () => {
    const err = new Error('custom transient error');
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');
    const retryOn = vi.fn().mockReturnValue(true);

    const promise = withRetry(fn, { retryOn, initialDelayMs: 10 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('delay grows exponentially across attempts', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    // Pin random to 1 so jitter = delay * 1.0, making it easy to inspect the base delay
    vi.spyOn(Math, 'random').mockReturnValue(1);

    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { initialDelayMs: 100, maxDelayMs: 100000, maxRetries: 5 });
    await vi.runAllTimersAsync();
    await promise;

    // Delays should be approx 100, 200, 400 (exponential with random=1 means full base delay)
    const delays = setTimeoutSpy.mock.calls.map((c) => c[1] as number);
    expect(delays.length).toBeGreaterThanOrEqual(3);
    // Each successive delay should be roughly double the previous
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[1]);
  });
});
