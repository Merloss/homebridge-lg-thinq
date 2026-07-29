import { default as AirConditioner } from '../../devices/AirConditioner.js';
import { CharacteristicValue } from 'homebridge';
export default class AC extends AirConditioner {
    protected createHeaterCoolerService(): void;
    setFanState(value: CharacteristicValue): Promise<void>;
    setJetModeActive(value: CharacteristicValue): Promise<void>;
    setActive(value: CharacteristicValue): Promise<void>;
    setTargetTemperature(value: CharacteristicValue): Promise<void>;
    setFanSpeed(value: CharacteristicValue): Promise<void>;
    setSwingMode(value: CharacteristicValue): Promise<void>;
    setOpMode(deviceId: string, opMode: number): Promise<boolean>;
    setLight(value: CharacteristicValue): Promise<void>;
}
