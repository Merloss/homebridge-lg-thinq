import { LGThinQHomebridgePlatform } from '../platform.js';
import { CharacteristicValue, Logger, PlatformAccessory, Service } from 'homebridge';
import { Device } from '../lib/Device.js';
import { AccessoryContext, BaseDevice } from '../baseDevice.js';
export declare enum RotateSpeed {
    LOW = 2,
    MEDIUM = 4,
    HIGH = 6,
    EXTRA = 7
}
export type AirQualityState = {
    isOn: boolean;
    overall: number;
    PM2: number;
    PM10: number;
};
export type AirPurifierState = {
    isPowerOn: boolean;
    isLightOn: boolean;
    isSwing: boolean;
    airQuality: AirQualityState;
    rotationSpeed: number;
    windStrength: number;
    isNormalMode: boolean;
    filterUsedTimePercent: number;
    filterMaxTime: number;
    filterUseTime: number;
    isAirFastEnable: boolean;
};
export declare function readAirPurifierState(snapshot: any): AirPurifierState;
export default class AirPurifier extends BaseDevice {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    protected serviceAirPurifier: Service | undefined;
    protected serviceAirQuality: Service;
    protected serviceLight: Service | undefined;
    protected serviceFilterMaintenance: Service | undefined;
    protected serviceAirFastMode: Service | undefined;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    get Status(): AirPurifierState;
    get config(): {
        air_fast_mode: boolean;
    } & Record<string, any>;
    setAirFastActive(value: CharacteristicValue): Promise<void>;
    setActive(value: CharacteristicValue): Promise<void>;
    setTargetAirPurifierState(value: CharacteristicValue): Promise<void>;
    setRotationSpeed(value: CharacteristicValue): Promise<void>;
    setSwingMode(value: CharacteristicValue): Promise<void>;
    setLight(value: CharacteristicValue): Promise<void>;
    updateAccessoryCharacteristic(device: Device): void;
}
export declare class AirPurifierStatus {
    private readonly state;
    constructor(data: any);
    get isPowerOn(): boolean;
    get isLightOn(): boolean;
    get isSwing(): boolean;
    get airQuality(): AirQualityState;
    get rotationSpeed(): number;
    get windStrength(): number;
    get isNormalMode(): boolean;
    get filterUsedTimePercent(): number;
    get filterMaxTime(): number;
    get filterUseTime(): number;
    get isAirFastEnable(): boolean;
}
