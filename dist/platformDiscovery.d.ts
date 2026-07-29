import type { Logging, PlatformConfig } from 'homebridge';
import type { Device } from './lib/Device.js';
import type { ThinQ } from './lib/ThinQ.js';
import type { DeviceAccessoryConstructor } from './platformAccessories.js';
export declare const DISCOVERY_RETRY_DELAY_MS = 30000;
export declare const DISCOVERY_RATE_LIMIT_DELAY_MS = 300000;
export declare const MAX_DISCOVERY_RETRY_DELAY_MS = 900000;
export type DeviceAccessoryResolver = {
    make(device: Device): DeviceAccessoryConstructor | null;
    category(device: Device): number;
};
export type DiscoveryThinQ = Pick<ThinQ, 'setup' | 'unregister'>;
export type PreparedDevice = {
    status: 'ready';
    accessoryType: DeviceAccessoryConstructor;
    category: number;
} | {
    status: 'skipped';
    reason: 'thinq1-disabled' | 'config-disabled' | 'setup-failed' | 'unsupported';
};
export declare function isRetryableDiscoveryError(err: unknown): boolean;
/**
 * Delay before the next discovery attempt. Retrying a throttled account every
 * 30s just extends the throttle, so rate limiting backs off much further and
 * honours `Retry-After` when LG provides it.
 */
export declare function discoveryRetryDelayMs(err: unknown, attempt?: number): number;
export declare function unregisterUnsupportedDevice(options: {
    log: Logging;
    thinq: DiscoveryThinQ;
    device: Device;
}): void;
export declare function prepareDiscoveredDevice(options: {
    log: Logging;
    config: PlatformConfig;
    enableThinQ1: boolean;
    thinq: DiscoveryThinQ;
    device: Device;
    accessoryResolver?: DeviceAccessoryResolver;
}): Promise<PreparedDevice>;
