import { DeviceModel } from '../../lib/DeviceModel.js';
export declare enum ACOperation {
    OFF = "@AC_MAIN_OPERATION_OFF_W",
    /** This one seems to mean "on" ? */
    RIGHT_ON = "@AC_MAIN_OPERATION_RIGHT_ON_W",
    LEFT_ON = "@AC_MAIN_OPERATION_LEFT_ON_W",
    ALL_ON = "@AC_MAIN_OPERATION_ALL_ON_W"
}
export default function AirState(deviceModel: DeviceModel, decodedMonitor: any): Record<string, any>;
