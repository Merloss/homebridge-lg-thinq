import type { Device } from './Device.js';
export type WorkId = string;
export type WorkIdRegistry = Record<string, WorkId | null>;
export type ThinQ1MonitorApi = {
    sendMonitorCommand(deviceId: string, command: 'Start' | 'Stop', workId: string | null): Promise<any>;
    getMonitorResult(deviceId: string, workId: string | null): Promise<Buffer<ArrayBuffer> | null>;
};
export declare function hasThinQ1WorkId(workIds: WorkIdRegistry, device: Pick<Device, 'id'>): boolean;
export declare function registerThinQ1WorkId(options: {
    api: ThinQ1MonitorApi;
    workIds: WorkIdRegistry;
    device: Pick<Device, 'id'>;
    createWorkId?: () => string;
}): Promise<WorkId | null>;
export declare function unregisterThinQ1WorkId(options: {
    api: ThinQ1MonitorApi;
    workIds: WorkIdRegistry;
    device: Pick<Device, 'id'>;
}): Promise<void>;
export declare function pollThinQ1MonitorResult(options: {
    api: ThinQ1MonitorApi;
    workIds: WorkIdRegistry;
    device: Pick<Device, 'id'>;
    createWorkId?: () => string;
}): Promise<Buffer<ArrayBuffer> | null>;
