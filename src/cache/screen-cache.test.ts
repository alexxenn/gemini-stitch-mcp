import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScreenCache } from './screen-cache.js';

describe('ScreenCache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('set and get returns stored value', () => {
    const cache = new ScreenCache(10, 60000);
    cache.set('key1', { data: 'value1' });
    expect(cache.get('key1')).toEqual({ data: 'value1' });
  });

  it('get returns undefined for missing key', () => {
    const cache = new ScreenCache(10, 60000);
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('get returns undefined after TTL expires', () => {
    vi.useFakeTimers();
    const ttlMs = 5000;
    const cache = new ScreenCache(10, ttlMs);
    cache.set('key1', 'value1');

    vi.advanceTimersByTime(ttlMs + 1);

    expect(cache.get('key1')).toBeUndefined();
  });

  it('expired entry is deleted from internal map after TTL', () => {
    vi.useFakeTimers();
    const ttlMs = 5000;
    const cache = new ScreenCache(10, ttlMs);
    cache.set('key1', 'value1');

    expect(cache.size).toBe(1);

    vi.advanceTimersByTime(ttlMs + 1);
    cache.get('key1'); // triggers deletion

    expect(cache.size).toBe(0);
  });

  it('hit does not expire a still-valid entry', () => {
    vi.useFakeTimers();
    const ttlMs = 5000;
    const cache = new ScreenCache(10, ttlMs);
    cache.set('key1', 'value1');

    vi.advanceTimersByTime(ttlMs - 1);

    expect(cache.get('key1')).toBe('value1');
  });

  it('LRU eviction: oldest entry removed when at capacity', () => {
    const maxSize = 3;
    const cache = new ScreenCache(maxSize, 60000);

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // At capacity: a is oldest

    cache.set('d', 4); // should evict 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('LRU eviction: recently used entry survives eviction', () => {
    const maxSize = 3;
    const cache = new ScreenCache(maxSize, 60000);

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Access 'a' to promote it to most-recently-used
    cache.get('a');

    // Now 'b' is the oldest
    cache.set('d', 4); // should evict 'b'

    expect(cache.get('a')).toBe(1); // survives
    expect(cache.get('b')).toBeUndefined(); // evicted
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('set overwrites existing key without growing size', () => {
    const cache = new ScreenCache(10, 60000);
    cache.set('key1', 'value1');
    cache.set('key1', 'value2');

    expect(cache.size).toBe(1);
    expect(cache.get('key1')).toBe('value2');
  });

  it('has returns false for expired entry', () => {
    vi.useFakeTimers();
    const ttlMs = 5000;
    const cache = new ScreenCache(10, ttlMs);
    cache.set('key1', 'value1');

    vi.advanceTimersByTime(ttlMs + 1);

    expect(cache.has('key1')).toBe(false);
  });

  it('has returns true for valid entry', () => {
    const cache = new ScreenCache(10, 60000);
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);
  });

  it('delete removes an entry', () => {
    const cache = new ScreenCache(10, 60000);
    cache.set('key1', 'value1');
    cache.delete('key1');
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('clear empties the cache', () => {
    const cache = new ScreenCache(10, 60000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('size property reflects live count', () => {
    const cache = new ScreenCache(10, 60000);
    expect(cache.size).toBe(0);

    cache.set('a', 1);
    expect(cache.size).toBe(1);

    cache.set('b', 2);
    expect(cache.size).toBe(2);

    cache.delete('a');
    expect(cache.size).toBe(1);
  });

  it('default constructor uses DEFAULT_MAX_SIZE=50', () => {
    const cache = new ScreenCache(); // default: maxSize=50

    // Fill to 50
    for (let i = 0; i < 50; i++) {
      cache.set(`key${i}`, i);
    }
    expect(cache.size).toBe(50);

    // 51st insert should evict the first key
    cache.set('key50', 50);
    expect(cache.size).toBe(50);
    expect(cache.get('key0')).toBeUndefined(); // evicted
  });
});
