import { EventEmitter } from 'events';
export function isDeviceOnlineForHomeKit(device) {
    return device.online !== false;
}
export class BaseDevice extends EventEmitter {
    platform;
    accessory;
    logger;
    constructor(platform, accessory, logger) {
        super();
        this.platform = platform;
        this.accessory = accessory;
        this.logger = logger;
        const device = accessory.context.device;
        const { AccessoryInformation } = this.platform.Service;
        const serviceAccessoryInformation = accessory.getService(AccessoryInformation) || accessory.addService(AccessoryInformation);
        // set accessory information
        serviceAccessoryInformation
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'LG')
            .setCharacteristic(this.platform.Characteristic.Model, device.salesModel || device.model || 'Unknown')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.config.serial_number || device.serialNumber || 'Unknown');
    }
    updateAccessoryCharacteristic(device) {
        this.accessory.context.device = device;
    }
    update(snapshot) {
        this.platform.log.debug('[' + this.accessory.context.device.name + '] Received snapshot: ', JSON.stringify(snapshot));
        this.accessory.context.device.data.snapshot = { ...this.accessory.context.device.snapshot, ...snapshot };
        if (typeof snapshot?.online === 'boolean') {
            this.accessory.context.device.data.online = snapshot.online;
        }
        this.updateAccessoryCharacteristic(this.accessory.context.device);
    }
    get isOnlineForHomeKit() {
        return isDeviceOnlineForHomeKit(this.accessory.context.device);
    }
    deviceOfflineError() {
        return new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
    }
    requireDeviceOnline() {
        if (!this.isOnlineForHomeKit) {
            throw this.deviceOfflineError();
        }
    }
    onlineGet(getter) {
        return () => {
            this.requireDeviceOnline();
            return getter();
        };
    }
    get config() {
        return this.platform.config.devices.find((enabled) => enabled.id === this.accessory.context.device.id) || {};
    }
    static model() {
        return '';
    }
}
//# sourceMappingURL=baseDevice.js.map