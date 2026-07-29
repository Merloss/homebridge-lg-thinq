import { DeviceModel } from './DeviceModel.js';
export type CommandPayload = Record<string, any>;
export declare function coerceModelValue(model: DeviceModel | undefined, key: string, value: any): any;
export declare function coerceDataSetList(dataSetList: any, model: DeviceModel | undefined): void;
export declare function normalizeBooleanValues(value: any): void;
export declare function coerceCommandPayload(values: CommandPayload, model: DeviceModel | undefined): void;
