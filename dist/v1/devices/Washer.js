import { default as WasherV2 } from '../../devices/WasherDryer.js';
export default class Washer extends WasherV2 {
    platform;
    accessory;
    constructor(platform, accessory, logger) {
        super(platform, accessory, logger);
        this.platform = platform;
        this.accessory = accessory;
        const { Characteristic, } = this.platform;
        this.serviceWasherDryer?.getCharacteristic(Characteristic.Active).setProps({
            perms: [
                "pr" /* Perms.PAIRED_READ */,
                "ev" /* Perms.NOTIFY */,
                "pw" /* Perms.PAIRED_WRITE */,
            ],
        });
    }
    async setActive(value) {
        this.requireDeviceOnline();
        const device = this.accessory.context.device;
        await this.platform.ThinQ?.thinq1DeviceControl(device, 'Power', value ? 'On' : 'Off');
    }
}
//# sourceMappingURL=Washer.js.map