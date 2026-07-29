import type { CharacteristicValue, Service } from 'homebridge';
type CharacteristicReference = Parameters<Service['setCharacteristic']>[0];
type Snapshot = Record<string, unknown> | null | undefined;
export type ContactSensorStateValues = {
    CONTACT_DETECTED: number;
    CONTACT_NOT_DETECTED: number;
};
export type VisibilityStateValues = {
    SHOWN: number;
    HIDDEN: number;
};
export type VisibilityCharacteristicUpdate = {
    targetVisibilityState: number;
    currentVisibilityState: number;
};
export declare function hasSnapshotKey(snapshot: Snapshot, key: string): boolean;
export declare function contactSensorStateValue(isContactDetected: boolean, contactState: ContactSensorStateValues): number;
export declare function visibilityCharacteristicUpdate(isShown: boolean, targetVisibilityState: VisibilityStateValues, currentVisibilityState: VisibilityStateValues): VisibilityCharacteristicUpdate;
export declare function updateCharacteristicIfChanged(service: Service | undefined, characteristic: CharacteristicReference, value: CharacteristicValue | null): boolean;
export declare function updateCharacteristicIfDefined(service: Service | undefined, characteristic: CharacteristicReference, value: CharacteristicValue | null | undefined): boolean;
export declare function snapshotNumber(snapshot: Snapshot, key: string, fallback?: number): number;
export declare function snapshotBoolean(snapshot: Snapshot, key: string, fallback?: boolean): boolean;
export declare function snapshotString(snapshot: Snapshot, key: string, fallback?: string): string;
export {};
