import { AxiosError, AxiosInstance } from 'axios';
import { Semaphore } from './semaphore.js';
export declare const REQUEST_TIMEOUT_MS = 60000;
export declare const MAX_CONCURRENT_REQUESTS = 1;
export declare const MAX_QUEUED_REQUESTS = 60;
export declare const ACQUIRE_TIMEOUT_MS = 120000;
export declare const RETRY_COUNT = 2;
export declare const MAX_RETRY_DELAY_MS = 60000;
export declare const requestSemaphore: Semaphore;
export declare function isRateLimited(err: unknown): boolean;
/**
 * Retry backoff: exponential with jitter, honouring `Retry-After` when LG sends
 * one. Jitter matters because every device polls on the same tick, so a fixed
 * delay retries them all in lockstep and re-triggers the same throttle.
 */
export declare function retryDelayFor(retryCount: number, err: unknown, random?: () => number): number;
export declare function shouldRetry(err: AxiosError): boolean;
export declare const requestClient: AxiosInstance;
