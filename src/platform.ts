import { API, DynamicPlatformPlugin, PlatformAccessory, PlatformConfig, Service, Characteristic, Logging } from 'homebridge';

import { ThinQ } from './lib/ThinQ.js';
import { EventEmitter } from 'events';
import { PlatformType } from './lib/constants.js';
import { Device } from './lib/Device.js';
import Characteristics from './characteristics/index.js';
import { AccessoryContext } from './baseDevice.js';
import {
  bindDeviceUpdateListener,
  DeviceUpdateListenerMap,
  removeDeviceUpdateListener,
} from './platformEvents.js';
import {
  createOrRestoreDeviceAccessory,
  pendingAccessoryIds,
  removeStaleAccessories,
} from './platformAccessories.js';
import {
  applyConfiguredDeviceOverrides,
  configuredDevices,
  hasRequiredThinQConfig,
  isThinQ1Enabled,
  refreshIntervalMs,
  refreshIntervalSeconds,
  thinq2PollIntervalMs,
} from './platformConfig.js';
import {
  discoveryRetryDelayMs,
  isRetryableDiscoveryError,
  prepareDiscoveredDevice,
} from './platformDiscovery.js';
import { RateLimitError } from './errors/index.js';
import {
  accessoriesForPlatform,
  clearMonitorIntervals,
  hasEnabledThinQ1Accessories,
  MonitorInterval,
  startThinQ1Monitor,
  startThinQ2Monitor,
} from './platformMonitor.js';

/**
 * LGThinQHomebridgePlatform
 * This class serves as the main entry point for the Homebridge plugin. It handles
 * configuration parsing, device discovery, and accessory registration.
 */
