/* eslint-disable dot-notation */
import { API } from './API.js';
import { NotConnectedError, RateLimitError } from '../errors/index.js';
import { Logger } from 'homebridge';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

describe('API', () => {
  let api: API;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    api = new API('EC', 'en-US', mockLogger);
  });

  // `httpClient` is the shared requestClient singleton, so spies installed on it
  // survive across tests and their call counts accumulate unless restored.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should initialize with default values', () => {
    expect(api).toBeDefined();
    expect(api.client_id).toBeUndefined();
    expect(api.httpClient).toBeDefined();
  });

  test('can be constructed by JavaScript callers without a logger', async () => {
    const apiWithoutLogger = new API('US', 'en-US');

    await expect(apiWithoutLogger.getRequest('')).rejects.toThrow('Invalid URI');
  });

  test('should set username and password', () => {
    api.setUsernamePassword('testUser', 'testPass');
    expect(api['username']).toBe('testUser');
    expect(api['password']).toBe('testPass');
  });

  test('should set refresh token', () => {
    api.setRefreshToken('testRefreshToken');
    expect(api['session'].refreshToken).toBe('testRefreshToken');
  });

  test('should handle device list retrieval', async () => {
    const mockHomes = [{ homeId: 'home1' }];
    const mockDevices = [{ id: 'device1' }, { id: 'device2' }];

    jest.spyOn(api, 'getListHomes').mockResolvedValueOnce(mockHomes);
    jest.spyOn(api.httpClient, 'request').mockResolvedValueOnce({
      data: { result: { devices: mockDevices } },
    });

    const devices = await api.getListDevices();
    expect(devices).toEqual(mockDevices);
  });

  test('propagates not-connected request failures', async () => {
    api['_gateway'] = {
      thinq1_url: '',
      thinq2_url: 'https://example.com/',
    } as any;
    jest.spyOn(api.httpClient, 'request').mockRejectedValueOnce(new NotConnectedError('offline'));

    await expect(api.getRequest('service/homes')).rejects.toThrow(NotConnectedError);
  });

  test('fails the round rather than reporting a home it cannot read as empty', async () => {
    // request() returns {} for handled failures. Returning the devices it did
    // manage to read would tell discovery the other home's appliances are gone,
    // and discovery deletes accessories it no longer sees.
    jest.spyOn(api, 'getListHomes').mockResolvedValueOnce([{ homeId: 'broken' }, { homeId: 'good' }]);
    jest.spyOn(api.httpClient, 'request')
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { result: { devices: [{ id: 'device1' }] } } });

    await expect(api.getListDevices()).rejects.toThrow(NotConnectedError);
  });

  test('reports an unreadable home list as a failure, and does not cache it', async () => {
    const request = jest.spyOn(api.httpClient, 'request')
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { result: { item: [{ homeId: 'home1' }] } } });
    api['_gateway'] = { thinq1_url: '', thinq2_url: 'https://example.com/' } as any;

    await expect(api.getListHomes()).rejects.toThrow(NotConnectedError);
    // A transient failure must not leave the account permanently "home-less".
    await expect(api.getListHomes()).resolves.toEqual([{ homeId: 'home1' }]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  test('caches a successful home lookup', async () => {
    const request = jest.spyOn(api.httpClient, 'request')
      .mockResolvedValue({ data: { result: { item: [{ homeId: 'home1' }] } } });
    api['_gateway'] = { thinq1_url: '', thinq2_url: 'https://example.com/' } as any;

    await api.getListHomes();
    await api.getListHomes();

    expect(request).toHaveBeenCalledTimes(1);
  });

  test('propagates rate limiting instead of swallowing it', async () => {
    api['_gateway'] = { thinq1_url: '', thinq2_url: 'https://example.com/' } as any;
    jest.spyOn(api.httpClient, 'request').mockRejectedValueOnce(new RateLimitError('slow down', 60000));

    await expect(api.getRequest('service/homes')).rejects.toThrow(RateLimitError);
  });

  test('should send command to device', async () => {
    const mockRequest = jest.spyOn(api.httpClient, 'request').mockResolvedValueOnce({ data: { success: true } });

    const result = await api.sendCommandToDevice('device1', { key: 'value' }, 'Set');
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'post',
        url: expect.stringContaining('/devices/device1/control-sync'),
        data: expect.objectContaining({
          ctrlKey: 'basicCtrl',
          command: 'Set',
          key: 'value',
        }),
      }),
    );
    expect(result).toEqual({ success: true });
  });
});
