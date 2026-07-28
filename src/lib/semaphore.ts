/**
 * A small FIFO semaphore used to serialise outbound ThinQ API calls.
 *
 * The previous implementation busy-waited on a 10ms `setInterval` per queued
 * request. When a single request stalled (LG throttling, a 60s timeout plus
 * retries) every subsequent poll tick queued another never-cleared timer, so the
 * plugin slowly filled the event loop with timers and stopped responding.
 *
 * This implementation keeps an explicit queue of waiters, hands the slot to the
 * next waiter on release, and bounds both how long a caller may wait and how
 * many callers may wait at once. Those bounds turn "the plugin silently froze"
 * into an ordinary rejected request that the caller can log and retry.
 */

export type ReleaseSlot = () => void;

export type SemaphoreOptions = {
  concurrency?: number;
  maxQueueLength?: number;
  acquireTimeoutMs?: number;
};

type Waiter = {
  resolve: (release: ReleaseSlot) => void;
  reject: (err: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
  settled: boolean;
};

export class SemaphoreQueueFullError extends Error {
  constructor(maxQueueLength: number) {
    super(`Too many ThinQ API requests are already queued (limit ${maxQueueLength}). Dropping this request.`);
    this.name = 'SemaphoreQueueFullError';
  }
}

export class SemaphoreTimeoutError extends Error {
  constructor(acquireTimeoutMs: number) {
    super(`Timed out after ${acquireTimeoutMs}ms waiting for a free ThinQ API request slot.`);
    this.name = 'SemaphoreTimeoutError';
  }
}

export class Semaphore {
  private readonly concurrency: number;
  private readonly maxQueueLength: number;
  private readonly acquireTimeoutMs: number;

  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(options: SemaphoreOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.maxQueueLength = Math.max(1, options.maxQueueLength ?? 100);
    this.acquireTimeoutMs = Math.max(0, options.acquireTimeoutMs ?? 120000);
  }

  get activeCount(): number {
    return this.active;
  }

  get queueLength(): number {
    return this.waiters.length;
  }

  acquire(): Promise<ReleaseSlot> {
    if (this.active < this.concurrency) {
      this.active++;
      return Promise.resolve(this.createRelease());
    }

    if (this.waiters.length >= this.maxQueueLength) {
      return Promise.reject(new SemaphoreQueueFullError(this.maxQueueLength));
    }

    return new Promise<ReleaseSlot>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, settled: false };

      if (this.acquireTimeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          if (waiter.settled) {
            return;
          }
          waiter.settled = true;
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) {
            this.waiters.splice(index, 1);
          }
          reject(new SemaphoreTimeoutError(this.acquireTimeoutMs));
        }, this.acquireTimeoutMs);
        // Never keep the Homebridge process alive just to wait on a queue slot.
        waiter.timer.unref?.();
      }

      this.waiters.push(waiter);
    });
  }

  /**
   * Creates a release callback that is safe to call more than once. Axios can
   * settle a request through several interceptors, so idempotency here is what
   * keeps the active count from drifting below zero and handing out extra slots.
   */
  private createRelease(): ReleaseSlot {
    let released = false;

    return () => {
      if (released) {
        return;
      }
      released = true;
      this.active--;
      this.pump();
    };
  }

  private pump(): void {
    while (this.active < this.concurrency) {
      const waiter = this.waiters.shift();
      if (!waiter) {
        return;
      }

      if (waiter.settled) {
        continue;
      }

      waiter.settled = true;
      if (waiter.timer) {
        clearTimeout(waiter.timer);
      }

      this.active++;
      waiter.resolve(this.createRelease());
    }
  }
}
