import { Logger, PlatformConfig } from 'homebridge';
import { API } from './API.js';
import { LGThinQHomebridgePlatform } from '../platform.js';
import { Device } from './Device.js';
import { DeviceModel } from './DeviceModel.js';
import Persist from './Persist.js';
import { MqttReconnectState } from './mqttConnection.js';
import { WorkIdRegistry } from './thinq1Monitor.js';
export type WorkId = string;
export declare class ThinQ {
    readonly platform: LGThinQHomebridgePlatform;
    readonly config: PlatformConfig;
    readonly logger: Logger;
    protected api: API;
    protected workIds: WorkIdRegistry;
    protected deviceModel: Record<string, DeviceModel>;
    protected persist: Persist;
    protected mqttReconnectState?: MqttReconnectState;
    constructor(platform: LGThinQHomebridgePlatform, config: PlatformConfig, logger: Logger);
    devices(): Promise<Device[]>;
    setup(device: Device): Promise<boolean>;
    unregister(device: Device): Promise<void>;
    protected registerWorkId(device: any): Promise<string | null>;
    protected loadDeviceModel(device: Device): Promise<DeviceModel>;
    pollMonitor(device: Device): Promise<Device>;
    thinq1DeviceControl(device: Device, key: string, value: any): Promise<any>;
    deviceControl(device: string | Device, values: Record<string, any>, command?: 'Set' | 'Operation', ctrlKey?: string, ctrlPath?: string): Promise<boolean>;
    /**
     * @returns true when the MQTT push channel came up. Callers use this to decide
     *          whether polling is a fallback or the only source of updates.
     */
    registerMQTTListener(callback: (data: any) => void): Promise<boolean>;
    protected _registerMQTTListener(callback: (data: any) => void): Promise<void>;
    /** Stops the MQTT reconnect chain. Called on Homebridge shutdown. */
    stopMQTTListener(): void;
    isReady(): Promise<void>;
}
