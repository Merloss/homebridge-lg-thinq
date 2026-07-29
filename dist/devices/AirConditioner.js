import { BaseDevice, isDeviceOnlineForHomeKit } from '../baseDevice.js';
import { ValueType } from '../lib/DeviceModel.js';
import { normalizeBoolean, normalizeNumber } from '../utils/normalize.js';
import { cToF, fToC } from '../utils/temperature.js';
import { hasSnapshotKey, snapshotBoolean, snapshotNumber } from './helpers.js';
export var ACModelType;
(function (ACModelType) {
    ACModelType["AWHP"] = "AWHP";
    ACModelType["RAC"] = "RAC";
})(ACModelType || (ACModelType = {}));
export const FAN_SPEED_AUTO = 8;
export const AIR_CONDITIONER_TEMPERATURE_KEEP_ALIVE_INTERVAL_MS = 60000;
export const AIR_CONDITIONER_TEMPERATURE_KEEP_ALIVE_MAX_FAILURES = 3;
export var FanSpeed;
(function (FanSpeed) {
    FanSpeed[FanSpeed["LOW"] = 2] = "LOW";
    FanSpeed[FanSpeed["LOW_MEDIUM"] = 3] = "LOW_MEDIUM";
    FanSpeed[FanSpeed["MEDIUM"] = 4] = "MEDIUM";
    FanSpeed[FanSpeed["MEDIUM_HIGH"] = 5] = "MEDIUM_HIGH";
    FanSpeed[FanSpeed["HIGH"] = 6] = "HIGH";
})(FanSpeed || (FanSpeed = {}));
const HOMEKIT_FAN_SPEED_DEFAULT = 50;
const HOMEKIT_FAN_SPEED_MAX = 100;
const LG_FAN_SPEED_MIN = FanSpeed.LOW;
const LG_FAN_SPEED_MAX = FanSpeed.HIGH;
var OpMode;
(function (OpMode) {
    OpMode[OpMode["AUTO"] = 6] = "AUTO";
    OpMode[OpMode["COOL"] = 0] = "COOL";
    OpMode[OpMode["HEAT"] = 4] = "HEAT";
    OpMode[OpMode["FAN"] = 2] = "FAN";
    OpMode[OpMode["DRY"] = 1] = "DRY";
    OpMode[OpMode["AIR_CLEAN"] = 5] = "AIR_CLEAN";
})(OpMode || (OpMode = {}));
function isFahrenheitAirConditioner(config) {
    return (config.ac_temperature_unit || '').toLowerCase() === 'f';
}
function convertTemperatureCelsiusFromLGToHomekit(temperature, device, config, logger) {
    const tempNum = Number(temperature);
    if (!isFahrenheitAirConditioner(config)) {
        return tempNum;
    }
    try {
        const mapped = device.deviceModel.lookupMonitorValue && device.deviceModel.lookupMonitorValue('TempCelToFah', String(tempNum));
        if (typeof mapped !== 'undefined' && mapped !== null) {
            const n = Number(mapped);
            if (!isNaN(n)) {
                return Math.round(fToC(n) * 100) / 100;
            }
        }
    }
    catch (e) {
        logger.warn('Temperature mapping lookup failed, falling back to direct conversion.', e);
    }
    const c = Math.round(fToC(tempNum) * 100) / 100;
    return c;
}
function convertTemperatureCelsiusFromHomekitToLG(temperatureInCelsius, device, config, logger) {
    const tempNum = Number(temperatureInCelsius);
    if (!isFahrenheitAirConditioner(config)) {
        return tempNum;
    }
    const temperatureInFahrenheit = Math.round(cToF(tempNum));
    try {
        const mapped = device.deviceModel.lookupMonitorValue && device.deviceModel.lookupMonitorValue('TempFahToCel', String(temperatureInFahrenheit));
        if (typeof mapped !== 'undefined' && mapped !== null) {
            const n = Number(mapped);
            if (!isNaN(n)) {
                return n;
            }
        }
    }
    catch (e) {
        logger.warn('Temperature mapping lookup failed, falling back to direct conversion.', e);
    }
    return temperatureInFahrenheit;
}
function readAirQualityState(data, isPowerOn) {
    if (!hasSnapshotKey(data, 'airState.quality.overall') &&
        !hasSnapshotKey(data, 'airState.quality.PM2') &&
        !hasSnapshotKey(data, 'airState.quality.PM10')) {
        return null;
    }
    return {
        isOn: isPowerOn || snapshotBoolean(data, 'airState.quality.sensorMon'),
        overall: snapshotNumber(data, 'airState.quality.overall'),
        PM2: snapshotNumber(data, 'airState.quality.PM2'),
        PM10: snapshotNumber(data, 'airState.quality.PM10'),
    };
}
function readWindStrength(data) {
    const raw = data && data['airState.windStrength'];
    const num = Number(raw);
    if (!isNaN(num)) {
        if (num === FAN_SPEED_AUTO) {
            return HOMEKIT_FAN_SPEED_DEFAULT;
        }
        if (num >= LG_FAN_SPEED_MIN && num <= LG_FAN_SPEED_MAX) {
            return Math.round(((num - LG_FAN_SPEED_MIN) / (LG_FAN_SPEED_MAX - LG_FAN_SPEED_MIN)) * HOMEKIT_FAN_SPEED_MAX) || 1;
        }
    }
    return HOMEKIT_FAN_SPEED_DEFAULT;
}
export function readAirConditionerState(data, device, config, logger) {
    const snapshot = data ?? {};
    const isPowerOn = snapshotBoolean(snapshot, 'airState.operation');
    const humidity = snapshotNumber(snapshot, 'airState.humidity.current');
    const consumption = snapshotNumber(snapshot, 'airState.energy.onCurrent', NaN);
    const vStep = Math.floor(snapshotNumber(snapshot, 'airState.wDir.vStep') / 100), hStep = Math.floor(snapshotNumber(snapshot, 'airState.wDir.hStep') / 100);
    return {
        opMode: snapshotNumber(snapshot, 'airState.opMode', OpMode.COOL),
        isPowerOn,
        currentRelativeHumidity: humidity > 100 ? humidity / 10 : humidity,
        currentTemperature: convertTemperatureCelsiusFromLGToHomekit(snapshotNumber(snapshot, 'airState.tempState.current'), device, config, logger),
        targetTemperature: convertTemperatureCelsiusFromLGToHomekit(snapshotNumber(snapshot, 'airState.tempState.target'), device, config, logger),
        airQuality: readAirQualityState(snapshot, isPowerOn),
        windStrength: readWindStrength(snapshot),
        isWindStrengthAuto: Number(snapshot['airState.windStrength']) === FAN_SPEED_AUTO,
        isSwingOn: !!(vStep + hStep),
        isLightOn: snapshotBoolean(snapshot, 'airState.lightingState.displayControl'),
        currentConsumption: Number.isNaN(consumption) ? 0 : consumption / 100,
        type: device.deviceModel.data.Info?.modelType || ACModelType.RAC,
    };
}
export function targetOpModeFromHomeKit(value, currentOpMode, targetState) {
    switch (value) {
        case targetState.AUTO:
            return OpMode.AUTO;
        case targetState.HEAT:
            return OpMode.HEAT;
        case targetState.COOL:
            return OpMode.COOL;
        default:
            return currentOpMode;
    }
}
export function targetHeaterCoolerSetupForConfig(acMode, targetState) {
    if (acMode === 'BOTH') {
        return {
            validValues: [
                targetState.AUTO,
                targetState.COOL,
                targetState.HEAT,
            ],
            initialValue: targetState.COOL,
        };
    }
    if (acMode === 'COOLING') {
        return {
            validValues: [
                targetState.COOL,
            ],
            initialValue: targetState.COOL,
        };
    }
    if (acMode === 'HEATING') {
        return {
            validValues: [
                targetState.HEAT,
            ],
            initialValue: targetState.HEAT,
        };
    }
    return null;
}
export function temperatureRangePropsFromRange(range, convertTemperature) {
    if (!range) {
        return null;
    }
    return {
        minValue: convertTemperature(range.min),
        maxValue: convertTemperature(range.max),
        minStep: range.step || 0.01,
    };
}
export function fanRotationSpeedProps() {
    return {
        minValue: 0,
        maxValue: HOMEKIT_FAN_SPEED_MAX,
        minStep: 1,
    };
}
export function heaterCoolerCharacteristicUpdateFromState(state, currentState, targetState) {
    if (!state.isPowerOn) {
        return {
            currentState: currentState.INACTIVE,
        };
    }
    if (state.opMode === OpMode.COOL) {
        return {
            currentState: currentState.COOLING,
            targetState: targetState.COOL,
        };
    }
    if (state.opMode === OpMode.HEAT) {
        return {
            currentState: currentState.HEATING,
            targetState: targetState.HEAT,
        };
    }
    if ([OpMode.AUTO, -1].includes(state.opMode)) {
        if (state.currentTemperature < state.targetTemperature) {
            return {
                currentState: currentState.HEATING,
                targetState: targetState.HEAT,
            };
        }
        return {
            currentState: currentState.COOLING,
            targetState: targetState.COOL,
        };
    }
    return null;
}
export function windStrengthFromTargetFanState(value, targetFanState) {
    const vNum = normalizeNumber(value);
    const isAuto = (vNum !== null) ? (vNum === targetFanState.AUTO) : normalizeBoolean(value);
    return isAuto ? FAN_SPEED_AUTO : FanSpeed.HIGH;
}
export function fanCharacteristicUpdateFromState(state, swingMode) {
    return {
        rotationSpeed: state.windStrength,
        swingMode: state.isSwingOn ? swingMode.SWING_ENABLED : swingMode.SWING_DISABLED,
    };
}
export function fanV2CharacteristicUpdateFromState(state, active, targetFanState, swingMode) {
    const update = {
        active: state.isPowerOn ? active.ACTIVE : active.INACTIVE,
        targetFanState: state.isWindStrengthAuto ? targetFanState.AUTO : targetFanState.MANUAL,
        swingMode: state.isSwingOn ? swingMode.SWING_ENABLED : swingMode.SWING_DISABLED,
    };
    if (!state.isWindStrengthAuto) {
        update.rotationSpeed = state.windStrength;
    }
    return update;
}
export function isSwingModeEnabled(swingMode) {
    return swingMode !== 'NONE';
}
export function airQualityCharacteristicUpdateFromState(state, enabled = true) {
    if (!enabled || !state.airQuality || !state.airQuality.isOn) {
        return null;
    }
    const update = {
        airQuality: state.airQuality.overall,
    };
    if (state.airQuality.PM2) {
        update.PM2 = state.airQuality.PM2;
    }
    if (state.airQuality.PM10) {
        update.PM10 = state.airQuality.PM10;
    }
    return update;
}
export function temperatureSensorCharacteristicUpdateFromState(state, enabled = true) {
    if (!enabled) {
        return null;
    }
    return {
        value: state.currentTemperature,
        statusActive: state.isPowerOn,
    };
}
export function humiditySensorCharacteristicUpdateFromState(state, enabled = true) {
    if (!enabled) {
        return null;
    }
    return {
        value: state.currentRelativeHumidity,
        statusActive: state.isPowerOn,
    };
}
export function thresholdTemperatureUpdateFromState(targetTemperature, currentStateValue, currentState) {
    if (currentStateValue === currentState.HEATING) {
        return {
            heatingThresholdTemperature: targetTemperature,
        };
    }
    if (currentStateValue === currentState.COOLING) {
        return {
            coolingThresholdTemperature: targetTemperature,
        };
    }
    return null;
}
export function windStrengthFromRotationSpeed(value) {
    const vNum = normalizeNumber(value);
    if (vNum === null) {
        return null;
    }
    const speedPercent = Math.max(0, Math.min(HOMEKIT_FAN_SPEED_MAX, vNum));
    return Math.round(LG_FAN_SPEED_MIN + (speedPercent / HOMEKIT_FAN_SPEED_MAX) * (LG_FAN_SPEED_MAX - LG_FAN_SPEED_MIN));
}
export function swingCommandsForMode(value, swingMode) {
    if (!isSwingModeEnabled(swingMode)) {
        return [];
    }
    const swingValue = value ? '100' : '0';
    if (swingMode === 'BOTH') {
        return [{
                payload: {
                    dataKey: null,
                    dataValue: null,
                    dataSetList: {
                        'airState.wDir.vStep': swingValue,
                        'airState.wDir.hStep': swingValue,
                    },
                    dataGetList: null,
                },
                command: 'Set',
                ctrlKey: 'favoriteCtrl',
                snapshotUpdates: {
                    'airState.wDir.vStep': swingValue,
                    'airState.wDir.hStep': swingValue,
                },
            }];
    }
    if (swingMode === 'VERTICAL') {
        return [{
                payload: {
                    dataKey: 'airState.wDir.vStep',
                    dataValue: swingValue,
                },
                snapshotUpdates: {
                    'airState.wDir.vStep': swingValue,
                },
            }];
    }
    if (swingMode === 'HORIZONTAL') {
        return [{
                payload: {
                    dataKey: 'airState.wDir.hStep',
                    dataValue: swingValue,
                },
                snapshotUpdates: {
                    'airState.wDir.hStep': swingValue,
                },
            }];
    }
    return [];
}
export function featureToggleValue(snapshot, snapshotKey, enabled = true) {
    if (!enabled) {
        return undefined;
    }
    return Boolean(snapshot?.[snapshotKey]);
}
export function modelFeatureToggleValue(snapshot, snapshotKey, model, enabledModels, enabled = true) {
    if (!enabled || !enabledModels.includes(model)) {
        return undefined;
    }
    return featureToggleValue(snapshot, snapshotKey);
}
export function coolModeFeatureCommandFromState(state, value, dataKey) {
    if (!(state.isPowerOn && state.opMode === OpMode.COOL)) {
        return null;
    }
    const dataValue = normalizeBoolean(value) ? 1 : 0;
    return {
        payload: {
            dataKey,
            dataValue,
        },
        snapshotUpdates: {
            [dataKey]: dataValue,
        },
    };
}
export function temperatureKeepAliveCommandForDevice(device) {
    if (!isDeviceOnlineForHomeKit(device)) {
        return null;
    }
    return {
        deviceId: device.id,
        payload: {
            dataKey: 'airState.mon.timeout',
            dataValue: '70',
        },
        command: 'Set',
        ctrlKey: 'allEventEnable',
        ctrlPath: 'control',
    };
}
/**
 * Represents an LG ThinQ Air Conditioner device.
 * This class extends the `baseDevice` class and provides functionality to control and monitor
 * various features of an air conditioner, such as temperature, fan speed, swing mode, and more.
 */
