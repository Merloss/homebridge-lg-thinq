import type { PlatformConfig } from 'homebridge';
import type { Device } from './lib/Device.js';

type ConfiguredDevice = {
  id?: unknown;
  name?: unknown;
};

export function configuredDevices(config: PlatformConfig): ConfiguredDevice[] {
  return Array.isArray(config.devices) ? config.devices as ConfiguredDevice[] : [];
}

export function hasRequiredThinQConfig(config: PlatformConfig): boolean {
  const hasCredentials = Boolean(config.username && config.password);
  return Boolean(config.country && config.language && (hasCredentials || config.refresh_token));
}

export function isThinQ1Enabled(config: PlatformConfig): boolean {
  return config.thinq1 === true;
}

/**
 * Default poll cadence. The old default was 5 seconds, which meant one
 * `getListHomes` + one request per home every 5s per account. LG answers that
 * with HTTP 429 on all but the smallest accounts, and ThinQ2 devices push their
 * state over MQTT anyway, so polling that fast bought nothing.
 */
export const DEFAULT_REFRESH_INTERVAL_SECONDS = 60;

/** Floor enforced regardless of config, to keep accounts out of LG's throttle. */
export const MIN_REFRESH_INTERVAL_SECONDS = 10;

/**
 * How often ThinQ2 devices are polled once MQTT is connected. At that point
 * polling is only a safety net for missed push messages.
 */
export const MQTT_FALLBACK_INTERVAL_SECONDS = 600;

export function refreshIntervalSeconds(config: PlatformConfig): number {
  const seconds = Number(config.refresh_interval ?? DEFAULT_REFRESH_INTERVAL_SECONDS);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_REFRESH_INTERVAL_SECONDS;
  }

  return Math.max(MIN_REFRESH_INTERVAL_SECONDS, seconds);
}

export function refreshIntervalMs(config: PlatformConfig): number {
  return refreshIntervalSeconds(config) * 1000;
}

/**
 * Poll cadence for ThinQ2 devices. When MQTT is live the poll is demoted to a
 * slow reconciliation pass instead of the primary update path.
 */
export function thinq2PollIntervalMs(config: PlatformConfig, mqttConnected: boolean): number {
  const configured = refreshIntervalMs(config);

  if (!mqttConnected) {
    return configured;
  }

  return Math.max(configured, MQTT_FALLBACK_INTERVAL_SECONDS * 1000);
}

export function isDeviceEnabled(config: PlatformConfig, device: Pick<Device, 'id'>): boolean {
  const devices = configuredDevices(config);
  return devices.length === 0 || devices.some(enabled => enabled.id === device.id);
}

export function configuredDeviceFor(config: PlatformConfig, device: Pick<Device, 'id'>): ConfiguredDevice | undefined {
  return configuredDevices(config).find(enabled => enabled.id === device.id);
}

export function configuredDeviceName(config: PlatformConfig, device: Pick<Device, 'id'>): string | undefined {
  const name = configuredDeviceFor(config, device)?.name;

  if (typeof name !== 'string') {
    return undefined;
  }

  const trimmedName = name.trim();
  return trimmedName || undefined;
}

export function applyConfiguredDeviceOverrides<T extends Device>(config: PlatformConfig, device: T): T {
  const name = configuredDeviceName(config, device);

  if (name) {
    device.data.alias = name;
  }

  return device;
}
