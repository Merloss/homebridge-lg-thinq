import { AccessoryContext, BaseDevice } from '../baseDevice.js';
import { LGThinQHomebridgePlatform } from '../platform.js';
import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';
import { Device } from '../lib/Device.js';
import { type DeviceModel } from '../lib/DeviceModel.js';
export type RangeHoodModelLookup = Pick<DeviceModel, 'lookupMonitorName'>;
export type RangeHoodState = {
    isVentOn: boolean;
    ventLevel: number;
    isLampOn: boolean;
    lampLevel: number;
};
export declare function readRangeHoodState(snapshot: any, deviceModel: RangeHoodModelLookup): RangeHoodState;
export default class RangeHood extends BaseDevice {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    protected serviceHood: import("homebridge").Service;
    protected serviceLight: import("homebridge").Service;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    setHoodActive(value: CharacteristicValue): Promise<void>;
    setHoodRotationSpeed(value: CharacteristicValue): Promise<void>;
    setLightActive(value: CharacteristicValue): Promise<void>;
    setLightBrightness(value: CharacteristicValue): Promise<void>;
    updateAccessoryCharacteristic(device: Device): void;
}
