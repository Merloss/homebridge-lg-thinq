import type { EventEmitter } from 'events';
import type { Logging, PlatformAccessory } from 'homebridge';
import type { AccessoryContext } from './baseDevice.js';
import { ManualProcessNeeded } from './errors/index.js';
import type { Device } from './lib/Device.js';
import { PlatformType } from './lib/constants.js';
import type { ThinQ } from './lib/ThinQ.js';

export type MonitorInterval = ReturnType<typeof setInterval>;
export type MonitorThinQ = Pick<ThinQ, 'devices' | 'pollMonitor' | 'registerMQTTListener'>;

export function accessoriesForPlatform(
  accessories: PlatformAccessory<AccessoryContext>[],
  platform: PlatformType,
): PlatformAccessory<AccessoryContext>[] {
  return accessories.filter(accessory => accessory.context.device.platform === platform);
}

export function hasEnabledThinQ1Accessories(
  accessories: PlatformAccessory<AccessoryContext>[],
  enableThinQ1: boolean,
): boolean {
  return enableThinQ1 && accessoriesForPlatform(accessories, PlatformType.ThinQ1).length > 0;
}

export async function pollThinQ2Devices(options: {
  thinq: Pick<ThinQ, 'devices'>;
  events: EventEmitter;
}): Promise<void> {
  const { thinq, events } = options;
  const devices: Device[] = await thinq.devices();

  devices.filter(device => device.platform === PlatformType.ThinQ2).forEach(device => {
    events.emit(device.id, device.snapshot);
  });
}

export function emitThinQ2MqttUpdate(events: EventEmitter, data: unknown): void {
  if (typeof data !== 'object' || data === null || !('data' in data) || !('deviceId' in data)) {
    return;
  }

  const message = data as {
    deviceId: string;
    data?: {
      state?: {
        reported?: unknown;
      };
    };
  };

  events.emit(message.deviceId, message.data?.state?.reported);
}

export async function pollThinQ1Accessories(options: {
  thinq: Pick<ThinQ, 'pollMonitor'>;
  accessories: PlatformAccessory<AccessoryContext>[];
  events: EventEmitter;
  enableThinQ1: boolean;
  log?: Logging;
}): Promise<void> {
  const { thinq, accessories, events, enableThinQ1, log } = options;

  for (const accessory of accessories) {
    const device: Device = accessory.context.device;
    if (device.platform !== PlatformType.ThinQ1 || !enableThinQ1) {
      continue;
    }

    try {
      const deviceWithSnapshot = await thinq.pollMonitor(device);
      const snapshot = deviceWithSnapshot.snapshot;
      if (snapshot && snapshot.raw !== null) {
        events.emit(device.id, snapshot);
      }
    } catch (err) {
      // ManualProcessNeeded must reach the caller so it can stop the poll loop
      // entirely; every other device error is isolated so one unreachable
      // appliance cannot stop the rest of the account from updating.
      if (err instanceof ManualProcessNeeded) {
        throw err;
      }

      log?.debug('[' + device.name + '] ThinQ1 poll failed:', err);
    }
  }
}

export function removeMonitorInterval(
  monitorIntervals: MonitorInterval[],
  interval: MonitorInterval,
): void {
  const intervalIndex = monitorIntervals.indexOf(interval);
  if (intervalIndex >= 0) {
    monitorIntervals.splice(intervalIndex, 1);
  }
}

export function handleThinQ1PollError(options: {
  err: unknown;
  log: Logging;
  interval: MonitorInterval;
  monitorIntervals: MonitorInterval[];
}): boolean {
  const { err, log, interval, monitorIntervals } = options;

  if (!(err instanceof ManualProcessNeeded)) {
    log.debug('ThinQ1 polling failed:', err);
    return false;
  }

  log.info('Stop polling device data.');
  log.warn(err.message);
  clearInterval(interval);
  removeMonitorInterval(monitorIntervals, interval);
  return true;
}

export async function startThinQ2Monitor(options: {
  log: Logging;
  thinq: MonitorThinQ;
  events: EventEmitter;
  intervalTime: number;
  mqttFallbackIntervalTime: number;
  monitorIntervals: MonitorInterval[];
}): Promise<boolean> {
  const { log, thinq, events, intervalTime, mqttFallbackIntervalTime, monitorIntervals } = options;

  log.info('Start MQTT listener for ThinQ2 devices');
  // MQTT is registered before the poll timer so we know whether polling is the
  // primary update path or just a slow reconciliation pass. Polling at the full
  // rate on top of a working push channel is what drove accounts into HTTP 429.
  const mqttConnected = await thinq.registerMQTTListener((data) => {
    emitThinQ2MqttUpdate(events, data);
  });

  const pollInterval = mqttConnected ? mqttFallbackIntervalTime : intervalTime;

  if (mqttConnected) {
    log.debug('MQTT push is active; polling ThinQ2 devices every ' + Math.round(pollInterval / 1000) + 's as a fallback.');
  } else {
    log.warn('MQTT push channel unavailable. Falling back to polling ThinQ2 devices every '
      + Math.round(pollInterval / 1000) + 's.');
  }

  const thinq2Interval = setInterval(() => {
    pollThinQ2Devices({ thinq, events }).catch(err => {
      log.debug('ThinQ2 polling failed:', err);
    });
  }, pollInterval);
  thinq2Interval.unref?.();
  monitorIntervals.push(thinq2Interval);

  return mqttConnected;
}

export function startThinQ1Monitor(options: {
  log: Logging;
  thinq: MonitorThinQ;
  accessories: PlatformAccessory<AccessoryContext>[];
  events: EventEmitter;
  intervalTime: number;
  refreshInterval: unknown;
  enableThinQ1: boolean;
  monitorIntervals: MonitorInterval[];
}): void {
  const {
    log,
    thinq,
    accessories,
    events,
    intervalTime,
    refreshInterval,
    enableThinQ1,
    monitorIntervals,
  } = options;

  const configuredRefreshInterval = Number(refreshInterval);
  const refreshSeconds = Number.isFinite(configuredRefreshInterval) && configuredRefreshInterval > 0
    ? configuredRefreshInterval
    : intervalTime / 1000;

  log.info('Start polling device data every ' + refreshSeconds + ' seconds.');
  const interval = setInterval(async () => {
    try {
      await pollThinQ1Accessories({
        thinq,
        accessories,
        events,
        enableThinQ1,
        log,
      });
    } catch (err) {
      handleThinQ1PollError({
        err,
        log,
        interval,
        monitorIntervals,
      });
    }
  }, intervalTime);
  interval.unref?.();
  monitorIntervals.push(interval);
}

export function clearMonitorIntervals(monitorIntervals: MonitorInterval[]): void {
  while (monitorIntervals.length) {
    const interval = monitorIntervals.pop();
    if (interval) {
      clearInterval(interval);
    }
  }
}
