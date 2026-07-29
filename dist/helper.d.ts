import { Categories } from 'homebridge';
import { Device } from './lib/Device.js';
import AirPurifier from './devices/AirPurifier.js';
import Refrigerator from './devices/Refrigerator.js';
import WasherDryer from './devices/WasherDryer.js';
import Dishwasher from './devices/Dishwasher.js';
import Dehumidifier from './devices/Dehumidifier.js';
import AirConditioner from './devices/AirConditioner.js';
import Styler from './devices/Styler.js';
import RangeHood from './devices/RangeHood.js';
import Oven from './devices/Oven.js';
import Microwave from './devices/Microwave.js';
import WasherDryer2 from './devices/WasherDryer2.js';
import { fToC, cToF } from './utils/temperature.js';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class Helper {
    static make(device: Device): typeof WasherDryer | typeof AirConditioner | typeof Refrigerator | typeof AirPurifier | typeof Dishwasher | typeof Dehumidifier | typeof Styler | typeof RangeHood | typeof Oven | typeof Microwave | typeof WasherDryer2 | null;
    static category(device: Device): 1 | 9 | Categories.OTHER | Categories.AIR_PURIFIER | Categories.AIR_CONDITIONER | Categories.AIR_DEHUMIDIFIER;
}
export { fToC, cToF };
export { normalizeBoolean, normalizeNumber } from './utils/normalize.js';
