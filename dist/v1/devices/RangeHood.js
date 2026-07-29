import { default as RangeHoodV2 } from '../../devices/RangeHood.js';
export default class RangeHood extends RangeHoodV2 {
    async setHoodRotationSpeed(value) {
        this.requireDeviceOnline();
        const device = this.accessory.context.device;
        await this.platform.ThinQ?.thinq1DeviceControl(device, 'VentLevel', value);
    }
    async setLightBrightness(value) {
        this.requireDeviceOnline();
        const device = this.accessory.context.device;
        await this.platform.ThinQ?.thinq1DeviceControl(device, 'LampLevel', value);
    }
}
//# sourceMappingURL=RangeHood.js.map