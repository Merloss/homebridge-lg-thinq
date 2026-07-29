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
export declare class SemaphoreQueueFullError extends Error {
    constructor(maxQueueLength: number);
}
export declare class SemaphoreTimeoutError extends Error {
    constructor(acquireTimeoutMs: number);
}
export declare class Semaphore {
    private readonly concurrency;
    private readonly maxQueueLength;
    private readonly acquireTimeoutMs;
    private active;
    private readonly waiters;
    constructor(options?: SemaphoreOptions);
    get activeCount(): number;
    get queueLength(): number;
    acquire(): Promise<ReleaseSlot>;
    /**
     * Creates a release callback that is safe to call more than once. Axios can
     * settle a request through several interceptors, so idempotency here is what
     * keeps the active count from drifting below zero and handing out extra slots.
     */
    private createRelease;
    private pump;
}
