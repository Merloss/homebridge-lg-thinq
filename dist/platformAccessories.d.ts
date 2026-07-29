import type { API, Logging, PlatformAccessory } from 'homebridge';
import type { EventEmitter } from 'events';
import type { AccessoryContext, BaseDevice } from './baseDevice.js';
import type { Device } from './lib/Device.js';
import type { LGThinQHomebridgePlatform } from './platform.js';
import { DeviceUpdateListenerMap } from './platformEvents.js';
export type DeviceAccessoryConstructor = new (platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, log: Logging) => BaseDevice;
export declare function pendingAccessoryIds(accessories: PlatformAccessory<AccessoryContext>[]): Set<string>;
export declare function markAccessorySeen(pendingIds: Set<string>, deviceId: string): void;
export declare function findAccessoryForDevice(accessories: PlatformAccessory<AccessoryContext>[], device: Pick<Device, 'id'>): PlatformAccessory<AccessoryContext> | undefined;
export declare function updateAccessoryDisplayName(options: {
    api: API;
    log: Logging;
    accessory: PlatformAccessory<AccessoryContext>;
    name: string;
}): boolean;
export declare function createOrRestoreDeviceAccessory(options: {
    platform: LGThinQHomebridgePlatform;
    api: API;
    log: Logging;
    accessories: PlatformAccessory<AccessoryContext>[];
    pendingIds: Set<string>;
    device: Device;
    accessoryType: DeviceAccessoryConstructor;
    category: number;
}): BaseDevice;
export declare function staleAccessories(accessories: PlatformAccessory<AccessoryContext>[], pendingIds: Set<string>): PlatformAccessory<AccessoryContext>[];
export declare function removeStaleAccessories(options: {
    api: API;
    log: Logging;
    accessories: PlatformAccessory<AccessoryContext>[];
    events: EventEmitter;
    listeners: DeviceUpdateListenerMap;
    pendingIds: Set<string>;
}): PlatformAccessory<AccessoryContext>[];
