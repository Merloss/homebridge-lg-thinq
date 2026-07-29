import type { WithUUID, Characteristic } from 'homebridge';
export default function TotalConsumption(DefaultCharacteristic: typeof Characteristic): WithUUID<new () => Characteristic>;
