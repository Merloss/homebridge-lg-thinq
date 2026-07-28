import { EventEmitter } from 'events';
import { describe, expect, jest, test } from '@jest/globals';
import { NotConnectedError } from './errors/index.js';
import { PlatformType } from './lib/constants.js';
import { LGThinQHomebridgePlatform } from './platform.js';

function fakeLog() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
  };
}

function fakeThinQ2Accessory() {
  return {
    context: {
      device: {
        id: 'device-1',
        platform: PlatformType.ThinQ2,
      },
    },
  };
}

describe('LGThinQHomebridgePlatform device discovery', () => {
  function discoveryPlatform(devices: any[], discoverDevice: (device: any) => Promise<void>) {
    const platform = Object.create(LGThinQHomebridgePlatform.prototype) as any;

    platform.accessories = [];
    platform.config = { devices: [] };
    platform.enable_thinq1 = false;
    platform.events = new EventEmitter();
    platform.deviceUpdateListeners = {};
    platform.log = { ...fakeLog(), warn: jest.fn(), error: jest.fn() };
    platform.api = {
      hap: { uuid: { generate: (v: string) => v } },
      registerPlatformAccessories: jest.fn(),
      unregisterPlatformAccessories: jest.fn(),
    };
    platform.ThinQ = { devices: jest.fn(async () => devices) };
    platform.discoverDevice = jest.fn(discoverDevice);

    return platform;
  }

  test('keeps setting up devices after one of them fails', async () => {
    const attempted: string[] = [];
    const platform = discoveryPlatform(
      [{ id: 'a', name: 'Fridge' }, { id: 'b', name: 'Vacuum' }, { id: 'c', name: 'Washer' }],
      async (device: any) => {
        attempted.push(device.id);
        if (device.id === 'b') {
          throw new TypeError('Cannot read properties of undefined');
        }
      },
    );

    await platform.discoverDevices();

    // The bad device used to abort the loop, so 'c' was never registered.
    expect(attempted).toEqual(['a', 'b', 'c']);
    expect(platform.log.error).toHaveBeenCalledWith(expect.stringContaining('Vacuum'));
    expect(platform.log.warn).toHaveBeenCalledWith(expect.stringContaining('Skipped 1 device(s)'));
  });

  test('still prunes stale accessories when a device fails', async () => {
    const platform = discoveryPlatform(
      [{ id: 'a', name: 'Fridge' }],
      async () => {
        throw new Error('setup exploded');
      },
    );
    platform.accessories = [{ UUID: 'stale-uuid', displayName: 'Gone', context: { device: { id: 'stale' } } }];

    await platform.discoverDevices();

    expect(platform.api.unregisterPlatformAccessories).toHaveBeenCalled();
  });

  test('aborts the whole round when the account itself is unreachable', async () => {
    const attempted: string[] = [];
    const platform = discoveryPlatform(
      [{ id: 'a', name: 'Fridge' }, { id: 'b', name: 'Washer' }],
      async (device: any) => {
        attempted.push(device.id);
        throw new NotConnectedError('offline');
      },
    );

    await expect(platform.discoverDevices()).rejects.toThrow(NotConnectedError);

    // No point walking the rest of the account while ThinQ is unreachable.
    expect(attempted).toEqual(['a']);
  });
});

describe('LGThinQHomebridgePlatform monitor startup', () => {
  test('clears partial monitor startup state when MQTT listener registration fails', async () => {
    const platform = Object.create(LGThinQHomebridgePlatform.prototype) as any;

    platform.accessories = [fakeThinQ2Accessory()];
    platform.config = {};
    platform.enable_thinq1 = false;
    platform.events = new EventEmitter();
    platform.intervalTime = 1000;
    platform.log = fakeLog();
    platform.monitorIntervals = [];
    platform.monitorStarted = false;
    platform.ThinQ = {
      devices: jest.fn(async () => []),
      registerMQTTListener: jest.fn(async () => {
        throw new NotConnectedError('mqtt unavailable');
      }),
    };

    await expect(platform.startMonitor()).rejects.toThrow(NotConnectedError);

    expect(platform.monitorStarted).toBe(false);
    expect(platform.monitorIntervals).toEqual([]);
  });
});
