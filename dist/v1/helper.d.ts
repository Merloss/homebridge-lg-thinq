import { Device } from '../lib/Device.js';
import { DeviceModel } from '../lib/DeviceModel.js';
import { Washer, AC, Refrigerator, AirPurifier, RangeHood } from './devices/index.js';
export declare function thinq1SnapshotForDeviceType(deviceType: string, deviceModel: DeviceModel, decodedMonitor: any): Record<string, any> | {
    washerDryer: {
        state: string;
        preState: string;
        remoteStart: string;
        initialBit: string;
        childLock: string;
        TCLCount: number;
        reserveTimeHour: number;
        reserveTimeMinute: number;
        remainTimeHour: number;
        remainTimeMinute: number;
        initialTimeHour: number;
        initialTimeMinute: number;
        soilWash: string;
    };
} | {
    hoodState: {
        ventMode: string | number | null;
        error: string | number | null;
        ventLevel: number;
        lampSet: any;
        remainTimeMinute: number;
        ventSet: any;
        hoodFotaEnable: string;
        remainTimeSecond: number;
        childLock: string;
        standyMode: string;
        lampLevel: number;
        hoodState: string;
    };
} | null;
export default class Helper {
    static make(device: Device): typeof Washer | typeof AC | typeof Refrigerator | typeof AirPurifier | typeof RangeHood | null;
    /**
     * transform device from thinq1 to thinq2 compatible (with snapshot data)
     */
    static transform(device: Device, monitorData: any): Device;
    static prepareControlData(device: Device, key: string, value: unknown): any;
}
export declare function lookupEnumIndex(enumType: any, value: any): string;
export declare function lookupEnum(deviceModel: DeviceModel, decodedMonitor: any, key: any): string | number | null;
export declare const loopupEnum: typeof lookupEnum;
export { normalizeBoolean, normalizeNumber } from '../utils/normalize.js';
