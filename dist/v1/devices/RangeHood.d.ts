import { default as RangeHoodV2 } from '../../devices/RangeHood.js';
import { CharacteristicValue } from 'homebridge';
export default class RangeHood extends RangeHoodV2 {
    setHoodRotationSpeed(value: CharacteristicValue): Promise<void>;
    setLightBrightness(value: CharacteristicValue): Promise<void>;
}
