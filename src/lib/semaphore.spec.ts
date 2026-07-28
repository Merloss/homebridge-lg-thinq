import { describe, expect, test } from '@jest/globals';
import {
  Semaphore,
  SemaphoreQueueFullError,
  SemaphoreTimeoutError,
} from './semaphore.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

describe('Semaphore', () => {
  test('grants slots up to the concurrency limit without waiting', async () => {
    const semaphore = new Semaphore({ concurrency: 2 });

    await semaphore.acquire();
    await semaphore.acquire();

    expect(semaphore.activeCount).toBe(2);
    expect(semaphore.queueLength).toBe(0);
  });

  test('queues callers past the limit and hands the slot on in FIFO order', async () => {
    const semaphore = new Semaphore({ concurrency: 1 });
    const order: number[] = [];

    const release = await semaphore.acquire();
    const second = semaphore.acquire().then(r => {
      order.push(2);
      return r;
    });
    const third = semaphore.acquire().then(r => {
      order.push(3);
      return r;
    });

    await tick();
    expect(order).toEqual([]);
    expect(semaphore.queueLength).toBe(2);

    release();
    (await second)();
    (await third)();

    expect(order).toEqual([2, 3]);
    expect(semaphore.activeCount).toBe(0);
  });

  test('releasing twice does not hand out a slot the caller no longer holds', async () => {
    const semaphore = new Semaphore({ concurrency: 1 });

    const release = await semaphore.acquire();
    release();
    release();

    expect(semaphore.activeCount).toBe(0);

    await semaphore.acquire();
    expect(semaphore.activeCount).toBe(1);
  });

  test('rejects instead of growing the queue without bound', async () => {
    const semaphore = new Semaphore({ concurrency: 1, maxQueueLength: 2 });

    await semaphore.acquire();
    const queued = [semaphore.acquire(), semaphore.acquire()];

    await expect(semaphore.acquire()).rejects.toThrow(SemaphoreQueueFullError);

    // The already-queued waiters stay valid; only the overflow is rejected.
    expect(semaphore.queueLength).toBe(2);
    queued.forEach(promise => promise.catch(() => undefined));
  });

  test('times out a waiter rather than blocking it forever', async () => {
    const semaphore = new Semaphore({ concurrency: 1, acquireTimeoutMs: 20 });

    await semaphore.acquire();

    await expect(semaphore.acquire()).rejects.toThrow(SemaphoreTimeoutError);
    expect(semaphore.queueLength).toBe(0);
  });

  test('a timed-out waiter does not consume the slot when it is released later', async () => {
    const semaphore = new Semaphore({ concurrency: 1, acquireTimeoutMs: 20 });

    const release = await semaphore.acquire();
    const abandoned = semaphore.acquire();
    await expect(abandoned).rejects.toThrow(SemaphoreTimeoutError);

    release();
    expect(semaphore.activeCount).toBe(0);

    // The slot must still be available to a fresh caller.
    await semaphore.acquire();
    expect(semaphore.activeCount).toBe(1);
  });
});
