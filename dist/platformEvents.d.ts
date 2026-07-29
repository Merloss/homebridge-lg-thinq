import type { EventEmitter } from 'events';
export type DeviceUpdateListener = (snapshot: unknown) => void;
export type DeviceUpdateListenerMap = Record<string, DeviceUpdateListener>;
export declare function removeDeviceUpdateListener(events: EventEmitter, listeners: DeviceUpdateListenerMap, deviceId: string): boolean;
export declare function bindDeviceUpdateListener(events: EventEmitter, listeners: DeviceUpdateListenerMap, deviceId: string, listener: DeviceUpdateListener): void;
