import { AccessoryContext, BaseDevice } from '../baseDevice.js';
import { LGThinQHomebridgePlatform } from '../platform.js';
import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';
import { Device } from '../lib/Device.js';
export type DehumidifierState = {
    isPowerOn: boolean;
    opMode: number;
    windStrength: number;
    isDehumidifying: boolean;
    humidityCurrent: number;
    humidityTarget: number;
    rotationSpeed: number;
    isWaterTankFull: boolean;
};
export declare function readDehumidifierState(snapshot: any): DehumidifierState;
export default class Dehumidifier extends BaseDevice {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    protected serviceDehumidifier: import("homebridge").Service;
    protected serviceHumiditySensor: import("homebridge").Service;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    setActive(value: CharacteristicValue): Promise<void>;
    setHumidityThreshold(value: CharacteristicValue): Promise<void>;
    setSpeed(value: CharacteristicValue): Promise<void>;
    updateAccessoryCharacteristic(device: Device): void;
    get Status(): DehumidifierState;
}
export declare class DehumidifierStatus {
    private readonly state;
    constructor(data: any);
    get isPowerOn(): boolean;
    get opMode(): number;
    get windStrength(): number;
    get isDehumidifying(): boolean;
    get humidityCurrent(): number;
    get humidityTarget(): number;
    get rotationSpeed(): number;
    get isWaterTankFull(): boolean;
}
