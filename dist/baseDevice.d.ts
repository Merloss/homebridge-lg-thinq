import { LGThinQHomebridgePlatform } from './platform.js';
import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';
import { Device } from './lib/Device.js';
import { EventEmitter } from 'events';
export type AccessoryContext = {
    device: Device;
};
export declare function isDeviceOnlineForHomeKit(device: Pick<Device, 'online'>): boolean;
export declare class BaseDevice extends EventEmitter {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    protected readonly logger: Logger;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    updateAccessoryCharacteristic(device: Device): void;
    update(snapshot: any): void;
    protected get isOnlineForHomeKit(): boolean;
    protected deviceOfflineError(): import("homebridge").HapStatusError;
    protected requireDeviceOnline(): void;
    protected onlineGet<T extends CharacteristicValue>(getter: () => T | Promise<T>): () => T | Promise<T>;
    get config(): Record<string, any>;
    static model(): string;
}
