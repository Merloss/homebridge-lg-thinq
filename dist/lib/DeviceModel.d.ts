export declare enum ValueType {
    Bit = "Bit",
    Enum = "Enum",
    Range = "Range",
    Reference = "Reference",
    StringComment = "StringComment"
}
export interface ModelDataValue {
    type: string;
    [key: string]: any;
}
export interface MonitoringValue {
    dataType: string;
    valueMapping: {
        [key: string]: {
            index: string;
            label: string;
        };
    };
}
export interface ModelData {
    Info: {
        productType: string;
        productCode: string;
        country: string;
        modelType: string;
        model: string;
        modelName: string;
        networkType: string;
        version: string;
    };
    Value: {
        [key: string]: ModelDataValue;
    };
    MonitoringValue?: {
        [key: string]: MonitoringValue;
    };
    [key: string]: any;
}
export interface BitValue {
    type: ValueType.Bit;
    options: any;
}
export interface EnumValue {
    type: ValueType.Enum;
    options: Record<string, string | number>;
}
export interface RangeValue {
    type: ValueType.Range;
    min: number;
    max: number;
    step: number;
}
export interface ReferenceValue {
    type: ValueType.Reference;
    reference: any;
}
export interface StringCommentValue {
    type: ValueType.StringComment;
    comment: string;
}
export type DeviceModelDevice = {
    id: string;
    type: string;
    data: {
        modelJsonUri: string;
    };
    deviceModel?: DeviceModel;
};
export type DeviceModelPersist = {
    getItem(key: string): Promise<any>;
    setItem(key: string, value: any): Promise<any>;
};
export type DeviceModelHttpClient = {
    get(uri: string): Promise<{
        data: any;
    }>;
};
export type DeviceModelLogger = {
    debug(...args: any[]): void;
};
export declare function selectDeviceModelData(device: Pick<DeviceModelDevice, 'type'>, deviceModel: any): any;
export declare function loadDeviceModelForDevice(options: {
    device: DeviceModelDevice;
    persist: DeviceModelPersist;
    httpClient: DeviceModelHttpClient;
    logger: DeviceModelLogger;
}): Promise<DeviceModel>;
/**
 * Represents the model of a device, including its metadata, values, and monitoring data.
 * This class provides methods to retrieve and decode device-specific information.
 */
export declare class DeviceModel {
    data: ModelData;
    /**
     * Creates a new `DeviceModel` instance.
     *
     * @param data - The raw model data for the device.
     */
    constructor(data: ModelData);
    /**
     * Retrieves the monitoring values defined in the device model.
     */
    get monitoringValue(): {
        [key: string]: MonitoringValue;
    } | undefined;
    /**
     * Retrieves the value definition for a given key in the device model.
     * Supports ThinQ2 protocol mappings for monitoring values.
     *
     * @param name - The key to retrieve the value definition for.
     * @returns The value definition or `null` if not found.
     */
    value(name: string): BitValue | EnumValue | RangeValue | ReferenceValue | StringCommentValue | null;
    /**
     * Retrieves the default value for a given key in the device model.
     *
     * @param name - The key to retrieve the default value for.
     * @returns The default value or `undefined` if not found.
     */
    default(name: string): any;
    /**
     * Retrieves the enum value for a given key and name.
     *
     * @param key - The key to retrieve the enum value for.
     * @param name - The name of the enum **value**.
     * @returns The enum value or `undefined` if not found.
     */
    enumValue(key: string, name: string): string | null;
    /**
     * Retrieves the enum name for a given key and value.
     *
     * @param key - The key to retrieve the enum name for.
     * @param value - The value of the enum.
     * @returns The enum name or `null` if not found.
     */
    enumName(key: string, value: string): string | number | null;
    /**
     * Retrieves the monitoring value mapping for a given key.
     *
     * @param key - The key to retrieve the monitoring value mapping for.
     * @returns The monitoring value mapping or `null` if not found.
     */
    monitoringValueMapping(key: string): {
        [key: string]: {
            index: string;
            label: string;
        };
    } | null;
    /**
     * Looks up a monitor value based on a given key and name, with an optional default value.
     *
     * @param key - The key used to identify the monitoring value mapping.
     * @param name - The name of the specific value to look up within the mapping.
     * @param default_value - An optional default value to return if the lookup fails. Defaults to `null`.
     * @returns The label of the monitoring value if found, or the `default_value` if not found.
     */
    lookupMonitorValue(key: string, name: string): string | number | null;
    /**
     * Looks up a monitor value based on a given key and name, with an optional default value.
     *
     * @param key - The key used to identify the monitoring value mapping.
     * @param name - The name of the specific value to look up within the mapping.
     * @param default_value - An optional default value to return if the lookup fails. Defaults to `null`.
     * @returns The label of the monitoring value if found, or the `default_value` if not found.
     */
    lookupMonitorValue2(key: string, name: string, default_value: string): string | number;
    /**
     * Looks up a monitor name based on a given key and label.
     *
     * @param key - The key used to identify the monitoring value mapping.
     * @param label - The label of the specific value to look up within the mapping.
     * @returns The name of the monitoring value if found, or `null` if not found.
     */
    lookupMonitorName(key: string, label: string): string | null;
    /**
     * Decodes the monitoring data for the device.
     *
     * @param data - The raw monitoring data to decode.
     * @returns The decoded monitoring data.
     */
    decodeMonitor(data: any): any;
    /**
     * Decodes binary monitoring data for the device.
     *
     * @param data - The raw binary monitoring data to decode.
     * @param length - The length of each binary segment (default: 8).
     * @returns The decoded monitoring data.
     */
    private decodeMonitorBinary;
}
