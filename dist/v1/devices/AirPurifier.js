import { default as V2, RotateSpeed } from '../../devices/AirPurifier.js';
export default class AirPurifier extends V2 {
    platform;
    accessory;
    constructor(platform, accessory, logger) {
        super(platform, accessory, logger);
        this.platform = platform;
        this.accessory = accessory;
    }
    async setActive(value) {
        this.requireDeviceOnline();
        const device = this.accessory.context.device;
        await this.platform.ThinQ?.thinq1DeviceControl(device, 'Operation', value ? '1' : '0');
    }
    async setTargetAirPurifierState(value) {
        this.requireDeviceOnline();
        const device = this.accessory.context.device;
        if (!this.Status.isPowerOn || (!!value !== this.Status.isNormalMode)) {
            return; // just skip it
        }
        await this.platform.ThinQ?.thinq1DeviceControl(device, 'OpMode', value ? '16' : '14');
    }
    async setRotationSpeed(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn || !this.Status.isNormalMode) {
            return;
        }
        const device = this.accessory.context.device;
        const values = Object.keys(RotateSpeed);
        const windStrength = parseInt(values[Math.round(value) - 1]) || RotateSpeed.EXTRA;
        await this.platform.ThinQ?.thinq1DeviceControl(device, 'WindStrength', windStrength.toString());
    }
    async setSwingMode(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn || !this.Status.isNormalMode) {
            return;
        }
        const device = this.accessory.context.device;
        await this.platform.ThinQ?.thinq1DeviceControl(device, 'CirculateDir', value ? '1' : '0');
    }
    async setLight(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn) {
            return;
        }
        const device = this.accessory.context.device;
        await this.platform.ThinQ?.thinq1DeviceControl(device, 'SignalLighting', value ? '1' : '0');
    }
    async setAirFastActive(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn) {
            return;
        }
        const device = this.accessory.context.device;
        await this.platform.ThinQ?.thinq1DeviceControl(device, 'AirFast', value ? '1' : '0');
    }
}
//# sourceMappingURL=AirPurifier.js.map