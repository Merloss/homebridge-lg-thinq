import type { EventEmitter } from 'events';
import type { Logging, PlatformAccessory } from 'homebridge';
import type { AccessoryContext } from './baseDevice.js';
import { PlatformType } from './lib/constants.js';
import type { ThinQ } from './lib/ThinQ.js';
export type MonitorInterval = ReturnType<typeof setInterval>;
export type MonitorThinQ = Pick<ThinQ, 'devices' | 'pollMonitor' | 'registerMQTTListener'>;
export declare function accessoriesForPlatform(accessories: PlatformAccessory<AccessoryContext>[], platform: PlatformType): PlatformAccessory<AccessoryContext>[];
export declare function hasEnabledThinQ1Accessories(accessories: PlatformAccessory<AccessoryContext>[], enableThinQ1: boolean): boolean;
export declare function pollThinQ2Devices(options: {
    thinq: Pick<ThinQ, 'devices'>;
    events: EventEmitter;
}): Promise<void>;
export declare function emitThinQ2MqttUpdate(events: EventEmitter, data: unknown): void;
export declare function pollThinQ1Accessories(options: {
    thinq: Pick<ThinQ, 'pollMonitor'>;
    accessories: PlatformAccessory<AccessoryContext>[];
    events: EventEmitter;
    enableThinQ1: boolean;
    log?: Logging;
}): Promise<void>;
export declare function removeMonitorInterval(monitorIntervals: MonitorInterval[], interval: MonitorInterval): void;
export declare function handleThinQ1PollError(options: {
    err: unknown;
    log: Logging;
    interval: MonitorInterval;
    monitorIntervals: MonitorInterval[];
}): boolean;
export declare function startThinQ2Monitor(options: {
    log: Logging;
    thinq: MonitorThinQ;
    events: EventEmitter;
    intervalTime: number;
    mqttFallbackIntervalTime: number;
    monitorIntervals: MonitorInterval[];
}): Promise<boolean>;
export declare function startThinQ1Monitor(options: {
    log: Logging;
    thinq: MonitorThinQ;
    accessories: PlatformAccessory<AccessoryContext>[];
    events: EventEmitter;
    intervalTime: number;
    refreshInterval: unknown;
    enableThinQ1: boolean;
    monitorIntervals: MonitorInterval[];
}): void;
export declare function clearMonitorIntervals(monitorIntervals: MonitorInterval[]): void;
