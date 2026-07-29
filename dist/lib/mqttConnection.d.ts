export declare const MQTT_OFFLINE_RECONNECT_DELAY_MS = 60000;
export declare const MQTT_MAX_RECONNECT_DELAY_MS = 600000;
export type MqttRuntimeDevice = {
    on(event: 'error', handler: (err: unknown) => void): unknown;
    on(event: 'connect', handler: () => void): unknown;
    on(event: 'message', handler: (topic: string, payload: Buffer) => void): unknown;
    on(event: 'offline', handler: () => void): unknown;
    subscribe(subscription: string): unknown;
    end(): unknown;
};
export type MqttRuntimeLogger = {
    debug(...args: any[]): void;
    error(...args: any[]): void;
    info(...args: any[]): void;
};
export type MqttReconnectScheduler = (handler: () => void | Promise<void>, delayMs: number) => unknown;
/**
 * Reconnect bookkeeping shared by every connection generation.
 *
 * Each reconnect builds a brand new MQTT device and re-wires it, so this state
 * has to live outside `wireMqttDeviceEvents` for the retry chain to survive
 * across generations.
 */
export type MqttReconnectState = {
    /** Incremented per wiring; stale devices use it to recognise they are obsolete. */
    generation: number;
    /** True while a reconnect is already scheduled, so duplicates are dropped. */
    pending: boolean;
    /** Consecutive failed attempts, used for backoff. Reset on a successful connect. */
    attempt: number;
    /** Set on shutdown to stop the retry chain for good. */
    stopped: boolean;
};
export declare function createMqttReconnectState(): MqttReconnectState;
export declare function stopMqttReconnect(state: MqttReconnectState): void;
export declare function mqttReconnectDelayMs(attempt: number): number;
export declare function wireMqttDeviceEvents(options: {
    device: MqttRuntimeDevice;
    logger: MqttRuntimeLogger;
    mqttServer: string;
    subscriptions: string[];
    onMessage: (data: any) => void;
    reconnect: () => Promise<void>;
    scheduleReconnect?: MqttReconnectScheduler;
    state?: MqttReconnectState;
}): void;
