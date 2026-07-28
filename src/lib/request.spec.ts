import { describe, test, expect, afterEach, jest } from '@jest/globals';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MonitorError, NotConnectedError, RateLimitError, retryAfterMs, TokenExpiredError } from '../errors/index.js';
import {
  isRateLimited,
  MAX_RETRY_DELAY_MS,
  requestClient,
  requestSemaphore,
  retryDelayFor,
  shouldRetry,
} from './request.js';

const originalAdapter = requestClient.defaults.adapter;

const responseFor = (config: InternalAxiosRequestConfig, data: unknown = { ok: true }): AxiosResponse => ({
  config,
  data,
  headers: {},
  status: 200,
  statusText: 'OK',
});

const withTimeout = async <T>(promise: Promise<T>, ms = 1000): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('request slot was not released')), ms);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

describe('request client throttling', () => {
  afterEach(() => {
    requestClient.defaults.adapter = originalAdapter;
    jest.restoreAllMocks();
  });

  test('releases the request slot when a ThinQ1 response is translated into an error', async () => {
    let calls = 0;
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
      calls++;
      if (calls === 1) {
        return responseFor(config, {
          lgedmRoot: {
            returnCd: '0106',
            returnMsg: 'offline',
          },
        });
      }

      return responseFor(config);
    });

    requestClient.defaults.adapter = adapter as AxiosAdapter;

    await expect(requestClient.get('/thinq1-error')).rejects.toThrow(NotConnectedError);
    await expect(withTimeout(requestClient.get('/after-thinq1-error'))).resolves.toMatchObject({ data: { ok: true } });
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  test('releases the request slot when a network error is translated into an error', async () => {
    let calls = 0;
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
      calls++;
      if (calls === 1) {
        throw new Error('socket closed');
      }

      return responseFor(config);
    });

    requestClient.defaults.adapter = adapter as AxiosAdapter;

    await expect(requestClient.get('/network-error')).rejects.toThrow(NotConnectedError);
    await expect(withTimeout(requestClient.get('/after-network-error'))).resolves.toMatchObject({ data: { ok: true } });
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  test('preserves unknown ThinQ1 monitor error codes without undefined text', async () => {
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => responseFor(config, {
      lgedmRoot: {
        returnCd: '9998',
      },
    }));

    requestClient.defaults.adapter = adapter as AxiosAdapter;

    await expect(requestClient.get('/unknown-thinq1-error')).rejects.toThrow(new MonitorError('9998'));
  });

  test('releases the request slot when the adapter rejects with a non-Axios error', async () => {
    // A rejection without a `config` used to leak the queue slot, wedging every
    // later request behind a semaphore that would never be released.
    let calls = 0;
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
      calls++;
      if (calls === 1) {
        throw 'plain string rejection';
      }

      return responseFor(config);
    });

    requestClient.defaults.adapter = adapter as AxiosAdapter;

    await expect(requestClient.get('/weird-error')).rejects.toBeDefined();
    await expect(withTimeout(requestClient.get('/after-weird-error'))).resolves.toMatchObject({ data: { ok: true } });
  });

  test('does not nest slot acquisitions when a request is retried', async () => {
    // axios-retry re-dispatches the same config, so the adapter wrapper must be
    // unwrapped first; nesting an acquire inside a held slot would deadlock.
    let calls = 0;
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
      calls++;
      if (calls === 1) {
        throw new AxiosError('boom', 'ECONNRESET', config, {});
      }

      return responseFor(config);
    });

    requestClient.defaults.adapter = adapter as AxiosAdapter;

    await expect(withTimeout(requestClient.get('/retried'), 8000)).resolves.toMatchObject({ data: { ok: true } });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(requestSemaphore.activeCount).toBe(0);
    expect(requestSemaphore.queueLength).toBe(0);
  }, 15000);

  test('maps HTTP 429 to a RateLimitError carrying the Retry-After delay', async () => {
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('too many requests', 'ERR_BAD_REQUEST', config, {}, {
        config,
        data: {},
        // kept short so the test does not sit through the real backoff
        headers: { 'retry-after': '1' },
        status: 429,
        statusText: 'Too Many Requests',
      });
    });

    requestClient.defaults.adapter = adapter as AxiosAdapter;

    // retries are exhausted first, then the 429 surfaces as a typed error
    const error = await requestClient.get('/throttled').catch(err => err);

    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterMs).toBe(1000);
    expect(isRateLimited(error)).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
    expect(requestSemaphore.activeCount).toBe(0);
  }, 30000);

  test('reports the real cause of a retried failure instead of masking it', async () => {
    // axios-retry re-enters the interceptor chain, so an already-mapped error
    // arrives here a second time. Re-mapping it used to turn every exhausted
    // retry into a generic NotConnectedError.
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('server exploded', 'ERR_BAD_RESPONSE', config, {}, {
        config,
        data: { resultCode: '0102' },
        headers: {},
        status: 503,
        statusText: 'Service Unavailable',
      });
    });

    requestClient.defaults.adapter = adapter as AxiosAdapter;

    const error = await requestClient.get('/flaky').catch(err => err);

    expect(error).toBeInstanceOf(TokenExpiredError);
    expect(error).not.toBeInstanceOf(NotConnectedError);
    expect(adapter).toHaveBeenCalledTimes(3);
  }, 30000);
});

