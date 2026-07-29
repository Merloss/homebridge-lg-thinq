type Snapshot = Record<string, unknown> | null | undefined;
type TemperatureRange = readonly [min: number, max: number];
export type CookingCommandPayload = {
    dataKey: null;
    dataValue: null;
    dataSetList: {
        ovenState: Record<string, unknown>;
    };
    dataGetList: null;
};
export type CookingDeviceCommand = {
    payload: CookingCommandPayload;
    command: 'Set';
    ctrlKey: string;
};
export type OvenCookCommandState = {
    ovenMode: string;
    ovenSetTemperature: number;
    tempUnits: string;
    ovenSetDuration: number;
    probeTemperature: number;
    ovenKeepWarm: string;
};
export type MicrowaveCookCommandState = {
    ovenMode: string;
    ovenSetTemperature: number;
    tempUnits: string;
    ovenSetDuration: number;
    subCookNumber: number;
    weightUnits: string;
    microwavePower: string;
    targetWeight: number;
};
export type CookingValveInUseValues = {
    IN_USE: number;
    NOT_IN_USE: number;
};
export type CookingTimerServiceUpdate = {
    active: number;
    inUse: number;
    remainingDuration: number;
    setDuration: number;
};
export type CookingAlarmServiceUpdate = {
    active: number;
    inUse: number;
    remainingDuration: number;
};
export declare function durationFromSnapshot(snapshot: Snapshot, hourKey: string, minuteKey: string, secondKey: string): number;
export declare function cooktopOperationDuration(snapshot: Snapshot, cooktopNumber: number): number;
export declare function isFahrenheitValue(value: unknown): boolean;
export declare function isFahrenheitUnit(snapshot: Snapshot, unitKey: string): boolean;
export declare function temperatureDisplayUnitsValue(snapshot: Snapshot, unitKey: string): 0 | 1;
export declare function snapshotIncludes(snapshot: Snapshot, key: string, expected: string): boolean;
export declare function isEnabledStatus(snapshot: Snapshot, key: string): boolean;
export declare function isInitialCookingState(snapshot: Snapshot, stateKey: string): boolean;
export declare function hasActiveCookingState(snapshot: Snapshot, stateKey: string): boolean;
export declare function hasCookingModeActive(snapshot: Snapshot, modeKey: string, idleValue: string): boolean;
export declare function hasNonZeroSnapshotNumber(snapshot: Snapshot, key: string): boolean;
export declare function microwavePowerPercent(snapshot: Snapshot, key?: string): number;
export declare function isCooktopActive(snapshot: Snapshot, cooktopNumber: number): boolean;
export declare function homeKitTemperatureFromSnapshot(snapshot: Snapshot, temperatureKey: string, unitKey: string): number | undefined;
export declare function clampCookingTemperature(temperature: number, unit: unknown, fahrenheitRange: TemperatureRange, celsiusRange: TemperatureRange): number;
export declare function cookingTimerServiceUpdate(remainingDuration: number, targetDuration: number, isCooking: boolean, inUse: CookingValveInUseValues): CookingTimerServiceUpdate;
export declare function cookingAlarmServiceUpdate(timerDuration: number, inUse: CookingValveInUseValues): CookingAlarmServiceUpdate;
export declare function ovenTimerCommand(time: number): CookingDeviceCommand;
export declare function microwaveTimerCommand(time: number): CookingDeviceCommand;
export declare function cookingStopCommand(): CookingDeviceCommand;
export declare function prepareOvenCookCommand(command: OvenCookCommandState): OvenCookCommandState;
export declare function ovenRemoteStartCommand(command: OvenCookCommandState): CookingDeviceCommand;
export declare function microwaveVentLampCommand(ventSpeed: number, lampLevel: number): CookingDeviceCommand;
export declare function prepareMicrowaveCookCommand(command: MicrowaveCookCommandState, microwavePower: number): MicrowaveCookCommandState;
export declare function microwaveRemoteStartCommand(command: MicrowaveCookCommandState): CookingDeviceCommand;
export {};