export default class AirConditioner extends BaseDevice {
    platform;
    accessory;
    service;
    serviceAirQuality;
    serviceSensor;
    serviceHumiditySensor;
    serviceLight;
    serviceFanV2;
    // more feature
    serviceJetMode; // jet mode
    serviceQuietMode;
    serviceEnergySaveMode;
    serviceAirClean;
    jetModeModels = ['RAC_056905'];
    quietModeModels = ['WINF_056905'];
    energySaveModeModels = ['WINF_056905', 'RAC_056905'];
    airCleanModels = ['RAC_056905'];
    currentTargetState = 2; // default target: COOL
    temperatureKeepAliveInterval;
    temperatureKeepAliveFailureCount = 0;
    serviceLabelButtons;
    constructor(platform, accessory, logger) {
        super(platform, accessory, logger);
        this.platform = platform;
        this.accessory = accessory;
        const device = this.accessory.context.device;
        const { Service: { HeaterCooler, }, } = this.platform;
        this.service = this.accessory.getService(HeaterCooler) || this.accessory.addService(HeaterCooler, device.name);
        this.createHeaterCoolerService();
        this.service.addOptionalCharacteristic(this.platform.customCharacteristics.TotalConsumption);
        if (this.config.ac_air_quality && this.Status.airQuality) {
            this.createAirQualityService();
        }
        else if (this.serviceAirQuality) {
            accessory.removeService(this.serviceAirQuality);
        }
        this.setupTemperatureSensorService(accessory);
        this.setupHumiditySensorService(accessory);
        this.setupLedControlService(accessory);
        this.setupFanControlService(accessory);
        this.setupFeatureSwitchServices(device, accessory);
        this.setupButton(device);
        this.startTemperatureKeepAlive(device);
    }
    configureSwingModeCharacteristic(service) {
        if (!service) {
            return;
        }
        const { SwingMode } = this.platform.Characteristic;
        if (!isSwingModeEnabled(this.config.ac_swing_mode)) {
            if (service.testCharacteristic(SwingMode)) {
                service.removeCharacteristic(service.getCharacteristic(SwingMode));
            }
            return;
        }
        service.getCharacteristic(SwingMode)
            .onGet(this.onlineGet(() => this.Status.isSwingOn ? SwingMode.SWING_ENABLED : SwingMode.SWING_DISABLED))
            .onSet(this.setSwingMode.bind(this))
            .updateValue(this.Status.isSwingOn ? SwingMode.SWING_ENABLED : SwingMode.SWING_DISABLED);
    }
    startTemperatureKeepAlive(device) {
        this.stopTemperatureKeepAlive();
        this.temperatureKeepAliveInterval = setInterval(() => {
            const keepAliveCommand = temperatureKeepAliveCommandForDevice(device);
            if (!keepAliveCommand) {
                return;
            }
            this.platform.ThinQ?.deviceControl(keepAliveCommand.deviceId, keepAliveCommand.payload, keepAliveCommand.command, keepAliveCommand.ctrlKey, keepAliveCommand.ctrlPath).then(success => {
                if (success) {
                    this.temperatureKeepAliveFailureCount = 0;
                    return;
                }
                this.handleTemperatureKeepAliveFailure(device);
            }).catch(error => {
                this.handleTemperatureKeepAliveFailure(device, error);
            });
        }, AIR_CONDITIONER_TEMPERATURE_KEEP_ALIVE_INTERVAL_MS);
        this.platform.api.on('shutdown', () => {
            this.stopTemperatureKeepAlive();
        });
    }
    stopTemperatureKeepAlive() {
        if (this.temperatureKeepAliveInterval) {
            clearInterval(this.temperatureKeepAliveInterval);
            this.temperatureKeepAliveInterval = undefined;
        }
    }
    handleTemperatureKeepAliveFailure(device, error) {
        this.temperatureKeepAliveFailureCount += 1;
        if (this.temperatureKeepAliveFailureCount >= AIR_CONDITIONER_TEMPERATURE_KEEP_ALIVE_MAX_FAILURES) {
            const message = `[${device.name}] AC temperature keep-alive command failed `
                + `${this.temperatureKeepAliveFailureCount} consecutive times; disabling keep-alive for this device.`;
            this.logger.debug(message, error);
            this.stopTemperatureKeepAlive();
            return;
        }
        this.logger.debug(`[${device.name}] AC temperature keep-alive command failed; will retry.`, error);
    }
    setupTemperatureSensorService(accessory) {
        const { Service: { TemperatureSensor, }, Characteristic, } = this.platform;
        this.serviceSensor = accessory.getService(TemperatureSensor);
        if (this.config.ac_temperature_sensor) {
            this.serviceSensor = this.serviceSensor || accessory.addService(TemperatureSensor);
            this.nameSubService(this.serviceSensor, 'Temperature');
            this.serviceSensor.updateCharacteristic(Characteristic.StatusActive, false);
            this.serviceSensor.addLinkedService(this.service);
        }
        else if (this.serviceSensor) {
            accessory.removeService(this.serviceSensor);
            this.serviceSensor = undefined;
        }
    }
    setupHumiditySensorService(accessory) {
        const { Service: { HumiditySensor, }, Characteristic, } = this.platform;
        this.serviceHumiditySensor = accessory.getService(HumiditySensor);
        if (this.config.ac_humidity_sensor) {
            this.serviceHumiditySensor = this.serviceHumiditySensor || accessory.addService(HumiditySensor);
            this.nameSubService(this.serviceHumiditySensor, 'Humidity');
            this.serviceHumiditySensor.updateCharacteristic(Characteristic.StatusActive, false);
            this.serviceHumiditySensor.addLinkedService(this.service);
        }
        else if (this.serviceHumiditySensor) {
            accessory.removeService(this.serviceHumiditySensor);
            this.serviceHumiditySensor = undefined;
        }
    }
    setupLedControlService(accessory) {
        const { Service: { Lightbulb, }, Characteristic, } = this.platform;
        this.serviceLight = accessory.getService(Lightbulb);
        if (this.config.ac_led_control) {
            this.serviceLight = this.serviceLight || accessory.addService(Lightbulb);
            this.nameSubService(this.serviceLight, 'Display Light');
            this.serviceLight.getCharacteristic(Characteristic.On)
                .onSet(this.setLight.bind(this))
                .updateValue(false); // off as default
            this.serviceLight.addLinkedService(this.service);
        }
        else if (this.serviceLight) {
            accessory.removeService(this.serviceLight);
            this.serviceLight = undefined;
        }
    }
    setupFanControlService(accessory) {
        const { Service: { Fanv2, }, } = this.platform;
        this.serviceFanV2 = accessory.getService(Fanv2);
        if (this.config.ac_fan_control) {
            this.createFanService();
        }
        else if (this.serviceFanV2) {
            accessory.removeService(this.serviceFanV2);
            this.serviceFanV2 = undefined;
        }
    }
    setupFeatureSwitchServices(device, accessory) {
        this.setupJetModeService(device, accessory);
        this.setupQuietModeService(device, accessory);
        this.setupEnergySaveService(device, accessory);
        this.setupAirCleanService(device, accessory);
    }
    setupJetModeService(device, accessory) {
        const { Service: { Switch, }, Characteristic, } = this.platform;
        this.serviceJetMode = accessory.getService('Jet Mode');
        if (this.config.ac_jet_control && this.isJetModeEnabled(device.model)) {
            this.serviceJetMode = this.serviceJetMode || accessory.addService(Switch, 'Jet Mode', 'Jet Mode');
            this.nameSubService(this.serviceJetMode, 'Jet Mode');
            this.serviceJetMode.getCharacteristic(Characteristic.On)
                .onSet(this.setJetModeActive.bind(this));
        }
        else if (this.serviceJetMode) {
            accessory.removeService(this.serviceJetMode);
            this.serviceJetMode = undefined;
        }
    }
    setupQuietModeService(device, accessory) {
        const { Service: { Switch, }, Characteristic, } = this.platform;
        this.serviceQuietMode = accessory.getService('Quiet mode');
        if (this.quietModeModels.includes(device.model)) {
            this.serviceQuietMode = this.serviceQuietMode || accessory.addService(Switch, 'Quiet mode', 'Quiet mode');
            this.nameSubService(this.serviceQuietMode, 'Quiet mode');
            this.serviceQuietMode.getCharacteristic(Characteristic.On)
                .onSet(this.setQuietModeActive.bind(this));
        }
        else if (this.serviceQuietMode) {
            accessory.removeService(this.serviceQuietMode);
            this.serviceQuietMode = undefined;
        }
    }
    setupEnergySaveService(device, accessory) {
        const { Service: { Switch, }, Characteristic, } = this.platform;
        this.serviceEnergySaveMode = accessory.getService('Energy save');
        if (this.energySaveModeModels.includes(device.model) && this.config.ac_energy_save) {
            this.serviceEnergySaveMode = this.serviceEnergySaveMode || accessory.addService(Switch, 'Energy save', 'Energy save');
            this.nameSubService(this.serviceEnergySaveMode, 'Energy Save');
            this.serviceEnergySaveMode.getCharacteristic(Characteristic.On)
                .onSet(this.setEnergySaveActive.bind(this));
        }
        else if (this.serviceEnergySaveMode) {
            accessory.removeService(this.serviceEnergySaveMode);
            this.serviceEnergySaveMode = undefined;
        }
    }
    setupAirCleanService(device, accessory) {
        const { Service: { Switch, }, Characteristic, } = this.platform;
        this.serviceAirClean = accessory.getService('Air Purify');
        if (this.airCleanModels.includes(device.model) && this.config.ac_air_clean) {
            this.serviceAirClean = this.serviceAirClean || accessory.addService(Switch, 'Air Purify', 'Air Purify');
            this.nameSubService(this.serviceAirClean, 'Air Purify');
            this.serviceAirClean.getCharacteristic(Characteristic.On)
                .onSet(this.setAirCleanActive.bind(this));
        }
        else if (this.serviceAirClean) {
            accessory.removeService(this.serviceAirClean);
            this.serviceAirClean = undefined;
        }
    }
    createFanService() {
        const { Service: { Fanv2, }, Characteristic, } = this.platform;
        const device = this.accessory.context.device;
        // fan controller
        this.serviceFanV2 = this.accessory.getService(Fanv2) || this.accessory.addService(Fanv2);
        this.nameSubService(this.serviceFanV2, 'Fan');
        this.serviceFanV2.addLinkedService(this.service);
        this.serviceFanV2.getCharacteristic(Characteristic.Active)
            .onGet(this.onlineGet(() => this.Status.isPowerOn ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE))
            .onSet((value) => {
            const isOn = value;
            if ((this.Status.isPowerOn && isOn) || (!this.Status.isPowerOn && !isOn)) {
                return;
            }
            // do not allow change status via home app, revert to prev status in 0.1s
            setTimeout(() => {
                this.serviceFanV2?.updateCharacteristic(Characteristic.Active, this.Status.isPowerOn ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE);
                this.serviceFanV2?.updateCharacteristic(Characteristic.RotationSpeed, this.Status.windStrength);
            }, 100);
        })
            .updateValue(Characteristic.Active.INACTIVE);
        this.serviceFanV2.addOptionalCharacteristic(Characteristic.ConfiguredName);
        this.serviceFanV2.setCharacteristic(Characteristic.ConfiguredName, device.name + ' Fan');
        this.serviceFanV2.getCharacteristic(Characteristic.CurrentFanState)
            .onGet(this.onlineGet(() => this.Status.isPowerOn ? Characteristic.CurrentFanState.BLOWING_AIR : Characteristic.CurrentFanState.INACTIVE))
            .setProps({
            validValues: [Characteristic.CurrentFanState.INACTIVE, Characteristic.CurrentFanState.BLOWING_AIR],
        })
            .updateValue(Characteristic.CurrentFanState.INACTIVE);
        this.serviceFanV2.getCharacteristic(Characteristic.TargetFanState)
            .onSet(this.setFanState.bind(this));
        this.serviceFanV2.getCharacteristic(Characteristic.RotationSpeed)
            .setProps(fanRotationSpeedProps())
            .onSet(this.setFanSpeed.bind(this));
        this.configureSwingModeCharacteristic(this.serviceFanV2);
    }
    createAirQualityService() {
        const { Service: { AirQualitySensor, }, } = this.platform;
        this.serviceAirQuality = this.accessory.getService(AirQualitySensor) || this.accessory.addService(AirQualitySensor);
        this.nameSubService(this.serviceAirQuality, 'Air Quality');
    }
    /**
     * Names a sub-service after what it does, and nothing else.
     *
     * Without both `Name` and `ConfiguredName`, the Home app falls back to a
     * generic label ("Sensor", "Light", "Switch"), which is indistinguishable once
     * an accessory exposes several of them.
     *
     * The device name is deliberately left out. Home gives a tile about fifteen
     * characters and truncates the rest, so prefixing every sub-service with it
     * produces a row of tiles that all read "Air Conditioner..." - the accessory
     * name is the part they share, and the label is the part that got cut. Home
     * already groups the tiles under the accessory, so the prefix buys nothing.
     */
    nameSubService(service, label) {
        const { Characteristic } = this.platform;
        service.setCharacteristic(Characteristic.Name, label);
        service.addOptionalCharacteristic(Characteristic.ConfiguredName);
        service.setCharacteristic(Characteristic.ConfiguredName, label);
    }
    createHeaterCoolerService() {
        const device = this.accessory.context.device;
        const { Characteristic } = this.platform;
        this.service.setCharacteristic(Characteristic.Name, device.name);
        this.service.getCharacteristic(Characteristic.Active)
            .onGet(this.onlineGet(() => this.Status.isPowerOn ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE))
            .onSet(this.setActive.bind(this));
        this.service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .onGet(this.onlineGet(() => {
            const update = heaterCoolerCharacteristicUpdateFromState(this.Status, Characteristic.CurrentHeaterCoolerState, Characteristic.TargetHeaterCoolerState);
            return update?.currentState ?? Characteristic.CurrentHeaterCoolerState.INACTIVE;
        }));
        const targetSetup = targetHeaterCoolerSetupForConfig(this.config.ac_mode, Characteristic.TargetHeaterCoolerState);
        if (targetSetup) {
            this.service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
                .setProps({
                validValues: targetSetup.validValues,
            })
                .updateValue(targetSetup.initialValue);
        }
        this.service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .onGet(this.onlineGet(() => this.currentTargetState))
            .onSet(this.setTargetState.bind(this));
        const status = this.Status;
        if (status.currentTemperature) {
            this.service.updateCharacteristic(Characteristic.CurrentTemperature, status.currentTemperature);
        }
        this.service.getCharacteristic(Characteristic.CurrentTemperature)
            .onGet(this.onlineGet(() => this.Status.currentTemperature));
        const convertTemperature = status.convertTemperatureCelsiusFromLGToHomekit.bind(status);
        const heatingTemperatureProps = temperatureRangePropsFromRange(status.getTemperatureRange(status.getTemperatureRangeForHeating()), convertTemperature);
        if (heatingTemperatureProps) {
            this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .setProps(heatingTemperatureProps);
        }
        const coolingTemperatureProps = temperatureRangePropsFromRange(status.getTemperatureRange(status.getTemperatureRangeForCooling()), convertTemperature);
        if (coolingTemperatureProps) {
            this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
                .setProps(coolingTemperatureProps);
        }
        this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .onGet(this.onlineGet(() => this.Status.targetTemperature))
            .onSet(this.setTargetTemperature.bind(this));
        this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .onGet(this.onlineGet(() => this.Status.targetTemperature))
            .onSet(this.setTargetTemperature.bind(this));
        if (this.config.ac_fan_control) {
            // Fan speed lives on the separate Fanv2 service instead. An accessory
            // restored from cache still carries RotationSpeed here, with whatever
            // props the version that created it used, and nothing configures it now -
            // so drop it rather than leave a second speed slider that is stale from
            // the moment Homebridge starts.
            if (this.service.testCharacteristic(Characteristic.RotationSpeed)) {
                this.service.removeCharacteristic(this.service.getCharacteristic(Characteristic.RotationSpeed));
            }
        }
        else {
            this.service.getCharacteristic(Characteristic.RotationSpeed)
                .setProps(fanRotationSpeedProps())
                .onGet(this.onlineGet(() => this.Status.windStrength))
                .onSet(this.setFanSpeed.bind(this));
        }
        this.configureSwingModeCharacteristic(this.service);
    }
    get config() {
        return {
            ac_swing_mode: 'BOTH',
            ac_air_quality: false,
            ac_mode: 'BOTH',
            ac_temperature_sensor: false,
            ac_humidity_sensor: false,
            ac_led_control: false,
            ac_fan_control: false,
            ac_jet_control: false,
            ac_temperature_unit: 'C',
            ac_buttons: [],
            ac_air_clean: true,
            ac_energy_save: true,
            ...super.config,
        };
    }
    get Status() {
        return new ACStatus(this.accessory.context.device.snapshot, this.accessory.context.device, this.config, this.logger);
    }
    async setCoolModeFeatureActive(value, featureName, errorMessage, dataKey, updateAccessoryCharacteristic) {
        this.requireDeviceOnline();
        const status = this.Status;
        const command = coolModeFeatureCommandFromState(status, value, dataKey);
        if (!command) {
            this.logger.debug(`${featureName} mode is not supported in the current state. Power: ${status.isPowerOn}, Mode: ${status.opMode}`);
            return;
        }
        const device = this.accessory.context.device;
        try {
            await this.platform.ThinQ?.deviceControl(device.id, command.payload);
            for (const [key, snapshotValue] of Object.entries(command.snapshotUpdates)) {
                this.accessory.context.device.data.snapshot[key] = snapshotValue;
            }
            updateAccessoryCharacteristic();
        }
        catch (error) {
            this.logger.error(errorMessage, error);
        }
    }
    /**
     * Sets the energy-saving mode for the air conditioner.
     *
     * @param value - A boolean indicating whether to enable or disable energy-saving mode.
     */
    async setEnergySaveActive(value) {
        await this.setCoolModeFeatureActive(value, 'Energy save', 'Error setting energy save mode:', 'airState.powerSave.basic', this.updateAccessoryenergySaveModeModelsCharacteristic.bind(this));
    }
    /**
     * Sets the air purification mode for the air conditioner.
     *
     * @param value - A boolean indicating whether to enable or disable air purification mode.
     */
    async setAirCleanActive(value) {
        await this.setCoolModeFeatureActive(value, 'Air clean', 'Error setting air clean mode:', 'airState.wMode.airClean', this.updateAccessoryairCleanModelsCharacteristic.bind(this));
    }
    /**
     * Sets the quiet mode for the air conditioner.
     *
     * @param value - A boolean indicating whether to enable or disable quiet mode.
     */
    async setQuietModeActive(value) {
        await this.setCoolModeFeatureActive(value, 'Quiet', 'Error setting quiet mode:', 'airState.miscFuncState.silentAWHP', this.updateAccessoryquietModeModelsCharacteristic.bind(this));
    }
    /**
     * Sets the jet mode active state for the air conditioner device.
     *
     * @param value - The desired state of jet mode, where `true` activates jet mode and `false` deactivates it.
     * @returns The resulting state of jet mode after the operation.
     *
     * @remarks
     * - Jet mode can only be activated if the device is powered on and the operation mode (`opMode`) is set to 0.
     * - If the operation fails, an error is logged, and the method returns the opposite state of the requested value.
     * - If jet mode is not supported in the current state, the method logs a debug message and returns `INACTIVE`.
     *
     * @throws Logs an error if there is an issue with the device control operation.
     */
    async setJetModeActive(value) {
        await this.setCoolModeFeatureActive(value, 'Jet', 'Error setting jet mode:', 'airState.wMode.jet', this.updateAccessoryJetModeCharacteristic.bind(this));
    }
    /**
     * Sets the fan state of the air conditioner to either AUTO or MANUAL mode.
     *
     * @param value - The desired fan state, represented as a `CharacteristicValue`.
     *                It can be either `TargetFanState.AUTO` or `TargetFanState.MANUAL`.
     * @returns The updated fan state, which will match the input value if the operation succeeds,
     *          or the opposite state if the operation fails or the power is off.
     *
     * @remarks
     * - If the air conditioner is powered off, the method logs a debug message and returns
     *   the opposite of the requested fan state.
     * - If the air conditioner is powered on, it attempts to update the fan state via the
     *   ThinQ API. On success, the fan state is updated in the device's context. On failure,
     *   an error is logged, and the opposite fan state is returned.
     * - The AUTO mode corresponds to a wind strength value of 8, while MANUAL mode corresponds
     *   to a high fan speed.
     *
     * @throws This method does not throw errors directly but logs them if the ThinQ API call fails.
     */
    async setFanState(value) {
        this.requireDeviceOnline();
        const status = this.Status;
        if (!status.isPowerOn) {
            this.logger.debug('Power is off, cannot set fan state');
            return;
        }
        const device = this.accessory.context.device;
        const { TargetFanState } = this.platform.Characteristic;
        try {
            const windStrength = windStrengthFromTargetFanState(value, TargetFanState);
            await this.platform.ThinQ?.deviceControl(device.id, {
                dataKey: 'airState.windStrength',
                dataValue: windStrength,
            });
            this.accessory.context.device.data.snapshot['airState.windStrength'] = windStrength;
            this.updateAccessoryFanStateCharacteristics();
            this.updateAccessoryFanV2Characteristic();
        }
        catch (error) {
            this.logger.error('Error setting fan state:', error);
        }
    }
    /**
     * Updates the accessory characteristics based on the current device state.
     *
     * @param device - The device object containing the current state.
     */
    updateAccessoryCharacteristic(device) {
        super.updateAccessoryCharacteristic(device);
        this.updateAccessoryActiveCharacteristic();
        this.updateAccessoryCurrentTemperatureCharacteristic();
        this.updateAccessoryStateCharacteristics();
        this.updateAccessoryTemperatureCharacteristics();
        this.updateAccessoryFanStateCharacteristics();
        this.updateAccessoryTotalConsumptionCharacteristic();
        this.updateAccessoryAirQualityCharacteristic();
        this.updateAccessoryTemperatureSensorCharacteristic();
        this.updateAccessoryHumiditySensorCharacteristic();
        this.updateAccessoryFanV2Characteristic();
        this.updateAccessoryLedControlCharacteristic();
        this.updateAccessoryJetModeCharacteristic();
        this.updateAccessoryquietModeModelsCharacteristic();
        this.updateAccessoryenergySaveModeModelsCharacteristic();
        this.updateAccessoryairCleanModelsCharacteristic();
    }
    /**
     * Updates the "Active" characteristic of the accessory's service to reflect the current power status.
     *
     * This method checks the power status of the device (`isPowerOn`) and updates the "Active" characteristic
     * accordingly. If the device is powered on, the characteristic is set to `ACTIVE`, otherwise it is set to `INACTIVE`.
     */
    updateAccessoryActiveCharacteristic() {
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.Status.isPowerOn ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE);
    }
    /**
     * Updates the `CurrentTemperature` characteristic of the accessory's service
     * with the current temperature value from the device's status.
     *
     * This method ensures that the Homebridge platform reflects the most recent
     * temperature reading from the air conditioner.
     */
    updateAccessoryCurrentTemperatureCharacteristic() {
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.Status.currentTemperature);
    }
    /**
     * Updates the state characteristics of the accessory based on the current status of the air conditioner.
     *
     * This method synchronizes the accessory's characteristics with the current operational state of the air conditioner,
     * including power status, operating mode, and temperature settings. It updates the `CurrentHeaterCoolerState` and
     * `TargetHeaterCoolerState` characteristics accordingly.
     *
     * Behavior:
     * - If the air conditioner is powered off, the state is set to `INACTIVE`.
     * - If the operating mode is `COOL`, the state is set to `COOLING` and the target state to `COOL`.
     * - If the operating mode is `HEAT`, the state is set to `HEATING` and the target state to `HEAT`.
     * - If the operating mode is `AUTO` or undefined (`-1`), the state is determined based on the current and target temperatures:
     *   - If the current temperature is below the target temperature, the state is set to `HEATING` and the target state to `HEAT`.
     *   - Otherwise, the state is set to `COOLING` and the target state to `COOL`.
     * - For other modes, no specific behavior is defined.
     *
     * @remarks
     * This method assumes that the `Status` object contains the necessary properties (`isPowerOn`, `opMode`, `currentTemperature`,
     * and `targetTemperature`) and that the `service` object provides the `updateCharacteristic` method.
     */
    updateAccessoryStateCharacteristics() {
        const update = heaterCoolerCharacteristicUpdateFromState(this.Status, this.platform.Characteristic.CurrentHeaterCoolerState, this.platform.Characteristic.TargetHeaterCoolerState);
        if (!update) {
            return;
        }
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, update.currentState);
        if (update.targetState !== undefined) {
            this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, update.targetState);
        }
    }
    /**
     * Updates the accessory's temperature characteristics based on the current state
     * of the heater or cooler. Depending on whether the device is in heating or cooling
     * mode, it updates the corresponding threshold temperature characteristic.
     *
     * - If the current state is `HEATING`, the `HeatingThresholdTemperature` characteristic
     *   is updated with the target temperature.
     * - If the current state is `COOLING`, the `CoolingThresholdTemperature` characteristic
     *   is updated with the target temperature, and a debug log is generated.
     *
     * @remarks
     * This method relies on the `Status.targetTemperature` property to determine the
     * target temperature and the `CurrentHeaterCoolerState` characteristic to determine
     * the current operating mode of the device.
     */
    updateAccessoryTemperatureCharacteristics() {
        const update = thresholdTemperatureUpdateFromState(this.Status.targetTemperature, this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState).value, this.platform.Characteristic.CurrentHeaterCoolerState);
        if (!update) {
            return;
        }
        if (update.heatingThresholdTemperature !== undefined) {
            this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, update.heatingThresholdTemperature);
        }
        if (update.coolingThresholdTemperature !== undefined) {
            this.logger.debug('Setting cooling target temperature = ', update.coolingThresholdTemperature);
            this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, update.coolingThresholdTemperature);
        }
    }
    /**
     * Updates the fan state characteristics of the accessory.
     *
     * This method updates the `RotationSpeed` and `SwingMode` characteristics
     * of the accessory's service based on the current status of the device.
     *
     * - `RotationSpeed` is updated using the `windStrength` value from the device status.
     * - `SwingMode` is updated based on whether the swing mode is enabled or disabled.
     *
     * @remarks
     * The `SwingMode` characteristic is set to `SWING_ENABLED` if the swing mode is on,
     * otherwise it is set to `SWING_DISABLED`.
     */
    updateAccessoryFanStateCharacteristics() {
        const update = fanCharacteristicUpdateFromState(this.Status, this.platform.Characteristic.SwingMode);
        // With a separate fan service the speed belongs to it, and this service no
        // longer carries the characteristic at all - see createHeaterCoolerService.
        if (!this.config.ac_fan_control) {
            this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, update.rotationSpeed);
        }
        if (isSwingModeEnabled(this.config.ac_swing_mode)) {
            this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, update.swingMode);
        }
    }
    /**
     * Updates the Total Consumption characteristic of the accessory with the current consumption value.
     * This method retrieves the current consumption from the device's status and updates the
     * corresponding custom characteristic in the Homebridge service.
     *
     * @remarks
     * Ensure that the `TotalConsumption` custom characteristic is properly defined in the platform
     * and that the `Status.currentConsumption` value is up-to-date before calling this method.
     */
    updateAccessoryTotalConsumptionCharacteristic() {
        this.service.updateCharacteristic(this.platform.customCharacteristics.TotalConsumption, this.Status.currentConsumption);
    }
    /**
     * Updates the air quality characteristics of the accessory based on the current air quality status.
     * This method checks if the air quality feature is enabled and updates the corresponding characteristics
     * in the Homebridge service with the current air quality readings.
     *
     * @remarks
     * The method updates the `AirQuality`, `PM2_5Density`, and `PM10Density` characteristics if the air quality
     * data is available and the air quality feature is enabled.
     */
    updateAccessoryAirQualityCharacteristic() {
        // air quality
        const update = airQualityCharacteristicUpdateFromState(this.Status, this.config.ac_air_quality);
        if (update && this.serviceAirQuality) {
            this.serviceAirQuality.updateCharacteristic(this.platform.Characteristic.AirQuality, update.airQuality);
            if (update.PM2 !== undefined) {
                this.serviceAirQuality.updateCharacteristic(this.platform.Characteristic.PM2_5Density, update.PM2);
            }
            if (update.PM10 !== undefined) {
                this.serviceAirQuality.updateCharacteristic(this.platform.Characteristic.PM10Density, update.PM10);
            }
        }
    }
    /**
     * Updates the temperature sensor characteristics of the accessory.
     *
     * This method checks if the air conditioner temperature sensor is enabled in the configuration
     * and if the temperature sensor service (`serviceSensor`) is available. If both conditions are met,
     * it updates the following characteristics:
     *
     * - `CurrentTemperature`: Reflects the current temperature reported by the air conditioner.
     * - `StatusActive`: Indicates whether the air conditioner is powered on.
     *
     * @remarks
     * Ensure that the `config.ac_temperature_sensor` is properly set and that the `serviceSensor` is initialized
     * before calling this method to avoid runtime errors.
     */
    updateAccessoryTemperatureSensorCharacteristic() {
        const update = temperatureSensorCharacteristicUpdateFromState(this.Status, this.config.ac_temperature_sensor);
        if (update && this.serviceSensor) {
            this.serviceSensor.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, update.value);
            this.serviceSensor.updateCharacteristic(this.platform.Characteristic.StatusActive, update.statusActive);
        }
    }
    /**
     * Updates the characteristics of the humidity sensor accessory.
     *
     * This method updates the `CurrentRelativeHumidity` and `StatusActive` characteristics
     * of the humidity sensor service if the humidity sensor is enabled in the configuration
     * (`ac_humidity_sensor`) and the `serviceHumiditySensor` is defined.
     *
     * - `CurrentRelativeHumidity` is updated with the current relative humidity value from the device status.
     * - `StatusActive` is updated based on whether the air conditioner is powered on.
     */
    updateAccessoryHumiditySensorCharacteristic() {
        // humidity sensor
        const update = humiditySensorCharacteristicUpdateFromState(this.Status, this.config.ac_humidity_sensor);
        if (update && this.serviceHumiditySensor) {
            this.serviceHumiditySensor.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, update.value);
            this.serviceHumiditySensor.updateCharacteristic(this.platform.Characteristic.StatusActive, update.statusActive);
        }
    }
    /**
     * Updates the characteristics of the Fan V2 service for the accessory.
     *
     * This method synchronizes the accessory's Fan V2 service characteristics with the current
     * status of the air conditioner, including power state, swing mode, wind strength, and
     * whether the fan is in auto or manual mode.
     *
     * The following characteristics are updated:
     * - `Active`: Indicates whether the fan is active or inactive based on the power state.
     * - `TargetFanState`: Sets the fan state to AUTO or MANUAL depending on the wind strength mode.
     * - `RotationSpeed`: Updates the fan's rotation speed if in manual mode.
     * - `SwingMode`: Indicates whether the swing mode is enabled or disabled.
     *
     * This method only performs updates if the `ac_fan_control` configuration is enabled and
     * the `serviceFanV2` is defined.
     */
    updateAccessoryFanV2Characteristic() {
        // handle fan service
        if (this.config.ac_fan_control && this.serviceFanV2) {
            const update = fanV2CharacteristicUpdateFromState(this.Status, this.platform.Characteristic.Active, this.platform.Characteristic.TargetFanState, this.platform.Characteristic.SwingMode);
            this.serviceFanV2.updateCharacteristic(this.platform.Characteristic.Active, update.active);
            this.serviceFanV2.updateCharacteristic(this.platform.Characteristic.TargetFanState, update.targetFanState);
            if (update.rotationSpeed !== undefined) {
                this.serviceFanV2.updateCharacteristic(this.platform.Characteristic.RotationSpeed, update.rotationSpeed);
            }
            if (isSwingModeEnabled(this.config.ac_swing_mode)) {
                this.serviceFanV2.updateCharacteristic(this.platform.Characteristic.SwingMode, update.swingMode);
            }
        }
    }
    /**
     * Updates the LED control characteristic of the accessory.
     *
     * This method checks the current status of the accessory's light and updates
     * the corresponding characteristic in the Homebridge service if the LED control
     * configuration is enabled and the serviceLight is defined.
     *
     * @remarks
     * - The `isLightOn` status is retrieved from the accessory's current status.
     * - The `ac_led_control` configuration determines whether the LED control feature is enabled.
     * - The `serviceLight` represents the Homebridge service responsible for the light characteristic.
     */
    updateAccessoryLedControlCharacteristic() {
        const value = this.config.ac_led_control ? this.Status.isLightOn : undefined;
        if (value !== undefined && this.serviceLight) {
            this.serviceLight.updateCharacteristic(this.platform.Characteristic.On, value);
        }
    }
    updateAccessoryJetModeCharacteristic() {
        // more feature
        const device = this.accessory.context.device;
        const value = modelFeatureToggleValue(device.snapshot, 'airState.wMode.jet', device.model, this.jetModeModels);
        if (value !== undefined && this.serviceJetMode) {
            this.serviceJetMode.updateCharacteristic(this.platform.Characteristic.On, value);
        }
    }
    updateAccessoryquietModeModelsCharacteristic() {
        const device = this.accessory.context.device;
        const value = modelFeatureToggleValue(device.snapshot, 'airState.miscFuncState.silentAWHP', device.model, this.quietModeModels);
        if (value !== undefined && this.serviceQuietMode) {
            this.serviceQuietMode.updateCharacteristic(this.platform.Characteristic.On, value);
        }
    }
    updateAccessoryenergySaveModeModelsCharacteristic() {
        const device = this.accessory.context.device;
        const value = modelFeatureToggleValue(device.snapshot, 'airState.powerSave.basic', device.model, this.energySaveModeModels, this.config.ac_energy_save);
        if (value !== undefined) {
            this.serviceEnergySaveMode?.updateCharacteristic(this.platform.Characteristic.On, value);
        }
    }
    updateAccessoryairCleanModelsCharacteristic() {
        const device = this.accessory.context.device;
        const value = modelFeatureToggleValue(device.snapshot, 'airState.wMode.airClean', device.model, this.airCleanModels, this.config.ac_air_clean);
        if (value !== undefined) {
            this.serviceAirClean?.updateCharacteristic(this.platform.Characteristic.On, value);
        }
    }
    async setLight(value) {
        this.requireDeviceOnline();
        const status = this.Status;
        if (!status.isPowerOn) {
            this.logger.debug('Power is off, cannot set light state');
            return;
        }
        try {
            const device = this.accessory.context.device;
            await this.platform.ThinQ?.deviceControl(device.id, {
                dataKey: 'airState.lightingState.displayControl',
                dataValue: value ? 1 : 0,
            });
            this.accessory.context.device.data.snapshot['airState.lightingState.displayControl'] = value ? 1 : 0;
            this.updateAccessoryLedControlCharacteristic();
        }
        catch (error) {
            this.logger.error('Error setting light state:', error);
        }
    }
    /**
     * Sets the target state of the air conditioner based on the provided HomeKit characteristic value.
     * Maps the HomeKit target states to the corresponding LG operation modes and updates the device state.
     *
     * @param value - The target state value from HomeKit, represented as a `CharacteristicValue`.
     *                Possible values include AUTO, HEAT, and COOL.
     * @returns The updated target state value if successful, or `null` if an error occurs.
     *
     * @throws Logs an error if the operation mode cannot be updated on the device.
     */
    async setTargetState(value) {
        this.requireDeviceOnline();
        this.logger.debug('Set target AC mode = ', value);
        this.currentTargetState = value;
        const { Characteristic: { TargetHeaterCoolerState, }, } = this.platform;
        const opMode = targetOpModeFromHomeKit(value, this.Status.opMode, TargetHeaterCoolerState);
        if (opMode === this.Status.opMode) {
            return;
        }
        try {
            await this.setOpMode(this.accessory.context.device.id, opMode);
        }
        catch (error) {
            this.logger.error('Error setting target state:', error);
        }
    }
    async setActive(value) {
        this.requireDeviceOnline();
        const device = this.accessory.context.device;
        const isOn = normalizeBoolean(value);
        const isOnNumeric = isOn ? 1 : 0;
        this.logger.debug('Set power on = ', isOnNumeric, ' current status = ', this.Status.isPowerOn);
        if ((this.Status.isPowerOn && isOnNumeric === 1) || (!this.Status.isPowerOn && isOnNumeric === 0)) {
            this.logger.debug('Power state already matches incoming value; skipping deviceControl.');
            return;
        }
        try {
            const success = await this.platform.ThinQ?.deviceControl(device.id, {
                dataKey: 'airState.operation',
                dataValue: isOnNumeric,
            }, 'Operation');
            if (success) {
                this.accessory.context.device.data.snapshot['airState.operation'] = isOnNumeric;
                this.updateAccessoryActiveCharacteristic();
            }
        }
        catch (error) {
            this.logger.error('Error setting active state:', error);
        }
    }
    /**
     * Sets the target temperature for the air conditioner.
     *
     * @param value - The desired target temperature as a `CharacteristicValue`.
     *
     * @returns The target temperature if successfully set, or `null` if an error occurs or the operation is invalid.
     *
     * @remarks
     * - If the air conditioner is powered off, the method logs an error and returns `null`.
     * - If the provided value is not a number, the method logs an error and returns `null`.
     * - The method checks whether the target temperature is within the valid range for the current mode
     *   (cooling or heating). If the value is out of range, it logs an error and returns `null`.
     * - If the target temperature is the same as the current temperature, no action is taken, and the method logs a debug message.
     * - The temperature value is converted from HomeKit format to LG format before being sent to the device.
     * - If the operation fails, an error is logged, and the method returns `null`.
     *
     * @throws This method does not throw exceptions but logs errors instead.
     */
    async setTargetTemperature(value) {
        this.requireDeviceOnline();
        const status = this.Status;
        if (!status.isPowerOn) {
            this.logger.error('Power is off, cannot set target temperature');
            return;
        }
        const device = this.accessory.context.device;
        const vNum = normalizeNumber(value);
        if (vNum === null) {
            this.logger.error('Invalid temperature value: ', value);
            return;
        }
        // Calculate LG temperature with the status helper
        const temperatureLG = status.convertTemperatureCelsiusFromHomekitToLG(vNum);
        if (typeof temperatureLG !== 'number' || isNaN(temperatureLG)) {
            this.logger.error('Converted temperature is not a valid number:', temperatureLG);
            return;
        }
        if (temperatureLG === status.targetTemperature) {
            this.logger.debug('Target temperature is identical to current setting; skipping.');
            return;
        }
        try {
            await this.platform.ThinQ?.deviceControl(device.id, {
                dataKey: 'airState.tempState.target',
                dataValue: temperatureLG,
            });
            this.accessory.context.device.data.snapshot['airState.tempState.target'] = temperatureLG;
            this.updateAccessoryTemperatureCharacteristics();
            return;
        }
        catch (error) {
            this.logger.error('Error setting target temperature:', error);
        }
    }
    /**
     * Sets the fan speed of the air conditioner.
     *
     * @param value - The desired fan speed value, which is expected to be a number.
     *                The value is rounded and constrained to a minimum of 1.
     * @returns The provided fan speed value if the operation is successful, or `null` if the power is off
     *          or an error occurs during the operation.
     *
     * @remarks
     * - If the air conditioner is not powered on (`this.Status.isPowerOn` is `false`), the method exits early and returns `null`.
     * - The fan speed value is mapped to a corresponding wind strength value using the `FanSpeed` enumeration.
     * - The method sends a control command to the ThinQ platform to update the fan speed.
     * - If the operation is successful, the updated wind strength value is stored in the device's snapshot.
     * - Any errors encountered during the operation are logged, and the method returns `null`.
     *
     * @throws This method does not throw exceptions directly but logs errors internally if the operation fails.
     */
    async setFanSpeed(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn) {
            return;
        }
        const vNum = normalizeNumber(value);
        if (vNum === null) {
            return;
        }
        const windStrength = windStrengthFromRotationSpeed(vNum);
        if (windStrength === null) {
            return;
        }
        this.logger.debug('Set fan speed = ', Math.max(1, Math.round(vNum)));
        const device = this.accessory.context.device;
        try {
            await this.platform.ThinQ?.deviceControl(device.id, {
                dataKey: 'airState.windStrength',
                dataValue: windStrength,
            });
            this.accessory.context.device.data.snapshot['airState.windStrength'] = windStrength;
        }
        catch (error) {
            this.logger.error('Error setting fan speed:', error);
        }
    }
    async setSwingMode(value) {
        this.requireDeviceOnline();
        if (!isSwingModeEnabled(this.config.ac_swing_mode)) {
            this.logger.debug('Swing mode is disabled in config.');
            return;
        }
        if (!this.Status.isPowerOn) {
            this.logger.debug('Power is off, cannot set swing mode');
            return;
        }
        const device = this.accessory.context.device;
        try {
            for (const swingCommand of swingCommandsForMode(value, this.config.ac_swing_mode)) {
                await this.platform.ThinQ?.deviceControl(device.id, swingCommand.payload, swingCommand.command, swingCommand.ctrlKey);
                for (const [key, snapshotValue] of Object.entries(swingCommand.snapshotUpdates)) {
                    this.accessory.context.device.data.snapshot[key] = snapshotValue;
                }
            }
            this.updateAccessoryFanStateCharacteristics();
            this.updateAccessoryFanV2Characteristic();
        }
        catch (error) {
            this.logger.error('Error setting swing mode:', error);
        }
    }
    async setOpMode(deviceId, opMode) {
        this.requireDeviceOnline();
        return await this.platform.ThinQ?.deviceControl(deviceId, {
            dataKey: 'airState.opMode',
            dataValue: opMode,
        });
    }
    isJetModeEnabled(model) {
        return this.jetModeModels.includes(model); // cool mode only
    }
    setupButton(device) {
        if (!this.config.ac_buttons.length) {
            return;
        }
        this.serviceLabelButtons = this.accessory.getService('Buttons')
            || this.accessory.addService(this.platform.Service.ServiceLabel, 'Buttons', 'Buttons');
        // remove all buttons before
        for (let i = 0; i < this.serviceLabelButtons.linkedServices.length; i++) {
            this.accessory.removeService(this.serviceLabelButtons.linkedServices[i]);
        }
        for (let i = 0; i < this.config.ac_buttons.length; i++) {
            this.setupButtonOpmode(device, this.config.ac_buttons[i].name, parseInt(this.config.ac_buttons[i].op_mode));
        }
    }
    setupButtonOpmode(device, name, opMode) {
        const { Service: { Switch, }, Characteristic, } = this.platform;
        if (!this.serviceLabelButtons) {
            this.logger.error('ServiceLabelButtons not found cant setup button');
            return;
        }
        const serviceButton = this.accessory.getService(name) || this.accessory.addService(Switch, name, name);
        serviceButton.addOptionalCharacteristic(Characteristic.ConfiguredName);
        serviceButton.setCharacteristic(Characteristic.ConfiguredName, name);
        serviceButton.getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.onlineGet(() => {
            return this.Status.opMode === opMode;
        }))
            .onSet((value) => {
            this.handleButtonOpmode(value, opMode);
        });
        this.serviceLabelButtons.addLinkedService(serviceButton);
    }
    /**
     * Handles the operation mode button press for the air conditioner.
     *
     * @param value - The characteristic value indicating the button state (true for pressed, false for released).
     * @param opMode - The operation mode to set when the button is pressed.
     *
     * When the button is pressed (`value` is true) and the current operation mode (`this.Status.opMode`)
     * is different from the provided `opMode`, the method updates the operation mode to the provided `opMode`.
     *
     * When the button is released (`value` is false), the method resets the operation mode to `OpMode.COOL`,
     * updates the accessory state characteristics, and restores the target state to the current target state.
     *
     * @returns A promise that resolves when the operation mode and related states are successfully updated.
     */
    async handleButtonOpmode(value, opMode) {
        this.requireDeviceOnline();
        if (value) {
            if (this.Status.opMode !== opMode) {
                await this.setOpMode(this.accessory.context.device.id, opMode);
                this.accessory.context.device.data.snapshot['airState.opMode'] = opMode;
            }
        }
        else {
            await this.setOpMode(this.accessory.context.device.id, OpMode.COOL);
            this.accessory.context.device.data.snapshot['airState.opMode'] = OpMode.COOL;
            await this.setTargetState(this.currentTargetState);
        }
    }
}
export class ACStatus {
    data;
    device;
    config;
    logger;
    state;
    constructor(data, device, config, logger) {
        this.data = data;
        this.device = device;
        this.config = config;
        this.logger = logger;
        this.data = data ?? {};
        this.state = readAirConditionerState(this.data, device, config, logger);
    }
    /**
     * detect fahrenheit unit device by country code
     * list: us
     */
    get isFahrenheitUnit() {
        return isFahrenheitAirConditioner(this.config);
    }
    /**
     * Converts temperature from Homekit to LG format.
     * @param temperatureInCelsius The temperature in Celsius to convert.
     * @returns The converted temperature in LG format.
     */
    convertTemperatureCelsiusFromHomekitToLG(temperatureInCelsius) {
        return convertTemperatureCelsiusFromHomekitToLG(temperatureInCelsius, this.device, this.config, this.logger);
    }
    /**
     * algorithm conversion LG vs Homekit is different
     * so we need to handle it before submit to homekit
     */
    convertTemperatureCelsiusFromLGToHomekit(temperature) {
        return convertTemperatureCelsiusFromLGToHomekit(temperature, this.device, this.config, this.logger);
    }
    get opMode() {
        return this.state.opMode;
    }
    get isPowerOn() {
        return this.state.isPowerOn;
    }
    get currentRelativeHumidity() {
        return this.state.currentRelativeHumidity;
    }
    get currentTemperature() {
        return this.state.currentTemperature;
    }
    get targetTemperature() {
        return this.state.targetTemperature;
    }
    get airQuality() {
        return this.state.airQuality;
    }
    // Should return 0 - 100 int
    get windStrength() {
        return this.state.windStrength;
    }
    get isWindStrengthAuto() {
        return this.state.isWindStrengthAuto;
    }
    get isSwingOn() {
        return this.state.isSwingOn;
    }
    get isLightOn() {
        return this.state.isLightOn;
    }
    get currentConsumption() {
        return this.state.currentConsumption;
    }
    get type() {
        return this.state.type;
    }
    /**
     * Retrieves the temperature range based on the provided minimum and maximum range values.
     *
     * @param [minRange, maxRange] - A tuple containing the minimum and maximum range values as `EnumValue` objects.
     * @returns A `RangeValue` object representing the temperature range, including its type, minimum, maximum, and step values.
     *
     * The method first attempts to calculate the temperature range using the provided `minRange` and `maxRange` values.
     * If these values are not sufficient to determine a valid range, it falls back to retrieving the range from the device model's
     * `airState.tempState.limitMin` or `airState.tempState.target` properties.
     */
    getTemperatureRange([minRange, maxRange]) {
        let temperature = {
            type: ValueType.Range,
            min: 0,
            max: 0,
            step: 0.01,
        };
        if (minRange && maxRange) {
            const minRangeOptions = Object.values(minRange.options).filter((v) => typeof v === 'number');
            const maxRangeOptions = Object.values(maxRange.options).filter((v) => typeof v === 'number');
            if (minRangeOptions.length > 1) {
                temperature.min = Math.min(...minRangeOptions.filter(v => v !== 0));
            }
            if (maxRangeOptions.length > 1) {
                temperature.max = Math.max(...maxRangeOptions.filter(v => v !== 0));
            }
        }
        if (!temperature || !temperature.min || !temperature.max) {
            temperature = this.device.deviceModel.value('airState.tempState.limitMin');
        }
        if (!temperature || !temperature.min || !temperature.max) {
            temperature = this.device.deviceModel.value('airState.tempState.target');
        }
        return temperature;
    }
    /**
     * Retrieves the temperature range for heating based on the air conditioner's model type.
     *
     * For AWHP models, the range is determined using water temperature heating limits.
     * For other models, the range is determined using general heating limits.
     *
     * @returns A tuple containing two `EnumValue` objects:
     *          - The first element represents the minimum heating temperature.
     *          - The second element represents the maximum heating temperature.
     */
    getTemperatureRangeForHeating() {
        let heatLowLimitKey, heatHighLimitKey;
        if (this.type === ACModelType.AWHP) {
            heatLowLimitKey = 'support.airState.tempState.waterTempHeatMin';
            heatHighLimitKey = 'support.airState.tempState.waterTempHeatMax';
        }
        else {
            heatLowLimitKey = 'support.heatLowLimit';
            heatHighLimitKey = 'support.heatHighLimit';
        }
        const tempHeatMinRange = this.device.deviceModel.value(heatLowLimitKey);
        const tempHeatMaxRange = this.device.deviceModel.value(heatHighLimitKey);
        return [tempHeatMinRange, tempHeatMaxRange];
    }
    /**
     * Retrieves the temperature range for cooling based on the air conditioner's model type.
     *
     * For AWHP models, the range is determined using water temperature cooling limits.
     * For other models, the range is determined using general cooling limits.
     *
     * @returns A tuple containing two `EnumValue` objects:
     *          - The first element represents the minimum cooling temperature.
     *          - The second element represents the maximum cooling temperature.
     */
    getTemperatureRangeForCooling() {
        let coolLowLimitKey, coolHighLimitKey;
        if (this.type === ACModelType.AWHP) {
            coolLowLimitKey = 'support.airState.tempState.waterTempCoolMin';
            coolHighLimitKey = 'support.airState.tempState.waterTempCoolMax';
        }
        else {
            coolLowLimitKey = 'support.coolLowLimit';
            coolHighLimitKey = 'support.coolHighLimit';
        }
        const tempCoolMinRange = this.device.deviceModel.value(coolLowLimitKey);
        const tempCoolMaxRange = this.device.deviceModel.value(coolHighLimitKey);
        return [tempCoolMinRange, tempCoolMaxRange];
    }
}
//# sourceMappingURL=AirConditioner.js.map