import AirPurifier from './AirPurifier.js';
import { LGThinQHomebridgePlatform } from '../platform.js';
import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';
import { Device } from '../lib/Device.js';
import { AccessoryContext } from '../baseDevice.js';
export declare enum LightBrightness {
    OFF = 0,
    ON = 1,
    LEVEL_1 = 8,
    LEVEL_2 = 9,
    LEVEL_3 = 10
}
export default class AeroTower extends AirPurifier {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    protected serviceTemperatureSensor: import("homebridge").Service;
    protected serviceHumiditySensor: import("homebridge").Service;
    protected serviceUVNano: import("homebridge").Service;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    setLight(value: CharacteristicValue): Promise<void>;
    protected setUVMode(value: CharacteristicValue): Promise<void>;
    protected setLightBrightness(value: CharacteristicValue): Promise<void>;
    updateAccessoryCharacteristic(device: Device): void;
}
