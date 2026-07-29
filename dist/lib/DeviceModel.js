import { DeviceType } from './constants.js';
export var ValueType;
(function (ValueType) {
    ValueType["Bit"] = "Bit";
    ValueType["Enum"] = "Enum";
    ValueType["Range"] = "Range";
    ValueType["Reference"] = "Reference";
    ValueType["StringComment"] = "StringComment";
})(ValueType || (ValueType = {}));
export function selectDeviceModelData(device, deviceModel) {
    const modelVersion = parseFloat(deviceModel.Info?.version);
    if (device.type === DeviceType[DeviceType.WASH_TOWER_2]
        && modelVersion && modelVersion >= 3
        && deviceModel.Info?.defaultTargetDeviceRoot
        && deviceModel[deviceModel.Info.defaultTargetDeviceRoot]) {
        return deviceModel[deviceModel.Info.defaultTargetDeviceRoot];
    }
    return deviceModel;
}
export async function loadDeviceModelForDevice(options) {
    const { device, persist, httpClient, logger } = options;
    let deviceModel = await persist.getItem(device.id);
    if (!deviceModel) {
        logger.debug('[' + device.id + '] Device model cache missed.');
        deviceModel = await httpClient.get(device.data.modelJsonUri).then(res => res.data);
        await persist.setItem(device.id, deviceModel);
    }
    const model = new DeviceModel(selectDeviceModelData(device, deviceModel));
    device.deviceModel = model;
    return model;
}
/**
 * Represents the model of a device, including its metadata, values, and monitoring data.
 * This class provides methods to retrieve and decode device-specific information.
 */