describe('retry policy', () => {
  test('retries throttling and server errors but not client mistakes', () => {
    const errorWithStatus = (status: number) => new AxiosError('x', 'ERR', {} as any, {}, {
      config: {} as any,
      data: {},
      headers: {},
      status,
      statusText: '',
    });

    expect(shouldRetry(errorWithStatus(429))).toBe(true);
    expect(shouldRetry(errorWithStatus(503))).toBe(true);
    expect(shouldRetry(errorWithStatus(400))).toBe(false);
    expect(shouldRetry(errorWithStatus(401))).toBe(false);
    expect(shouldRetry(errorWithStatus(404))).toBe(false);
  });

  test('retries dropped connections but never a cancelled request', () => {
    const withCode = (code: string) => {
      const err = new AxiosError('x', code);
      (err as any).request = {};
      return err;
    };

    expect(shouldRetry(withCode('ECONNRESET'))).toBe(true);
    expect(shouldRetry(withCode('ETIMEDOUT'))).toBe(true);
    expect(shouldRetry(withCode('ERR_CANCELED'))).toBe(false);
    expect(shouldRetry(new AxiosError('never sent', 'ERR_INVALID_URL'))).toBe(false);
  });

  test('honours Retry-After on 429 instead of the exponential schedule', () => {
    const throttled = new AxiosError('x', 'ERR', {} as any, {}, {
      config: {} as any,
      data: {},
      headers: { 'retry-after': '45' },
      status: 429,
      statusText: '',
    });

    expect(retryDelayFor(1, throttled)).toBe(45000);
  });

  test('caps Retry-After so a hostile header cannot stall the plugin', () => {
    const throttled = new AxiosError('x', 'ERR', {} as any, {}, {
      config: {} as any,
      data: {},
      headers: { 'retry-after': '86400' },
      status: 429,
      statusText: '',
    });

    expect(retryDelayFor(1, throttled)).toBe(MAX_RETRY_DELAY_MS);
  });

  test('backs off exponentially with jitter when no Retry-After is given', () => {
    const err = new AxiosError('x', 'ECONNRESET');

    // full-jitter: delay lands in [base/2, base]
    expect(retryDelayFor(1, err, () => 0)).toBe(1000);
    expect(retryDelayFor(1, err, () => 1)).toBe(2000);
    expect(retryDelayFor(2, err, () => 0)).toBe(2000);
    expect(retryDelayFor(3, err, () => 0)).toBe(4000);
  });

  test('spreads simultaneous retries apart so devices do not retry in lockstep', () => {
    const err = new AxiosError('x', 'ECONNRESET');
    const delays = new Set([0.1, 0.4, 0.9].map(r => retryDelayFor(2, err, () => r)));

    expect(delays.size).toBe(3);
  });
});

describe('retryAfterMs', () => {
  test('reads delay-seconds form', () => {
    expect(retryAfterMs('30')).toBe(30000);
    expect(retryAfterMs(30)).toBe(30000);
  });

  test('reads HTTP-date form relative to now', () => {
    const now = Date.parse('2026-07-28T12:00:00Z');
    expect(retryAfterMs('Tue, 28 Jul 2026 12:01:00 GMT', now)).toBe(60000);
  });

  test('never returns a negative delay for a date already in the past', () => {
    const now = Date.parse('2026-07-28T12:00:00Z');
    expect(retryAfterMs('Tue, 28 Jul 2026 11:00:00 GMT', now)).toBe(0);
  });

  test('returns null when the header is missing or unusable', () => {
    expect(retryAfterMs(undefined)).toBeNull();
    expect(retryAfterMs('')).toBeNull();
    expect(retryAfterMs('soon')).toBeNull();
  });
});
