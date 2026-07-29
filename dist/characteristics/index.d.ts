import type { Characteristic as CharacteristicType, WithUUID } from 'homebridge';
export default function characteristic(Characteristic: typeof CharacteristicType): Record<'TotalConsumption', WithUUID<new () => CharacteristicType>>;
