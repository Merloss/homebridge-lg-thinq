import { LGThinQHomebridgePlatform } from '../platform.js';
import { CharacteristicValue, Logger, PlatformAccessory, Service } from 'homebridge';
import { Device } from '../lib/Device.js';
import { AccessoryContext, BaseDevice } from '../baseDevice.js';
import { DeviceModel } from '../lib/DeviceModel.js';
export type RefrigeratorRefStateValue = string | number | null | undefined;
export type RefrigeratorCommandPayload = {
    dataKey: null;
    dataValue: null;
    dataSetList: {
        refState: Record<string, RefrigeratorRefStateValue>;
    };
    dataGetList: null;
};
export declare function refrigeratorRefStateCommand(refState: Record<string, RefrigeratorRefStateValue>): RefrigeratorCommandPayload;
export declare function refrigeratorFeatureCommand(featureKey: string, value: CharacteristicValue, onValue: RefrigeratorRefStateValue, offValue: RefrigeratorRefStateValue, tempUnit: string): RefrigeratorCommandPayload;
export declare function refrigeratorTemperatureCommand(key: string, temp: string | number, tempUnit: string): RefrigeratorCommandPayload;
export default class Refrigerator extends BaseDevice {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    protected serviceFreezer: Service | undefined;
    protected serviceFridge: Service | undefined;
    protected serviceDoorOpened: Service | undefined;
    protected serviceExpressMode: Service | undefined;
    protected serviceExpressFridge: Service | undefined;
    protected serviceEcoFriendly: Service | undefined;
    protected serviceWaterFilter: Service | undefined;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    get config(): {
        ref_express_freezer: boolean;
        ref_express_fridge: boolean;
        ref_eco_friendly: boolean;
    } & Record<string, any>;
    get Status(): RefrigeratorStatus;
    /**
     * update accessory characteristic by device
     */
    updateAccessoryCharacteristic(device: Device): void;
    setExpressMode(value: CharacteristicValue): Promise<void>;
    setExpressFridge(value: CharacteristicValue): Promise<void>;
    setEcoFriendly(value: CharacteristicValue): Promise<void>;
    tempUnit(): Promise<0 | 1>;
    /**
     * create a thermostat service
     */
    protected createThermostat(name: string, key: string): Service | undefined;
    setTemperature(key: string, temp: string): Promise<void>;
}
export declare class RefrigeratorStatus {
    protected data: any;
    protected deviceModel: DeviceModel;
    constructor(data: any, deviceModel: DeviceModel);
    get freezerTemperature(): number;
    get fridgeTemperature(): number;
    get isDoorClosed(): boolean;
    get isExpressModeOn(): boolean;
    get isExpressFridgeOn(): boolean;
    get isEcoFriendlyOn(): boolean;
    get tempUnit(): string;
    get waterFilterRemain(): number;
    hasFeature(key: string): boolean;
    protected lookupTemperature(key: string, value: unknown): number;
}
