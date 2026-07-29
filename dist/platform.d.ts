import { API, DynamicPlatformPlugin, PlatformAccessory, PlatformConfig, Service, Characteristic, Logging } from 'homebridge';
import { ThinQ } from './lib/ThinQ.js';
import { EventEmitter } from 'events';
import Characteristics from './characteristics/index.js';
import { AccessoryContext } from './baseDevice.js';
/**
 * LGThinQHomebridgePlatform
 * This class serves as the main entry point for the Homebridge plugin. It handles
 * configuration parsing, device discovery, and accessory registration.
 */
export declare class LGThinQHomebridgePlatform implements DynamicPlatformPlugin {
    readonly log: Logging;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly customCharacteristics: ReturnType<typeof Characteristics>;
    readonly accessories: PlatformAccessory<AccessoryContext>[];
    readonly ThinQ: ThinQ;
    readonly events: EventEmitter;
    private readonly deviceUpdateListeners;
    private readonly monitorIntervals;
    private readonly intervalTime;
    private readonly retryTimers;
    private discoveryAttempt;
    private monitorStarted;
    private readonly enable_thinq1;
    readonly CustomServices: any;
    readonly CustomCharacteristics: any;
    constructor(log: Logging, config: PlatformConfig, api: API);
    /**
     * Invoked when Homebridge restores cached accessories from disk at startup.
     * This method sets up event handlers for characteristics and updates respective values.
     *
     * @param accessory - The cached accessory to configure.
     */
    configureAccessory(accessory: PlatformAccessory): void;
    private discoverDevicesWithRetry;
    private logThinQReadyError;
    private logDiscoveryError;
    /**
     * Discovers devices from the ThinQ API and registers them as Homebridge accessories.
     */
    discoverDevices(): Promise<void>;
    /** Discovers and registers a single device. Throws only for that device. */
    private discoverDevice;
    /**
     * Starts monitoring devices for updates using MQTT or polling.
     */
    protected startMonitor(): Promise<void>;
    protected stopMonitor(): void;
}
