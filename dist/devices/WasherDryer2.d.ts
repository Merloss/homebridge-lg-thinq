import WasherDryer, { WasherDryerStatus } from './WasherDryer.js';
/**
 * new kind of wash tower
 * device type: 223
 */
export default class WasherDryer2 extends WasherDryer {
    get Status(): WasherDryerStatus;
    update(snapshot: any): void;
}
