import { AccessoryContext, BaseDevice } from '../baseDevice.js';
import { LGThinQHomebridgePlatform } from '../platform.js';
import { CharacteristicValue, Logger, PlatformAccessory, Service } from 'homebridge';
import { Device } from '../lib/Device.js';
import { type DeviceModel } from '../lib/DeviceModel.js';
export declare const NOT_RUNNING_STATUS: string[];
export type WasherDryerModelLookup = Pick<DeviceModel, 'lookupMonitorName'>;
export type WasherDryerState = {
    isPowerOn: boolean;
    isRunning: boolean;
    isError: boolean;
    isRemoteStartEnable: boolean;
    isDoorLocked: boolean;
    remainDuration: number;
    TCLCount: number;
};
export declare function readWasherDryerState(data: any, deviceModel: WasherDryerModelLookup): WasherDryerState;
export default class WasherDryer extends BaseDevice {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    isRunning: boolean;
    isServiceTubCleanMaintenanceTriggered: boolean;
    protected serviceWasherDryer: Service | undefined;
    protected serviceEventFinished: Service | undefined;
    protected serviceDoorLock: Service | undefined;
    protected serviceTubCleanMaintenance: Service | undefined;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    get Status(): WasherDryerState;
    get config(): {
        washer_trigger: boolean;
        washer_door_lock: boolean;
        washer_tub_clean: boolean;
    } & Record<string, any>;
    setActive(value: CharacteristicValue): Promise<void>;
    updateAccessoryCharacteristic(device: Device): void;
    update(snapshot: any): void;
}
export declare class WasherDryerStatus {
    data: any;
    protected deviceModel: DeviceModel;
    private readonly state;
    constructor(data: any, deviceModel: DeviceModel);
    get isPowerOn(): boolean;
    get isRunning(): boolean;
    get isError(): boolean;
    get isRemoteStartEnable(): boolean;
    get isDoorLocked(): boolean;
    get remainDuration(): number;
    get TCLCount(): number;
}
