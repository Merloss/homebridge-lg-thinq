import axios, { AxiosAdapter, AxiosError, AxiosInstance } from 'axios';
import {
  ManualProcessNeeded,
  ManualProcessNeededErrorCode,
  MonitorError,
  NotConnectedError,
  RateLimitError,
  retryAfterMs,
  TokenExpiredErrorCode,
  TokenExpiredError,
  NotConnectedErrorCodes,
} from '../errors/index.js';
import axiosRetry from 'axios-retry';
import { ReleaseSlot, Semaphore, SemaphoreQueueFullError, SemaphoreTimeoutError } from './semaphore.js';

export const REQUEST_TIMEOUT_MS = 60000;
export const MAX_CONCURRENT_REQUESTS = 1;
export const MAX_QUEUED_REQUESTS = 60;
export const ACQUIRE_TIMEOUT_MS = 120000;
export const RETRY_COUNT = 2;
export const MAX_RETRY_DELAY_MS = 60000;

const BASE_ADAPTER = Symbol('thinq.baseAdapter');

export const requestSemaphore = new Semaphore({
  concurrency: MAX_CONCURRENT_REQUESTS,
  maxQueueLength: MAX_QUEUED_REQUESTS,
  acquireTimeoutMs: ACQUIRE_TIMEOUT_MS,
});

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function responseErrorMessage(err: any, fallback: string): string {
  return stringValue(err.response?.data?.error?.message)
    || stringValue(err.response?.data?.message)
    || stringValue(err.response?.data?.returnMsg)
    || stringValue(err.message)
    || fallback;
}

function errorWithCause<T extends Error>(error: T, cause: unknown): T {
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

/**
 * Wraps the real adapter so the queue slot is held for exactly the duration of
 * the network call and released in a `finally`.
 *
 * Doing this at the adapter level rather than in interceptors is deliberate: an
 * adapter that rejects with something other than an AxiosError carries no
 * `config`, so an interceptor-based release has nothing to key off and silently
 * leaks the slot. One leak with a concurrency of 1 wedges every later request,
 * which is how the plugin used to end up permanently unresponsive.
 */
function wrapAdapter(base: AxiosAdapter): AxiosAdapter {
  const wrapped: AxiosAdapter = async (config) => {
    const release: ReleaseSlot = await requestSemaphore.acquire();
    try {
      return await base(config);
    } finally {
      release();
    }
  };

  (wrapped as AxiosAdapter & { [BASE_ADAPTER]?: AxiosAdapter })[BASE_ADAPTER] = base;
  return wrapped;
}

/** Resolves the underlying adapter, unwrapping a previous wrap if present. */
function baseAdapterFor(candidate: unknown): AxiosAdapter {
  const previous = (candidate as { [BASE_ADAPTER]?: AxiosAdapter } | undefined)?.[BASE_ADAPTER];
  if (previous) {
    return previous;
  }

  return axios.getAdapter(candidate as any);
}

export function isRateLimited(err: unknown): boolean {
  return err instanceof RateLimitError
    || (axios.isAxiosError(err) && err.response?.status === 429);
}

/**
 * Retry backoff: exponential with jitter, honouring `Retry-After` when LG sends
 * one. Jitter matters because every device polls on the same tick, so a fixed
 * delay retries them all in lockstep and re-triggers the same throttle.
 */
export function retryDelayFor(
  retryCount: number,
  err: unknown,
  random: () => number = Math.random,
): number {
  if (axios.isAxiosError(err) && err.response?.status === 429) {
    const headerDelay = retryAfterMs(err.response.headers?.['retry-after']);
    if (headerDelay !== null) {
      return Math.min(headerDelay, MAX_RETRY_DELAY_MS);
    }
  }

  const base = Math.min(2000 * Math.pow(2, Math.max(0, retryCount - 1)), MAX_RETRY_DELAY_MS);
  return Math.round(base / 2 + random() * (base / 2));
}

export function shouldRetry(err: AxiosError): boolean {
  if (err.code?.indexOf('ECONN') === 0 || err.code === 'ETIMEDOUT' || err.code === 'EAI_AGAIN') {
    return true;
  }

  if (err.response === undefined) {
    // No response at all: retry only when the request actually went out and the
    // socket failed, never when we cancelled it or refused to queue it.
    return err.code !== 'ERR_CANCELED' && err.request !== undefined;
  }

  // 429 is retried too: LG throttles aggressively but recovers quickly.
  return [429, 500, 501, 502, 503, 504].includes(err.response.status);
}

const client = axios.create();
client.defaults.timeout = REQUEST_TIMEOUT_MS;

// Re-wrapped per attempt. axios-retry re-dispatches the same config object, so
// the previous wrapper is unwrapped first to avoid nesting an acquire inside an
// already-held slot, which would deadlock at a concurrency of 1.
client.interceptors.request.use((config) => {
  config.adapter = wrapAdapter(baseAdapterFor(config.adapter ?? client.defaults.adapter));
  return config;
});

axiosRetry(client, {
  retries: RETRY_COUNT,
  retryDelay: (retryCount, err) => retryDelayFor(retryCount, err),
  retryCondition: shouldRetry,
  shouldResetTimeout: true, // reset timeout each retries
});

client.interceptors.response.use((response) => {
  // thinq1 response
  if (typeof response.data === 'object' && 'lgedmRoot' in response.data && 'returnCd' in response.data.lgedmRoot) {
    const data = response.data.lgedmRoot;
    const code = data.returnCd as string;
    if (NotConnectedErrorCodes.includes(code)) {
      throw new NotConnectedError(data.returnMsg || '');
    } else if (code === TokenExpiredErrorCode) {
      throw new TokenExpiredError(data.returnMsg);
    } else if (code !== '0000') {
      throw new MonitorError(data.returnMsg ? code + ' - ' + data.returnMsg : code);
    }
  }

  return response;
}, (err) => {
  // Queue pressure is a local condition, not a ThinQ failure. Reporting it as
  // NotConnectedError would send discovery into a pointless reconnect loop.
  if (err instanceof SemaphoreQueueFullError || err instanceof SemaphoreTimeoutError) {
    return Promise.reject(err);
  }

  if (!err.response) {
    throw errorWithCause(new NotConnectedError(responseErrorMessage(err, 'Network request failed.')), err);
  } else if (err.response.status === 429) {
    throw errorWithCause(
      new RateLimitError(
        responseErrorMessage(err, 'LG ThinQ is rate limiting this account, increase refresh_interval.'),
        retryAfterMs(err.response.headers?.['retry-after']),
      ),
      err,
    );
  } else if (err.response.data?.resultCode === '9999') {
    throw errorWithCause(new NotConnectedError(responseErrorMessage(err, 'ThinQ service is not connected.')), err);
  } else if (err.response.data?.resultCode === TokenExpiredErrorCode) {
    throw errorWithCause(new TokenExpiredError(responseErrorMessage(err, 'ThinQ token expired.')), err);
  } else if (err.response.data?.resultCode === ManualProcessNeededErrorCode) {
    throw errorWithCause(
      new ManualProcessNeeded('Please open the native LG App and sign in to your account to see what happened, ' +
        'maybe new agreement need your accept. Then try restarting Homebridge.'),
      err,
    );
  }
  return Promise.reject(err);
});

export const requestClient = client as AxiosInstance;
