import type { PlatformConfig } from 'homebridge';
import type { Device } from './lib/Device.js';
type ConfiguredDevice = {
    id?: unknown;
    name?: unknown;
};
export declare function configuredDevices(config: PlatformConfig): ConfiguredDevice[];
export declare function hasRequiredThinQConfig(config: PlatformConfig): boolean;
export declare function isThinQ1Enabled(config: PlatformConfig): boolean;
/**
 * Default poll cadence. The old default was 5 seconds, which meant one
 * `getListHomes` + one request per home every 5s per account. LG answers that
 * with HTTP 429 on all but the smallest accounts, and ThinQ2 devices push their
 * state over MQTT anyway, so polling that fast bought nothing.
 */
export declare const DEFAULT_REFRESH_INTERVAL_SECONDS = 60;
/** Floor enforced regardless of config, to keep accounts out of LG's throttle. */
export declare const MIN_REFRESH_INTERVAL_SECONDS = 10;
/**
 * How often ThinQ2 devices are polled once MQTT is connected. At that point
 * polling is only a safety net for missed push messages.
 */
export declare const MQTT_FALLBACK_INTERVAL_SECONDS = 600;
export declare function refreshIntervalSeconds(config: PlatformConfig): number;
export declare function refreshIntervalMs(config: PlatformConfig): number;
/**
 * Poll cadence for ThinQ2 devices. When MQTT is live the poll is demoted to a
 * slow reconciliation pass instead of the primary update path.
 */
export declare function thinq2PollIntervalMs(config: PlatformConfig, mqttConnected: boolean): number;
export declare function isDeviceEnabled(config: PlatformConfig, device: Pick<Device, 'id'>): boolean;
export declare function configuredDeviceFor(config: PlatformConfig, device: Pick<Device, 'id'>): ConfiguredDevice | undefined;
export declare function configuredDeviceName(config: PlatformConfig, device: Pick<Device, 'id'>): string | undefined;
export declare function applyConfiguredDeviceOverrides<T extends Device>(config: PlatformConfig, device: T): T;
export {};
