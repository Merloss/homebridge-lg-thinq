import { lookupEnum, lookupEnumIndex } from '../helper.js';
export var DoorOpenState;
(function (DoorOpenState) {
    DoorOpenState["OPEN"] = "OPEN";
    DoorOpenState["CLOSE"] = "CLOSE";
})(DoorOpenState || (DoorOpenState = {}));
export default function RefState(deviceModel, decodedMonitor) {
    const snapshot = {
        refState: {
            fridgeTemp: decodedMonitor.TempRefrigerator || deviceModel.default('TempRefrigerator') || '0',
            freezerTemp: decodedMonitor.TempFreezer || deviceModel.default('TempFreezer') || '0',
            atLeastOneDoorOpen: lookupEnumIndex(DoorOpenState, lookupEnum(deviceModel, decodedMonitor, 'DoorOpenState') || deviceModel.default('DoorOpenState')),
            tempUnit: parseInt(decodedMonitor.TempUnit || deviceModel.default('TempUnit')) ? 'CELSIUS' : 'FAHRENHEIT',
        },
    };
    snapshot.refState.fridgeTemp = parseInt(snapshot.refState.fridgeTemp);
    snapshot.refState.freezerTemp = parseInt(snapshot.refState.freezerTemp);
    if ('IcePlus' in decodedMonitor) {
        snapshot.refState.expressMode = decodedMonitor.IcePlus || deviceModel.default('IcePlus') || '0';
    }
    if ('ExpressFridge' in decodedMonitor) {
        snapshot.refState.expressFridge = decodedMonitor.ExpressFridge || deviceModel.default('ExpressFridge') || '0';
    }
    if ('EcoFriendly' in decodedMonitor) {
        snapshot.refState.ecoFriendly = decodedMonitor.EcoFriendly || deviceModel.default('EcoFriendly') || '0';
    }
    return snapshot;
}
//# sourceMappingURL=RefState.js.map