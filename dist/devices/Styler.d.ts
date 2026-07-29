import { AccessoryContext, BaseDevice } from '../baseDevice.js';
import { LGThinQHomebridgePlatform } from '../platform.js';
import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';
import { Device } from '../lib/Device.js';
import { type DeviceModel } from '../lib/DeviceModel.js';
export declare const NOT_RUNNING_STATUS: string[];
export type StylerModelLookup = Pick<DeviceModel, 'lookupMonitorName'>;
export type StylerState = {
    isPowerOn: boolean;
    isRemoteStartOn: boolean;
    isRunning: boolean;
    isError: boolean;
    remainDuration: number;
};
export declare function readStylerState(data: any, deviceModel: StylerModelLookup): StylerState;
export default class Styler extends BaseDevice {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    protected serviceStyter: import("homebridge").Service;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    updateAccessoryCharacteristic(device: Device): void;
    setActive(value: CharacteristicValue): Promise<void>;
    get Status(): StylerState;
}
