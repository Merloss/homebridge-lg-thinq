import { DeviceModel } from './DeviceModel.js';
export declare const DEVICE_ID_PATTERN: RegExp;
export interface DeviceData {
    deviceId: string;
    alias: string;
    modelJsonUri: string;
    deviceType: number;
    modelName?: string;
    manufacture?: {
        macAddress?: string;
        salesModel?: string;
        serialNo?: string;
        manufactureModel?: string;
    };
    modemInfo?: {
        appVersion?: string;
        modelName?: string;
    };
    snapshot: {
        online?: boolean;
    } & Record<string, any>;
    platformType?: string;
    online?: boolean;
}
/**
 * Represents a device connected to the LG ThinQ platform.
 * This class provides methods to interact with and retrieve information about the device.
 */
export declare class Device {
    data: DeviceData;
    deviceModel: DeviceModel;
    constructor(data: DeviceData);
    /**
     * Gets the unique identifier for the device.
     */
    get id(): string;
    /**
     * Gets the name of the device.
     */
    get name(): string;
    /**
     * Gets the type of the device.
     */
    get type(): string;
    /**
     * Gets the model information for the device.
     */
    get model(): string;
    /**
     * Gets the MAC address of the device.
     */
    get macAddress(): string | undefined;
    /**
     * Gets the sales model of the device.
     */
    get salesModel(): string | undefined;
    /**
     * Gets the serial number of the device.
     */
    get serialNumber(): string | undefined;
    /**
     * Gets the firmware version of the device.
     */
    get firmwareVersion(): string | undefined;
    /**
     * Gets the current state snapshot of the device.
     */
    get snapshot(): {
        online?: boolean;
    } & Record<string, any>;
    /**
     * Sets the current state snapshot of the device.
     */
    set snapshot(value: {
        online?: boolean;
    } & Record<string, any>);
    /**
     * Gets the platform type of the device.
     */
    get platform(): string | undefined;
    /**
     * Gets the online status of the device.
     */
    get online(): boolean | undefined;
    /**
     * Returns a string representation of the device.
     */
    toString(): string;
}
export declare function isValidDeviceId(id: unknown): id is string;
export declare function devicesFromList(listDevices: unknown[]): Device[];