export class DeviceModel {
    data;
    /**
     * Creates a new `DeviceModel` instance.
     *
     * @param data - The raw model data for the device.
     */
    constructor(data) {
        this.data = data;
    }
    /**
     * Retrieves the monitoring values defined in the device model.
     */
    get monitoringValue() {
        return this.data.MonitoringValue;
    }
    /**
     * Retrieves the value definition for a given key in the device model.
     * Supports ThinQ2 protocol mappings for monitoring values.
     *
     * @param name - The key to retrieve the value definition for.
     * @returns The value definition or `null` if not found.
     */
    value(name) {
        if (this.data.Value === undefined) {
            return null;
        }
        let data = this.data.Value[name];
        // Handle ThinQ2 protocol mappings
        if (data === undefined && this.data.Monitoring?.type === 'THINQ2') {
            const protocol = this.data.Monitoring?.protocol;
            /**
             * sample: "protocol": {
             * 			"state": "State",
             * 			"process": "Process",
             * 			"error": "Error",
             * 			"initialTimeHour": "Initial_Time_H",
             * 			"initialTimeMinute": "Initial_Time_M",
             * 			"course": "Course",
             * 			"courseType": "CourseType",
             * 			"remainTimeHour": "Remain_Time_H",
             * 			"remainTimeMinute": "Remain_Time_M",
             * 			"reserveTimeHour": "Reserve_Time_H",
             * 			"reserveTimeMinute": "Reserve_Time_M",
             * 			"childLock": "ChildLock",
             * 			"door": "Door",
             * 			"rinseRefill": "RinseRefill",
             * 			"saltRefill": "SaltRefill",
             * 			"signalLevel": "SignalLevel",
             * 			"mcReminderSetting": "MCReminderSetting",
             * 			"cleanLReminder": "CleanLReminder",
             * 			"nightDry": "NightDry",
             * 			"delayStart": "DelayStart",
             * 			"energySaver": "EnergySaver",
             * 			"extraDry": "ExtraDry",
             * 			"highTemp": "HighTemp",
             * 			"dualZone": "DualZone",
             * 			"halfLoad": "HalfLoad",
             * 			"autoDoor": "AutoDoor",
             * 			"preSteam": "PreSteam",
             * 			"steam": "Steam",
             * 			"rinseLevel": "RinseLevel",
             * 			"softeningLevel": "SofteningLevel",
             * 			"smartCourse": "SmartCourse",
             * 			"currentDownloadCourse": "CurrentDownloadCourse",
             * 			"tclCount": "TclCount"
             * 		}
             */
            if (protocol.constructor.name === 'Object' && protocol[name] !== undefined) {
                data = this.data.Value[this.data.Monitoring?.protocol[name]];
                /**
                 * sample: "protocol": [{
                 * 				"_comment": "Hood Operation State(1byte)",
                 * 				"superSet": "hoodState.hoodState",
                 * 				"value": "HoodState"
                 * 			},
                 *      {
                 * 				"_comment": "VentState",
                 * 				"superSet": "hoodState.ventLevel",
                 * 				"value": "VentLevel"
                 * 			},
                 *      {
                 * 				"_comment": "VentMode",
                 * 				"superSet": "hoodState.ventMode",
                 * 				"value": "VentMode"
                 * 			},
                 *      {
                 * 				"_comment": "TimerMin",
                 * 				"superSet": "hoodState.remainTimeMinute",
                 * 				"value": "TimerMin"
                 * 			},
                 *      {
                 * 				"_comment": "TimerSec",
                 * 				"superSet": "hoodState.remainTimeSecond",
                 * 				"value": "TimerSec"
                 * 			},
                 *      {
                 * 				"_comment": "LightState",
                 * 				"superSet": "hoodState.lampLevel",
                 * 				"value": "LampLevel"
                 * 			},
                 *      {
                 * 				"_comment": "Dummy-meaningless",
                 * 				"superSet": "hoodState.dummyData",
                 * 				"value": "Dummy"
                 * 			},
                 *      {
                 * 				"_comment": "HoodStateInfo",
                 * 				"superSet": null,
                 * 				"value": "HoodStateInfo"
                 * 			},
                 *      {
                 * 				"_comment": "WiFi Access Enable",
                 * 				"superSet": null,
                 * 				"value": "WiFiAccess"
                 * 			}
                 *    ]
                 */
            }
            else if (protocol.constructor.name === 'Array' && protocol.find((p) => p.superSet === name) !== undefined) {
                data = this.data.Value[protocol.find((p) => p.superSet === name).value];
            }
        }
        if (data === undefined) {
            return null;
        }
        // Determine the type of the value and return the appropriate structure
        const type = data.type || data.data_type;
        switch (type.toLowerCase()) {
            case 'enum':
                return {
                    type: ValueType.Enum,
                    options: data.option || data.value_mapping,
                };
            case 'range':
                return {
                    type: ValueType.Range,
                    min: (data.option || data.value_validation)?.min,
                    max: (data.option || data.value_validation)?.max,
                    step: (data.option || data.value_validation)?.step || 1,
                };
            case 'bit': {
                const bitValues = Object.values(data.option).reduce((obj, value) => ({
                    ...obj,
                    [value.startbit]: value.values,
                }), {});
                return { type: ValueType.Bit, options: bitValues };
            }
            case 'reference': {
                const [ref] = data.option;
                return { type: ValueType.Reference, reference: this.data[ref] };
            }
            case 'string':
                if (typeof data._comment === 'string') {
                    return { type: ValueType.StringComment, comment: data._comment };
                }
                return null;
            default:
                throw new Error(`Unsupported value type: ${data.type}`);
        }
    }
    /**
     * Retrieves the default value for a given key in the device model.
     *
     * @param name - The key to retrieve the default value for.
     * @returns The default value or `undefined` if not found.
     */
    default(name) {
        return this.data?.Value[name]?.default;
    }
    /**
     * Retrieves the enum value for a given key and name.
     *
     * @param key - The key to retrieve the enum value for.
     * @param name - The name of the enum **value**.
     * @returns The enum value or `undefined` if not found.
     */
    enumValue(key, name) {
        const value = this.value(key);
        if (value?.type !== ValueType.Enum) {
            return null;
        }
        const options = value.options;
        // getting the key where value is equal to name
        const keyByValue = Object.keys(options).find(k => options[k] === name);
        return keyByValue || null;
    }
    /**
     * Retrieves the enum name for a given key and value.
     *
     * @param key - The key to retrieve the enum name for.
     * @param value - The value of the enum.
     * @returns The enum name or `null` if not found.
     */
    enumName(key, value) {
        if (this.value(key)?.type !== ValueType.Enum) {
            return null;
        }
        const options = this.value(key).options;
        return options[value] || null;
    }
    /**
     * Retrieves the monitoring value mapping for a given key.
     *
     * @param key - The key to retrieve the monitoring value mapping for.
     * @returns The monitoring value mapping or `null` if not found.
     */
    monitoringValueMapping(key) {
        if (this.monitoringValue === undefined || !(key in this.monitoringValue)) {
            return null;
        }
        return this.monitoringValue[key].valueMapping || null;
    }
    /**
     * Looks up a monitor value based on a given key and name, with an optional default value.
     *
     * @param key - The key used to identify the monitoring value mapping.
     * @param name - The name of the specific value to look up within the mapping.
     * @param default_value - An optional default value to return if the lookup fails. Defaults to `null`.
     * @returns The label of the monitoring value if found, or the `default_value` if not found.
     */
    lookupMonitorValue(key, name) {
        if (this.data.Value) {
            return this.enumName(key, name);
        }
        const monitoringValue = this.monitoringValueMapping(key);
        if (monitoringValue === null || !(name in monitoringValue)) {
            return null;
        }
        return monitoringValue[name].label || null;
    }
    /**
     * Looks up a monitor value based on a given key and name, with an optional default value.
     *
     * @param key - The key used to identify the monitoring value mapping.
     * @param name - The name of the specific value to look up within the mapping.
     * @param default_value - An optional default value to return if the lookup fails. Defaults to `null`.
     * @returns The label of the monitoring value if found, or the `default_value` if not found.
     */
    lookupMonitorValue2(key, name, default_value) {
        if (this.data.Value) {
            return this.enumName(key, name) || default_value;
        }
        const monitoringValue = this.monitoringValueMapping(key);
        if (monitoringValue === null || !(name in monitoringValue)) {
            return default_value;
        }
        return monitoringValue[name].label || default_value;
    }
    /**
     * Looks up a monitor name based on a given key and label.
     *
     * @param key - The key used to identify the monitoring value mapping.
     * @param label - The label of the specific value to look up within the mapping.
     * @returns The name of the monitoring value if found, or `null` if not found.
     */
    lookupMonitorName(key, label) {
        if (this.data.Value) {
            return this.enumValue(key, label);
        }
        if (this.monitoringValue === undefined || !(key in this.monitoringValue)) {
            return null;
        }
        const getKeyByValue = (obj, value) => Object.keys(obj).find(k => obj[k].label === value);
        return getKeyByValue(this.monitoringValue[key].valueMapping, label) || null;
    }
    /**
     * Decodes the monitoring data for the device.
     *
     * @param data - The raw monitoring data to decode.
     * @returns The decoded monitoring data.
     */
    decodeMonitor(data) {
        if (this.data.Monitoring?.type === 'BINARY(BYTE)') {
            return this.decodeMonitorBinary(data);
        }
        else if (this.data.Monitoring?.type === 'BINARY(HEX)') {
            return this.decodeMonitorBinary(data, 16);
        }
        try {
            return JSON.parse(data.toString());
        }
        catch (err) {
            return data;
        }
    }
    /**
     * Decodes binary monitoring data for the device.
     *
     * @param data - The raw binary monitoring data to decode.
     * @param length - The length of each binary segment (default: 8).
     * @returns The decoded monitoring data.
     */
    decodeMonitorBinary(data, length = 8) {
        const decoded = {};
        for (const item of this.data.Monitoring.protocol) {
            const key = item.value;
            let value = 0;
            // Decode binary data segment by segment
            for (let i = item.startByte; i < item.startByte + item.length; i++) {
                const v = data[i];
                value = (value << length) + v;
                decoded[key] = isNaN(value) ? null : String(value);
            }
        }
        return decoded;
    }
}
//# sourceMappingURL=DeviceModel.js.map