export class LGThinQHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  public readonly customCharacteristics: ReturnType<typeof Characteristics>;

  // Tracks restored cached accessories
  public readonly accessories: PlatformAccessory<AccessoryContext>[] = [];

  public readonly ThinQ: ThinQ;
  public readonly events: EventEmitter;
  private readonly deviceUpdateListeners: DeviceUpdateListenerMap = {};
  private readonly monitorIntervals: MonitorInterval[] = [];
  private readonly intervalTime: number;
  private readonly retryTimers: ReturnType<typeof setTimeout>[] = [];
  private discoveryAttempt = 1;
  private monitorStarted = false;

  // Enable ThinQ1 support
  private readonly enable_thinq1: boolean = false;

  // This is only required when using Custom Services and Characteristics not support by HomeKit
  public readonly CustomServices: any;
  public readonly CustomCharacteristics: any;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this.customCharacteristics = Characteristics(this.api.hap.Characteristic);
    this.events = new EventEmitter();

    this.enable_thinq1 = isThinQ1Enabled(config);
    this.config.devices = configuredDevices(config) as any;

    // Set the refresh interval for polling device data
    this.intervalTime = refreshIntervalMs(config);
    this.ThinQ = new ThinQ(this, config, log);

    // Validate required configuration parameters
    if (!hasRequiredThinQConfig(config)) {
      this.log.error('Missing required config parameter.');
      return;
    }

    const didFinishLaunching = (attempt = 1) => {
      // Discover and register devices after the platform is ready
      this.ThinQ.isReady().then(() => {
        this.log.info('Successfully connected to the ThinQ API.');
        this.discoverDevicesWithRetry();
      }).catch(err => {
        this.logThinQReadyError(err);

        // A transient failure at boot (no network yet, LG throttling) used to
        // leave the platform permanently dead until Homebridge was restarted.
        if (!isRetryableDiscoveryError(err) && err?.code?.indexOf('ECONN') !== 0) {
          return;
        }

        const delay = discoveryRetryDelayMs(err, attempt);
        this.log.info('Retrying the ThinQ connection in ' + Math.round(delay / 1000) + 's.');
        const timer = setTimeout(() => didFinishLaunching(attempt + 1), delay);
        timer.unref?.();
        this.retryTimers.push(timer);
      });
    };

    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');
      didFinishLaunching();
    });

    this.api.on('shutdown', () => {
      this.stopMonitor();
    });
  }

  /**
   * Invoked when Homebridge restores cached accessories from disk at startup.
   * This method sets up event handlers for characteristics and updates respective values.
   *
   * @param accessory - The cached accessory to configure.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from Homebridge cache:', accessory.displayName);

    if (!accessory.context.device) {
      this.log.error('Accessory does not have a device context. Cannot restore accessory:', accessory.displayName);
      return;
    }

    // Add the restored accessory to the accessories cache
    this.accessories.push(accessory as PlatformAccessory<AccessoryContext>);
  }

  private discoverDevicesWithRetry(attempt = 1): void {
    this.discoverDevices().then(async () => {
      this.discoveryAttempt = 1;
      await this.startMonitor();
    }).catch(err => {
      if (isRetryableDiscoveryError(err)) {
        const delay = discoveryRetryDelayMs(err, attempt);
        this.discoveryAttempt = attempt + 1;

        if (err instanceof RateLimitError) {
          this.log.warn('LG ThinQ is rate limiting this account. Retrying discovery in '
            + Math.round(delay / 1000) + 's. Consider increasing "refresh_interval".');
        } else {
          this.log.debug('ThinQ not reachable yet, retrying discovery in ' + Math.round(delay / 1000) + 's.');
        }

        const timer = setTimeout(() => {
          this.discoverDevicesWithRetry(this.discoveryAttempt);
        }, delay);
        timer.unref?.();
        this.retryTimers.push(timer);
        return;
      }

      this.logDiscoveryError(err);
    });
  }

  private logThinQReadyError(err: any): void {
    if (err.message === 'Internal Server Error' || err.code?.indexOf('ECONN') === 0 || isRetryableDiscoveryError(err)) {
      this.log.error('LG ThinQ internal server error, try again later.');
    } else {
      this.log.error('ThinQ API is not ready. Please check configuration and try again.');
    }

    this.logDiscoveryError(err);
  }

  private logDiscoveryError(err: any): void {
    this.log.error(err.message);
    this.log.debug(err);
  }

  /**
   * Discovers devices from the ThinQ API and registers them as Homebridge accessories.
   */
  async discoverDevices() {
    const pendingIds = pendingAccessoryIds(this.accessories);

    const devices: Device[] = await this.ThinQ.devices();

    if (!devices.length) {
      this.log.warn('No ThinQ devices in your account.');
    }

    const failed: string[] = [];

    for (const device of devices) {
      // Each device is set up in isolation. Previously a single unsupported or
      // malformed appliance threw out of this loop, so every device after it in
      // the account was silently never registered.
      try {
        await this.discoverDevice(device, pendingIds);
      } catch (err) {
        if (isRetryableDiscoveryError(err)) {
          // The account itself is unreachable; let the caller retry the round.
          throw err;
        }

        failed.push(device.name || device.id);
        this.log.error('[' + (device.name || device.id) + '] Failed to set up device, skipping it: '
          + ((err as Error)?.message ?? err));
        this.log.debug(err as any);
      }
    }

    if (failed.length) {
      this.log.warn('Skipped ' + failed.length + ' device(s) that could not be set up: ' + failed.join(', ')
        + '. The remaining devices are unaffected.');
    }

    // Remove accessories that are no longer present in the ThinQ API
    removeStaleAccessories({
      api: this.api,
      log: this.log,
      accessories: this.accessories,
      events: this.events,
      listeners: this.deviceUpdateListeners,
      pendingIds,
    });
  }

  /** Discovers and registers a single device. Throws only for that device. */
  private async discoverDevice(device: Device, pendingIds: Set<string>): Promise<void> {
    applyConfiguredDeviceOverrides(this.config, device);
    this.log.debug('Device [' + device.name + ']: ', device.toString());
    this.log.debug(JSON.stringify(device.data));

    const preparedDevice = await prepareDiscoveredDevice({
      log: this.log,
      config: this.config,
      enableThinQ1: this.enable_thinq1,
      thinq: this.ThinQ,
      device,
    });
    if (preparedDevice.status !== 'ready') {
      return;
    }

    const lgThinQDevice = createOrRestoreDeviceAccessory({
      platform: this,
      api: this.api,
      log: this.log,
      accessories: this.accessories,
      pendingIds,
      device,
      accessoryType: preparedDevice.accessoryType,
      category: preparedDevice.category,
    });

    // Bind the update event for the device
    bindDeviceUpdateListener(
      this.events,
      this.deviceUpdateListeners,
      device.id,
      lgThinQDevice.update.bind(lgThinQDevice),
    );

    // Perform the first-time update
    lgThinQDevice.updateAccessoryCharacteristic(device);
  }

  /**
   * Starts monitoring devices for updates using MQTT or polling.
   */
  protected async startMonitor() {
    // Filter ThinQ2 devices
    const thinq2devices = accessoriesForPlatform(this.accessories, PlatformType.ThinQ2);
    const hasThinQ1Devices = hasEnabledThinQ1Accessories(this.accessories, this.enable_thinq1);

    if (!thinq2devices.length && !hasThinQ1Devices) {
      return;
    }

    if (this.monitorStarted) {
      this.log.debug('Device monitor already started.');
      return;
    }

    try {
      if (thinq2devices.length) {
        await startThinQ2Monitor({
          log: this.log,
          thinq: this.ThinQ,
          events: this.events,
          intervalTime: thinq2PollIntervalMs(this.config, false),
          mqttFallbackIntervalTime: thinq2PollIntervalMs(this.config, true),
          monitorIntervals: this.monitorIntervals,
        });
      }

      // Stop here if there are no ThinQ1 devices
      if (hasThinQ1Devices) {
        // Start polling ThinQ1 devices
        startThinQ1Monitor({
          log: this.log,
          thinq: this.ThinQ,
          accessories: this.accessories,
          events: this.events,
          intervalTime: this.intervalTime,
          refreshInterval: refreshIntervalSeconds(this.config),
          enableThinQ1: this.enable_thinq1,
          monitorIntervals: this.monitorIntervals,
        });
      }

      this.monitorStarted = true;
    } catch (err) {
      clearMonitorIntervals(this.monitorIntervals);
      this.monitorStarted = false;
      throw err;
    }
  }

  protected stopMonitor() {
    clearMonitorIntervals(this.monitorIntervals);
    this.ThinQ?.stopMQTTListener?.();

    while (this.retryTimers.length) {
      const timer = this.retryTimers.pop();
      if (timer) {
        clearTimeout(timer);
      }
    }

    for (const deviceId of Object.keys(this.deviceUpdateListeners)) {
      removeDeviceUpdateListener(this.events, this.deviceUpdateListeners, deviceId);
    }

    this.monitorStarted = false;
  }
}
