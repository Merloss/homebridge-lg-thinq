import { default as V2 } from '../../devices/AirPurifier.js';
import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';
import { LGThinQHomebridgePlatform } from '../../platform.js';
import { AccessoryContext } from '../../baseDevice.js';
export default class AirPurifier extends V2 {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    setActive(value: CharacteristicValue): Promise<void>;
    setTargetAirPurifierState(value: CharacteristicValue): Promise<void>;
    setRotationSpeed(value: CharacteristicValue): Promise<void>;
    setSwingMode(value: CharacteristicValue): Promise<void>;
    setLight(value: CharacteristicValue): Promise<void>;
    setAirFastActive(value: CharacteristicValue): Promise<void>;
}
