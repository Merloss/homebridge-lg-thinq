import WasherDryer, { WasherDryerStatus } from './WasherDryer.js';
/**
 * new kind of wash tower
 * device type: 223
 */
export default class WasherDryer2 extends WasherDryer {
    get Status() {
        return new WasherDryerStatus(this.accessory.context.device.snapshot?.washer, this.accessory.context.device.deviceModel);
    }
    update(snapshot) {
        // override washer to washerDryer
        snapshot.washerDryer = snapshot.washer;
        super.update(snapshot);
    }
}
//# sourceMappingURL=WasherDryer2.js.map