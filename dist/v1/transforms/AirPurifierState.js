import AirState from './AirState.js';
export default function AirPurifierState(deviceModel, decodedMonitor) {
    const airState = AirState(deviceModel, decodedMonitor);
    airState['airState.operation'] = !!parseInt(decodedMonitor.Operation);
    airState['airState.miscFuncState.airFast'] = !!parseInt(decodedMonitor.AirFast);
    return airState;
}
//# sourceMappingURL=AirPurifierState.js.map