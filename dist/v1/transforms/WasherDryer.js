import { lookupEnum, lookupEnumIndex } from '../helper.js';
export var WasherState;
(function (WasherState) {
    WasherState["POWEROFF"] = "@WM_STATE_POWER_OFF_W";
    WasherState["INITIAL"] = "@WM_STATE_INITIAL_W";
    WasherState["PAUSE"] = "@WM_STATE_PAUSE_W";
    WasherState["RESERVED"] = "@WM_STATE_RESERVE_W";
    WasherState["DETECTING"] = "@WM_STATE_DETECTING_W";
    WasherState["RUNNING"] = "@WM_STATE_RUNNING_W";
    WasherState["RINSING"] = "@WM_STATE_RINSING_W";
    WasherState["SPINNING"] = "@WM_STATE_SPINNING_W";
    WasherState["DRYING"] = "@WM_STATE_DRYING_W";
    WasherState["END"] = "@WM_STATE_END_W";
    WasherState["COOLDOWN"] = "@WM_STATE_COOLDOWN_W";
    WasherState["RINSEHOLD"] = "@WM_STATE_RINSEHOLD_W";
    WasherState["WASH_REFRESHING"] = "@WM_STATE_WASH_REFRESHING_W";
    WasherState["STEAMSOFTENING"] = "@WM_STATE_STEAMSOFTENING_W";
    WasherState["ERROR"] = "@WM_STATE_ERROR_W";
})(WasherState || (WasherState = {}));
export var RemoteStart;
(function (RemoteStart) {
    RemoteStart["REMOTE_START_OFF"] = "@CP_OFF_EN_W";
    RemoteStart["REMOTE_START_ON"] = "@CP_ON_EN_W";
})(RemoteStart || (RemoteStart = {}));
export var ChildLock;
(function (ChildLock) {
    ChildLock["CHILDLOCK_OFF"] = "@CP_OFF_EN_W";
    ChildLock["CHILDLOCK_ON"] = "@CP_ON_EN_W";
})(ChildLock || (ChildLock = {}));
export var SoilWash;
(function (SoilWash) {
    SoilWash["NO_SOILWASH"] = "-";
    SoilWash["SOILWASH_TURBO_WASH"] = "@WM_FL24_TITAN_SOIL_LIGHT_W";
    SoilWash["SOILWASH_TIMESAVE"] = "@WM_FL24_TITAN_SOIL_NORMAL_W";
    SoilWash["SOILWASH_NORMAL"] = "@WM_FL24_TITAN_SOIL_HEAVY_W";
})(SoilWash || (SoilWash = {}));
export default function WasherDryer(deviceModel, decodedMonitor) {
    return {
        washerDryer: {
            state: lookupEnumIndex(WasherState, lookupEnum(deviceModel, decodedMonitor, 'State')) || 'POWEROFF',
            preState: lookupEnumIndex(WasherState, lookupEnum(deviceModel, decodedMonitor, 'PreState')) || 'POWEROFF',
            remoteStart: lookupEnumIndex(RemoteStart, lookupEnum(deviceModel, decodedMonitor, 'RemoteStart')) || 'REMOTE_START_OFF',
            initialBit: (decodedMonitor.InitialBit || false) ? 'INITIAL_BIT_ON' : 'INITIAL_BIT_OFF',
            childLock: lookupEnumIndex(ChildLock, lookupEnum(deviceModel, decodedMonitor, 'ChildLock')) || 'CHILDLOCK_OFF',
            TCLCount: (decodedMonitor.TCLCount || 0),
            reserveTimeHour: parseInt(decodedMonitor.Reserve_Time_H || 0),
            reserveTimeMinute: parseInt(decodedMonitor.Reserve_Time_M || 0),
            remainTimeHour: parseInt(decodedMonitor.Remain_Time_H || 0),
            remainTimeMinute: parseInt(decodedMonitor.Remain_Time_M || 0),
            initialTimeHour: parseInt(decodedMonitor.Initial_Time_H || 0),
            initialTimeMinute: parseInt(decodedMonitor.Initial_Time_M || 0),
            soilWash: lookupEnumIndex(SoilWash, lookupEnum(deviceModel, decodedMonitor, 'Soil')) || 'NO_SOILWASH',
        },
    };
}
//# sourceMappingURL=WasherDryer.js.map