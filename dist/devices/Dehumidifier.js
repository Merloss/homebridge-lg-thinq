import { BaseDevice } from '../baseDevice.js';
import { snapshotBoolean, snapshotNumber, updateCharacteristicIfChanged } from './helpers.js';
var RotateSpeed;
(function (RotateSpeed) {
    RotateSpeed[RotateSpeed["LOW"] = 2] = "LOW";
    RotateSpeed[RotateSpeed["HIGH"] = 6] = "HIGH";
})(RotateSpeed || (RotateSpeed = {}));
function rotationSpeedFromWindStrength(windStrength) {
    const index = Object.keys(RotateSpeed).indexOf(windStrength.toString());
    return index !== -1 ? index + 1 : Object.keys(RotateSpeed).length / 2;
}
export function readDehumidifierState(snapshot) {
    const isPowerOn = snapshotBoolean(snapshot, 'airState.operation');
    const opMode = snapshotNumber(snapshot, 'airState.opMode');
    const windStrength = snapshotNumber(snapshot, 'airState.windStrength');
    const humidityCurrent = snapshotNumber(snapshot, 'airState.humidity.current');
    const humidityTarget = snapshotNumber(snapshot, 'airState.humidity.desired');
    return {
        isPowerOn,
        opMode,
        windStrength,
        isDehumidifying: [17, 18, 19, 21].includes(opMode) && humidityCurrent >= humidityTarget,
        humidityCurrent,
        humidityTarget,
        rotationSpeed: rotationSpeedFromWindStrength(windStrength),
        isWaterTankFull: snapshotBoolean(snapshot, 'airState.notificationExt'),
    };
}
export default class Dehumidifier extends BaseDevice {
    platform;
    accessory;
    serviceDehumidifier;
    serviceHumiditySensor;
    constructor(platform, accessory, logger) {
        super(platform, accessory, logger);
        this.platform = platform;
        this.accessory = accessory;
        const { Service: { HumidifierDehumidifier, HumiditySensor, }, Characteristic, Characteristic: { CurrentHumidifierDehumidifierState, }, } = this.platform;
        const device = accessory.context.device;
        this.serviceDehumidifier = accessory.getService(HumidifierDehumidifier) || accessory.addService(HumidifierDehumidifier);
        this.serviceDehumidifier.setCharacteristic(Characteristic.Name, device.name);
        this.serviceDehumidifier.getCharacteristic(Characteristic.Active)
            .onGet(this.onlineGet(() => this.Status.isPowerOn ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE))
            .onSet(this.setActive.bind(this))
            .updateValue(Characteristic.Active.INACTIVE);
        this.serviceDehumidifier.getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
            .onGet(this.onlineGet(() => {
            if (!this.Status.isPowerOn) {
                return CurrentHumidifierDehumidifierState.INACTIVE;
            }
            return this.Status.isDehumidifying ? CurrentHumidifierDehumidifierState.DEHUMIDIFYING : CurrentHumidifierDehumidifierState.IDLE;
        }))
            .setProps({
            validValues: [
                CurrentHumidifierDehumidifierState.INACTIVE,
                CurrentHumidifierDehumidifierState.IDLE,
                CurrentHumidifierDehumidifierState.DEHUMIDIFYING,
            ],
        })
            .updateValue(Characteristic.CurrentHumidifierDehumidifierState.INACTIVE);
        this.serviceDehumidifier.getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
            .setProps({
            validValues: [2],
        })
            .updateValue(Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER);
        this.serviceDehumidifier.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .onGet(this.onlineGet(() => this.Status.humidityCurrent));
        this.serviceDehumidifier.getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold)
            .onGet(this.onlineGet(() => this.Status.humidityTarget))
            .onSet(this.setHumidityThreshold.bind(this))
            .setProps({
            minValue: 0,
            maxValue: 100,
            minStep: 1,
        });
        this.serviceDehumidifier.getCharacteristic(Characteristic.RotationSpeed)
            .onGet(this.onlineGet(() => this.Status.rotationSpeed))
            .onSet(this.setSpeed.bind(this))
            .setProps({
            minValue: 1,
            maxValue: Object.keys(RotateSpeed).length / 2,
            minStep: 1,
        });
        this.serviceDehumidifier.getCharacteristic(Characteristic.WaterLevel)
            .onGet(this.onlineGet(() => this.Status.isWaterTankFull ? 100 : 0));
        this.serviceHumiditySensor = accessory.getService(HumiditySensor) || accessory.addService(HumiditySensor);
        this.serviceHumiditySensor.addLinkedService(this.serviceDehumidifier);
        this.serviceHumiditySensor.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .onGet(this.onlineGet(() => this.Status.humidityCurrent));
        this.serviceHumiditySensor.getCharacteristic(Characteristic.StatusActive)
            .onGet(this.onlineGet(() => this.Status.isPowerOn));
    }
    async setActive(value) {
        this.requireDeviceOnline();
        this.platform.log.debug('Set Dehumidifier Active State ->', value);
        const device = this.accessory.context.device;
        const isOn = value;
        if (this.Status.isPowerOn && isOn) {
            return; // don't send same status
        }
        await this.platform.ThinQ?.deviceControl(device.id, {
            dataKey: 'airState.operation',
            dataValue: isOn,
        });
        device.data.snapshot['airState.operation'] = isOn ? 1 : 0;
        this.updateAccessoryCharacteristic(device);
    }
    async setHumidityThreshold(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn) {
            return;
        }
        const device = this.accessory.context.device;
        await this.platform.ThinQ?.deviceControl(device.id, {
            dataKey: 'airState.humidity.desired',
            dataValue: value,
        });
        device.data.snapshot['airState.humidity.desired'] = value;
        this.updateAccessoryCharacteristic(device);
    }
    async setSpeed(value) {
        this.requireDeviceOnline();
        if (!this.Status.isPowerOn) {
            return;
        }
        const device = this.accessory.context.device;
        const values = Object.keys(RotateSpeed);
        const windStrength = parseInt(values[Math.round(value) - 1]) || RotateSpeed.HIGH;
        await this.platform.ThinQ?.deviceControl(device.id, {
            dataKey: 'airState.windStrength',
            dataValue: windStrength,
        });
        device.data.snapshot['airState.windStrength'] = windStrength;
        this.updateAccessoryCharacteristic(device);
    }
    updateAccessoryCharacteristic(device) {
        super.updateAccessoryCharacteristic(device);
        const { Characteristic, Characteristic: { CurrentHumidifierDehumidifierState: { INACTIVE, IDLE, DEHUMIDIFYING, }, }, } = this.platform;
        updateCharacteristicIfChanged(this.serviceDehumidifier, Characteristic.Active, this.Status.isPowerOn ? 1 : 0);
        updateCharacteristicIfChanged(this.serviceDehumidifier, Characteristic.CurrentRelativeHumidity, this.Status.humidityCurrent);
        updateCharacteristicIfChanged(this.serviceDehumidifier, Characteristic.RelativeHumidityDehumidifierThreshold, this.Status.humidityTarget);
        const currentState = this.Status.isPowerOn ? (this.Status.isDehumidifying ? DEHUMIDIFYING : IDLE) : INACTIVE;
        updateCharacteristicIfChanged(this.serviceDehumidifier, Characteristic.CurrentHumidifierDehumidifierState, currentState);
        updateCharacteristicIfChanged(this.serviceDehumidifier, Characteristic.RotationSpeed, this.Status.rotationSpeed);
        updateCharacteristicIfChanged(this.serviceDehumidifier, Characteristic.WaterLevel, this.Status.isWaterTankFull ? 100 : 0);
        updateCharacteristicIfChanged(this.serviceHumiditySensor, Characteristic.CurrentRelativeHumidity, this.Status.humidityCurrent);
        updateCharacteristicIfChanged(this.serviceHumiditySensor, Characteristic.StatusActive, this.Status.isPowerOn);
    }
    get Status() {
        return readDehumidifierState(this.accessory.context.device.snapshot);
    }
}
export class DehumidifierStatus {
    state;
    constructor(data) {
        this.state = readDehumidifierState(data);
    }
    get isPowerOn() {
        return this.state.isPowerOn;
    }
    get opMode() {
        return this.state.opMode;
    }
    get windStrength() {
        return this.state.windStrength;
    }
    get isDehumidifying() {
        return this.state.isDehumidifying;
    }
    get humidityCurrent() {
        return this.state.humidityCurrent;
    }
    get humidityTarget() {
        return this.state.humidityTarget;
    }
    get rotationSpeed() {
        return this.state.rotationSpeed;
    }
    get isWaterTankFull() {
        return this.state.isWaterTankFull;
    }
}
//# sourceMappingURL=Dehumidifier.js.map