import { default as RefrigeratorV2, RefrigeratorStatus } from '../../devices/Refrigerator.js';
import { CharacteristicValue } from 'homebridge';
export default class Refrigerator extends RefrigeratorV2 {
    protected createThermostat(name: string, key: string): import("homebridge").Service | undefined;
    setTemperature(key: string, temp: string): Promise<void>;
    setExpressMode(value: CharacteristicValue): Promise<void>;
    setExpressFridge(value: CharacteristicValue): Promise<void>;
    setEcoFriendly(value: CharacteristicValue): Promise<void>;
    get Status(): Status;
}
export declare class Status extends RefrigeratorStatus {
    get freezerTemperature(): number;
    get fridgeTemperature(): number;
    get isExpressFridgeOn(): boolean;
    get isExpressModeOn(): boolean;
    get isEcoFriendlyOn(): boolean;
}
