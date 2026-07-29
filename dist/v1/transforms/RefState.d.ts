import { DeviceModel } from '../../lib/DeviceModel.js';
export declare enum DoorOpenState {
    OPEN = "OPEN",
    CLOSE = "CLOSE"
}
export default function RefState(deviceModel: DeviceModel, decodedMonitor: any): Record<string, any>;
