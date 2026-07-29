import { DeviceModel } from '../../lib/DeviceModel.js';
export default function HoodState(deviceModel: DeviceModel, decodedMonitor: any): {
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
};
