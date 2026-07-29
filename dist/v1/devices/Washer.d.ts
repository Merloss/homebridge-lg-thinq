import { default as WasherV2 } from '../../devices/WasherDryer.js';
import { LGThinQHomebridgePlatform } from '../../platform.js';
import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';
import { AccessoryContext } from '../../baseDevice.js';
export default class Washer extends WasherV2 {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    setActive(value: CharacteristicValue): Promise<void>;
}
