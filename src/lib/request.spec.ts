import { describe, test, expect, afterEach, jest } from '@jest/globals';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MonitorError, NotConnectedError } from '../errors/index.js';
import { requestClient, requestSemaphore } from './request.js';

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
});
