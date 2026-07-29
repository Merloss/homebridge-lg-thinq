import { API } from './API.js';
import { Device, devicesFromList } from './Device.js';
import { PlatformType } from './constants.js';
import { loadDeviceModelForDevice } from './DeviceModel.js';
import * as Path from 'path';
import Helper from '../v1/helper.js';
import { PLUGIN_NAME } from '../settings.js';
import { device as awsIotDevice } from 'aws-iot-device-sdk';
import Persist from './Persist.js';
import { coerceCommandPayload } from './commandPayload.js';
import { loadMqttConnectionSetup, prepareMqttConnection, retryMqttRegistration, } from './mqttCertificate.js';
import { createMqttReconnectState, stopMqttReconnect, wireMqttDeviceEvents, } from './mqttConnection.js';
import { pollThinQ1MonitorResult, registerThinQ1WorkId, unregisterThinQ1WorkId, } from './thinq1Monitor.js';
export class ThinQ {
    platform;
    config;
    logger;
    api;
    workIds = {};
    deviceModel = {};
    persist;
    mqttReconnectState;
    constructor(platform, config, logger) {
        this.platform = platform;
        this.config = config;
        this.logger = logger;
        this.api = new API(this.config.country, this.config.language, logger);
        this.api.httpClient.interceptors.response.use(response => {
            this.logger.debug('[request]', response.config.method, response.config.url);
            return response;
        }, err => {
            return Promise.reject(err);
        });
        if (config.refresh_token) {
            this.api.setRefreshToken(config.refresh_token);
        }
        else if (config.username && config.password) {
            this.api.setUsernamePassword(config.username, config.password);
        }
        this.persist = new Persist(Path.join(this.platform.api.user.storagePath(), PLUGIN_NAME, 'persist', 'devices'));
    }
    async devices() {
        const listDevices = await this.api.getListDevices();
        return devicesFromList(listDevices);
    }
    async setup(device) {
        // load device model
        device.deviceModel = await this.loadDeviceModel(device);
        if (device.deviceModel.data.Monitoring === undefined
            && device.deviceModel.data.MonitoringValue === undefined
            && device.deviceModel.data.Value === undefined) {
            this.logger.warn('[' + device.name + '] This device may not "smart" device. Ignore it!');
        }
        if (device.platform === PlatformType.ThinQ1) {
            // register work uuid
            await this.registerWorkId(device);
            // transform thinq1 device
            const deviceWithSnapshot = Helper.transform(device, null);
            device.snapshot = deviceWithSnapshot.snapshot;
        }
        return true;
    }
    async unregister(device) {
        if (device.platform === PlatformType.ThinQ1) {
            await unregisterThinQ1WorkId({
                api: this.api,
                workIds: this.workIds,
                device,
            });
        }
    }
    async registerWorkId(device) {
        return await registerThinQ1WorkId({
            api: this.api,
            workIds: this.workIds,
            device,
        });
    }
    async loadDeviceModel(device) {
        return this.deviceModel[device.id] = await loadDeviceModelForDevice({
            device,
            persist: this.persist,
            httpClient: this.api.httpClient,
            logger: this.logger,
        });
    }
    async pollMonitor(device) {
        device.deviceModel = await this.loadDeviceModel(device);
        if (device.platform === PlatformType.ThinQ1) {
            const result = await pollThinQ1MonitorResult({
                api: this.api,
                workIds: this.workIds,
                device,
            });
            return Helper.transform(device, result);
        }
        return device;
    }
    thinq1DeviceControl(device, key, value) {
        const data = Helper.prepareControlData(device, key, value);
        return this.api.thinq1PostRequest('rti/rtiControl', data).catch(err => {
            this.logger.error('Unknown Error: ', err);
        });
    }
    async deviceControl(device, values, command = 'Set', ctrlKey = 'basicCtrl', ctrlPath = 'control-sync') {
        const id = device instanceof Device ? device.id : device;
        const model = this.deviceModel[id];
        coerceCommandPayload(values, model);
        const response = await this.api.sendCommandToDevice(id, values, command, ctrlKey, ctrlPath);
        if (response.resultCode === '0000') {
            this.logger.debug('ThinQ Device Received the Command');
            return true;
        }
        else {
            this.logger.debug('ThinQ Device Did Not Received the Command');
            return false;
        }
    }
    /**
     * @returns true when the MQTT push channel came up. Callers use this to decide
     *          whether polling is a fallback or the only source of updates.
     */
    async registerMQTTListener(callback) {
        return await retryMqttRegistration({
            register: () => this._registerMQTTListener(callback),
            logger: this.logger,
        });
    }
    async _registerMQTTListener(callback) {
        const setup = await loadMqttConnectionSetup({
            api: this.api,
            persist: this.persist,
            logger: this.logger,
        });
        // One state object for the whole reconnect chain, so retries survive across
        // connection generations instead of dying with the device that failed.
        this.mqttReconnectState = createMqttReconnectState();
        const reconnectState = this.mqttReconnectState;
        const connectToMqtt = async () => {
            const mqttDir = Path.join(this.platform.api.user.storagePath(), PLUGIN_NAME, 'persist', 'mqtt');
            const connection = await prepareMqttConnection({
                api: this.api,
                setup,
                mqttDir,
                clientId: this.api.client_id,
            });
            this.logger.debug('open mqtt connection to', setup.mqttServer);
            const device = new awsIotDevice(connection.connectData);
            wireMqttDeviceEvents({
                device,
                logger: this.logger,
                mqttServer: setup.mqttServer,
                subscriptions: connection.subscriptions,
                onMessage: callback,
                reconnect: connectToMqtt,
                state: reconnectState,
            });
        };
        // first call
        await connectToMqtt();
    }
    /** Stops the MQTT reconnect chain. Called on Homebridge shutdown. */
    stopMQTTListener() {
        if (this.mqttReconnectState) {
            stopMqttReconnect(this.mqttReconnectState);
        }
    }
    async isReady() {
        await this.persist.init();
        this.api.clientIdStore = this.persist;
        await this.api.ready();
    }
}
//# sourceMappingURL=ThinQ.js.map