import { BaseDevice } from '../baseDevice.js';
import { hasSnapshotKey, snapshotBoolean, snapshotNumber, updateCharacteristicIfChanged } from './helpers.js';
export var RotateSpeed;
(function (RotateSpeed) {
    RotateSpeed[RotateSpeed["LOW"] = 2] = "LOW";
    RotateSpeed[RotateSpeed["MEDIUM"] = 4] = "MEDIUM";
    RotateSpeed[RotateSpeed["HIGH"] = 6] = "HIGH";
    RotateSpeed[RotateSpeed["EXTRA"] = 7] = "EXTRA";
})(RotateSpeed || (RotateSpeed = {}));
function rotationSpeedFromWindStrength(windStrength) {
    const index = Object.keys(RotateSpeed).indexOf(windStrength.toString());
    return index !== -1 ? index + 1 : Object.keys(RotateSpeed).length / 2;
}
function readLightState(snapshot, isPowerOn) {
    if (hasSnapshotKey(snapshot, 'airState.lightingState.signal')) {
        return isPowerOn && snapshotBoolean(snapshot, 'airState.lightingState.signal');
    }
    if (hasSnapshotKey(snapshot, 'airState.lightingState.displayControl')) {
        return isPowerOn && snapshotBoolean(snapshot, 'airState.lightingState.displayControl');
    }
    return false;
}
export function readAirPurifierState(snapshot) {
    const isPowerOn = snapshotBoolean(snapshot, 'airState.operation');
    const windStrength = snapshotNumber(snapshot, 'airState.windStrength');
    const filterMaxTime = snapshotNumber(snapshot, 'airState.filterMngStates.maxTime');
    const filterUseTime = snapshotNumber(snapshot, 'airState.filterMngStates.useTime');
    return {
        isPowerOn,
        isLightOn: readLightState(snapshot, isPowerOn),
        isSwing: snapshotBoolean(snapshot, 'airState.circulate.rotate'),
        airQuality: {
            isOn: isPowerOn || snapshotBoolean(snapshot, 'airState.quality.sensorMon'),
            overall: snapshotNumber(snapshot, 'airState.quality.overall'),
            PM2: snapshotNumber(snapshot, 'airState.quality.PM2'),
            PM10: snapshotNumber(snapshot, 'airState.quality.PM10'),
        },
        rotationSpeed: rotationSpeedFromWindStrength(windStrength),
        windStrength,
        isNormalMode: snapshotNumber(snapshot, 'airState.opMode') === 14,
        filterUsedTimePercent: filterMaxTime ? Math.round((1 - (filterUseTime / filterMaxTime)) * 100) : 0,
        filterMaxTime,
        filterUseTime,
        isAirFastEnable: snapshotBoolean(snapshot, 'airState.miscFuncState.airFast'),
    };
}
// opMode = 14 => normal mode, can rotate speed
export default class AirPurifier extends BaseDevice {
    platform;
    accessory;
    serviceAirPurifier;
    serviceAirQuality;
    serviceLight;
    serviceFilterMaintenance;
    serviceAirFastMode;
    constructor(platform, accessory, logger) {
        super(platform, accessory, logger);
        this.platform = platform;
        this.accessory = accessory;
        const { Service: { AirPurifier, AirQualitySensor, Lightbulb, FilterMaintenance, Switch, }, Characteristic, } = this.platform;
        const device = accessory.context.device;
        // get the service if it exists, otherwise create a new service
        // you can create multiple services for each accessory
        this.serviceAirPurifier = accessory.getService(AirPurifier);
        if (!this.serviceAirPurifier) {
            this.serviceAirPurifier = accessory.addService(AirPurifier, 'Air Purifier', 'Air Purifier');
            this.serviceAirPurifier.addOptionalCharacteristic(Characteristic.ConfiguredName);
            this.serviceAirPurifier.updateCharacteristic(Characteristic.ConfiguredName, 'Air Purifier');
        }
        /**
         * Required Characteristics: Active, CurrentAirPurifierState, TargetAirPurifierState
         */
        this.serviceAirPurifier.getCharacteristic(Characteristic.Active)
            .onGet(this.onlineGet(() => {
            return this.Status.isPowerOn ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
        }))
            .onSet(this.setActive.bind(this));
        this.serviceAirPurifier.getCharacteristic(Characteristic.CurrentAirPurifierState)
            .onGet(this.onlineGet(() => {
            return this.Status.isPowerOn
                ? Characteristic.CurrentAirPurifierState.PURIFYING_AIR
                : Characteristic.CurrentAirPurifierState.INACTIVE;
        }));
        this.serviceAirPurifier.getCharacteristic(Characteristic.TargetAirPurifierState)
            .onGet(this.onlineGet(() => {
            return this.Status.isNormalMode ? Characteristic.TargetAirPurifierState.MANUAL : Characteristic.TargetAirPurifierState.AUTO;
        }))
            .onSet(this.setTargetAirPurifierState.bind(this));
        /**
         * Optional Characteristics: Name, RotationSpeed, SwingMode
         */
        this.serviceAirPurifier.setCharacteristic(Characteristic.Name, device.name);
        this.serviceAirPurifier.getCharacteristic(Characteristic.SwingMode)
            .onGet(this.onlineGet(() => this.Status.isSwing ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED))
            .onSet(this.setSwingMode.bind(this));
        this.serviceAirPurifier.getCharacteristic(Characteristic.RotationSpeed)
            .onGet(this.onlineGet(() => this.Status.rotationSpeed))
            .onSet(this.setRotationSpeed.bind(this))
            .setProps({ minValue: 0, maxValue: Object.keys(RotateSpeed).length / 2, minStep: 0.1 });
        this.serviceAirQuality = accessory.getService(AirQualitySensor) || accessory.addService(AirQualitySensor);
        this.serviceAirQuality.getCharacteristic(Characteristic.AirQuality)
            .onGet(this.onlineGet(() => this.Status.airQuality.overall));
        this.serviceAirQuality.getCharacteristic(Characteristic.PM2_5Density)
            .onGet(this.onlineGet(() => this.Status.airQuality.PM2));
        this.serviceAirQuality.getCharacteristic(Characteristic.PM10Density)
            .onGet(this.onlineGet(() => this.Status.airQuality.PM10));
        this.serviceAirQuality.getCharacteristic(Characteristic.StatusActive)
            .onGet(this.onlineGet(() => this.Status.airQuality.isOn));
        // check if light is available
        const snapshot = device.snapshot ?? {};
        if ('airState.lightingState.displayControl' in snapshot || 'airState.lightingState.signal' in snapshot) {
            this.serviceLight = accessory.getService(Lightbulb);
            if (!this.serviceLight) {
                this.serviceLight = accessory.addService(Lightbulb, device.name + ' - Light');
                this.serviceLight.addOptionalCharacteristic(Characteristic.ConfiguredName);
                this.serviceLight.updateCharacteristic(Characteristic.ConfiguredName, 'Light');
            }
            this.serviceLight.getCharacteristic(Characteristic.On)
                .onGet(this.onlineGet(() => this.Status.isLightOn))
                .onSet(this.setLight.bind(this));
        }
        if (this.Status.filterMaxTime) {
            this.serviceFilterMaintenance = accessory.getService(FilterMaintenance);
            if (!this.serviceFilterMaintenance) {
                this.serviceFilterMaintenance = accessory.addService(FilterMaintenance, 'Filter Maintenance', 'Filter Maintenance');
                this.serviceFilterMaintenance.addOptionalCharacteristic(Characteristic.ConfiguredName);
                this.serviceFilterMaintenance.updateCharacteristic(Characteristic.ConfiguredName, 'Filter Maintenance');
            }
            this.serviceFilterMaintenance.updateCharacteristic(Characteristic.Name, 'Filter Maintenance');
            this.serviceAirPurifier.addLinkedService(this.serviceFilterMaintenance);
        }
        this.serviceAirFastMode = accessory.getService('Air Fast');
        if (this.config.air_fast_mode) {
            if (!this.serviceAirFastMode) {
                this.serviceAirFastMode = accessory.addService(Switch, 'Air Fast', 'Air Fast');
                this.serviceAirFastMode.addOptionalCharacteristic(Characteristic.ConfiguredName);
                this.serviceAirFastMode.updateCharacteristic(Characteristic.ConfiguredName, 'Air Fast');
            }
            this.serviceAirFastMode.updateCharacteristic(Characteristic.Name, 'Air Fast');
            this.serviceAirFastMode.getCharacteristic(Characteristic.On)
                .onGet(this.onlineGet(() => this.Status.isAirFastEnable))
                .onSet(this.setAirFastActive.bind(this));
        }
        else if (this.serviceAirFastMode) {
            accessory.removeService(this.serviceAirFastMode);
        }
    }
    get Status() {
        return readAirPurifierState(this.accessory.context.device.snapshot);
    }
    get config() {
        return Object.assign({}, {
            air_fast_mode: false,
        }, super.config);
    }
    async setAirFastActive(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn) {
            return;
        }
        const device = this.accessory.context.device;
        const isOn = value ? 1 : 0;
        await this.platform.ThinQ?.deviceControl(device.id, {
            dataKey: 'airState.miscFuncState.airFast',
            dataValue: isOn,
        });
        device.data.snapshot['airState.miscFuncState.airFast'] = isOn;
        this.updateAccessoryCharacteristic(device);
    }
    async setActive(value) {
        this.requireDeviceOnline();
        const device = this.accessory.context.device;
        const isOn = value ? 1 : 0;
        if (this.Status.isPowerOn && isOn) {
            return; // don't send same status
        }
        this.platform.log.debug('Set Active State ->', value);
        await this.platform.ThinQ?.deviceControl(device.id, {
            dataKey: 'airState.operation',
            dataValue: isOn,
        });
        device.data.snapshot['airState.operation'] = isOn;
        this.updateAccessoryCharacteristic(device);
    }
    async setTargetAirPurifierState(value) {
        this.requireDeviceOnline();
        const device = this.accessory.context.device;
        if (!this.Status.isPowerOn || (!!value !== this.Status.isNormalMode)) {
            return; // just skip it
        }
        this.platform.log.debug('Set Target State ->', value);
        await this.platform.ThinQ?.deviceControl(device.id, {
            dataKey: 'airState.opMode',
            dataValue: value ? 16 : 14,
        });
    }
    async setRotationSpeed(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn || !this.Status.isNormalMode) {
            return;
        }
        this.platform.log.debug('Set Rotation Speed ->', value);
        const device = this.accessory.context.device;
        const values = Object.keys(RotateSpeed);
        const windStrength = parseInt(values[Math.round(value) - 1]) || RotateSpeed.EXTRA;
        await this.platform.ThinQ?.deviceControl(device.id, {
            dataKey: 'airState.windStrength',
            dataValue: windStrength,
        });
        device.data.snapshot['airState.windStrength'] = windStrength;
        this.updateAccessoryCharacteristic(device);
    }
    async setSwingMode(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn || !this.Status.isNormalMode) {
            return;
        }
        const device = this.accessory.context.device;
        const isSwing = value ? 1 : 0;
        await this.platform.ThinQ?.deviceControl(device.id, {
            dataKey: 'airState.circulate.rotate',
            dataValue: isSwing,
        });
        device.data.snapshot['airState.circulate.rotate'] = isSwing;
        this.updateAccessoryCharacteristic(device);
    }
    async setLight(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn) {
            return;
        }
        const device = this.accessory.context.device;
        const isLightOn = value ? 1 : 0;
        const snapshot = device.snapshot ?? {};
        let dataKey = '';
        if ('airState.lightingState.signal' in snapshot) {
            dataKey = 'airState.lightingState.signal';
        }
        else if ('airState.lightingState.displayControl' in snapshot) {
            dataKey = 'airState.lightingState.displayControl';
        }
        if (!dataKey) {
            return;
        }
        await this.platform.ThinQ?.deviceControl(device.id, {
            dataKey,
            dataValue: isLightOn,
        });
        device.data.snapshot[dataKey] = isLightOn;
        this.updateAccessoryCharacteristic(device);
    }
    updateAccessoryCharacteristic(device) {
        super.updateAccessoryCharacteristic(device);
        const { Characteristic, Characteristic: { TargetAirPurifierState, FilterChangeIndication, }, } = this.platform;
        updateCharacteristicIfChanged(this.serviceAirPurifier, Characteristic.Active, this.Status.isPowerOn ? 1 : 0);
        updateCharacteristicIfChanged(this.serviceAirPurifier, Characteristic.CurrentAirPurifierState, this.Status.isPowerOn ? 2 : 0);
        updateCharacteristicIfChanged(this.serviceAirPurifier, TargetAirPurifierState, this.Status.isNormalMode ? TargetAirPurifierState.MANUAL : TargetAirPurifierState.AUTO);
        updateCharacteristicIfChanged(this.serviceAirPurifier, Characteristic.SwingMode, this.Status.isSwing ? 1 : 0);
        updateCharacteristicIfChanged(this.serviceAirPurifier, Characteristic.RotationSpeed, this.Status.rotationSpeed);
        if (this.Status.filterMaxTime && this.serviceFilterMaintenance) {
            updateCharacteristicIfChanged(this.serviceFilterMaintenance, Characteristic.FilterLifeLevel, this.Status.filterUsedTimePercent);
            updateCharacteristicIfChanged(this.serviceFilterMaintenance, FilterChangeIndication, this.Status.filterUsedTimePercent > 95 ? FilterChangeIndication.CHANGE_FILTER : FilterChangeIndication.FILTER_OK);
        }
        // airState.quality.sensorMon = 1 mean sensor always running even device not running
        updateCharacteristicIfChanged(this.serviceAirQuality, Characteristic.AirQuality, this.Status.airQuality.overall);
        updateCharacteristicIfChanged(this.serviceAirQuality, Characteristic.PM2_5Density, this.Status.airQuality.PM2);
        updateCharacteristicIfChanged(this.serviceAirQuality, Characteristic.PM10Density, this.Status.airQuality.PM10);
        updateCharacteristicIfChanged(this.serviceAirQuality, Characteristic.StatusActive, this.Status.airQuality.isOn);
        if (this.serviceLight) {
            updateCharacteristicIfChanged(this.serviceLight, Characteristic.On, this.Status.isLightOn);
        }
        if (this.config.air_fast_mode && this.serviceAirFastMode) {
            updateCharacteristicIfChanged(this.serviceAirFastMode, Characteristic.On, this.Status.isAirFastEnable);
        }
    }
}
export class AirPurifierStatus {
    state;
    constructor(data) {
        this.state = readAirPurifierState(data);
    }
    get isPowerOn() {
        return this.state.isPowerOn;
    }
    get isLightOn() {
        return this.state.isLightOn;
    }
    get isSwing() {
        return this.state.isSwing;
    }
    get airQuality() {
        return this.state.airQuality;
    }
    get rotationSpeed() {
        return this.state.rotationSpeed;
    }
    get windStrength() {
        return this.state.windStrength;
    }
    get isNormalMode() {
        return this.state.isNormalMode;
    }
    get filterUsedTimePercent() {
        return this.state.filterUsedTimePercent;
    }
    get filterMaxTime() {
        return this.state.filterMaxTime;
    }
    get filterUseTime() {
        return this.state.filterUseTime;
    }
    get isAirFastEnable() {
        return this.state.isAirFastEnable;
    }
}
//# sourceMappingURL=AirPurifier.js.map