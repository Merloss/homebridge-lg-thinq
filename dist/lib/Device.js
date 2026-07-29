import { DeviceType } from './constants.js';
export const DEVICE_ID_PATTERN = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;
/**
 * Represents a device connected to the LG ThinQ platform.
 * This class provides methods to interact with and retrieve information about the device.
 */
export class Device {
    data;
    deviceModel;
    constructor(data) {
        this.data = data;
    }
    /**
     * Gets the unique identifier for the device.
     */
    get id() {
        return this.data.deviceId;
    }
    /**
     * Gets the name of the device.
     */
    get name() {
        return this.data.alias;
    }
    /**
     * Gets the type of the device.
     */
    get type() {
        return DeviceType[this.data.deviceType];
    }
    /**
     * Gets the model information for the device.
     */
    get model() {
        const modelName = this.data.modelName || this.data.modemInfo?.modelName || this.data.manufacture?.manufactureModel || '';
        if (/^([A-Z]+)_(\d+)_([A-Z]{2})$/.test(modelName)) {
            return modelName.slice(0, -3);
        }
        return modelName;
    }
    /**
     * Gets the MAC address of the device.
     */
    get macAddress() {
        return this.data.manufacture?.macAddress;
    }
    /**
     * Gets the sales model of the device.
     */
    get salesModel() {
        return this.data.manufacture?.salesModel;
    }
    /**
     * Gets the serial number of the device.
     */
    get serialNumber() {
        return this.data.manufacture?.serialNo;
    }
    /**
     * Gets the firmware version of the device.
     */
    get firmwareVersion() {
        return this.data.modemInfo?.appVersion;
    }
    /**
     * Gets the current state snapshot of the device.
     */
    get snapshot() {
        return this.data.snapshot || null;
    }
    /**
     * Sets the current state snapshot of the device.
     */
    set snapshot(value) {
        this.data.snapshot = value;
    }
    /**
     * Gets the platform type of the device.
     */
    get platform() {
        return this.data.platformType;
    }
    /**
     * Gets the online status of the device.
     */
    get online() {
        return this.data.online !== undefined ? this.data.online : this.data.snapshot?.online;
    }
    /**
     * Returns a string representation of the device.
     */
    toString() {
        return `${this.id}: ${this.name} (${this.type} ${this.model})`;
    }
}
export function isValidDeviceId(id) {
    return typeof id === 'string' && DEVICE_ID_PATTERN.test(id);
}
export function devicesFromList(listDevices) {
    return listDevices.map(device => new Device(device))
        .filter(device => isValidDeviceId(device.id));
}
//# sourceMappingURL=Device.js.map