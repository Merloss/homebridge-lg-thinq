import { AccessoryContext, BaseDevice } from '../baseDevice.js';
import { LGThinQHomebridgePlatform } from '../platform.js';
import { CharacteristicValue, Logger, PlatformAccessory, Service } from 'homebridge';
import { Device } from '../lib/Device.js';
import { EnumValue, RangeValue } from '../lib/DeviceModel.js';
export declare enum ACModelType {
    AWHP = "AWHP",
    RAC = "RAC"
}
export declare const FAN_SPEED_AUTO = 8;
export declare const AIR_CONDITIONER_TEMPERATURE_KEEP_ALIVE_INTERVAL_MS = 60000;
export declare const AIR_CONDITIONER_TEMPERATURE_KEEP_ALIVE_MAX_FAILURES = 3;
export declare enum FanSpeed {
    LOW = 2,
    LOW_MEDIUM = 3,
    MEDIUM = 4,
    MEDIUM_HIGH = 5,
    HIGH = 6
}
export type Config = {
    ac_swing_mode: string;
    ac_air_quality: boolean;
    ac_mode: string;
    ac_temperature_sensor: boolean;
    ac_humidity_sensor: boolean;
    ac_led_control: boolean;
    ac_fan_control: boolean;
    ac_jet_control: boolean;
    ac_temperature_unit: string;
    ac_buttons: {
        name: string;
        op_mode: string;
    }[];
    ac_air_clean: boolean;
    ac_energy_save: boolean;
};
export type AirConditionerAirQualityState = {
    isOn: boolean;
    overall: number;
    PM2: number;
    PM10: number;
};
export type AirConditionerState = {
    opMode: number;
    isPowerOn: boolean;
    currentRelativeHumidity: number;
    currentTemperature: number;
    targetTemperature: number;
    airQuality: AirConditionerAirQualityState | null;
    windStrength: number;
    isWindStrengthAuto: boolean;
    isSwingOn: boolean;
    isLightOn: boolean;
    currentConsumption: number;
    type: ACModelType | string;
};
export type AirConditionerTargetHeaterCoolerStateValues = {
    AUTO: number;
    HEAT: number;
    COOL: number;
};
export type AirConditionerCurrentHeaterCoolerStateValues = {
    INACTIVE: number;
    HEATING: number;
    COOLING: number;
};
export type AirConditionerTargetFanStateValues = {
    AUTO: number;
    MANUAL?: number;
};
export type AirConditionerActiveValues = {
    ACTIVE: number;
    INACTIVE: number;
};
export type AirConditionerSwingModeValues = {
    SWING_ENABLED: number;
    SWING_DISABLED: number;
};
export type AirConditionerCommandPayload = {
    dataKey: string | null;
    dataValue: CharacteristicValue | null;
    dataSetList?: Record<string, unknown> | null;
    dataGetList?: unknown;
};
export type AirConditionerSwingCommand = {
    payload: AirConditionerCommandPayload;
    command?: 'Set' | 'Operation';
    ctrlKey?: string;
    snapshotUpdates: Record<string, string>;
};
export type AirConditionerFeatureCommand = {
    payload: {
        dataKey: string;
        dataValue: number;
    };
    snapshotUpdates: Record<string, number>;
};
export type AirConditionerKeepAliveCommand = {
    deviceId: string;
    payload: AirConditionerCommandPayload;
    command: 'Set';
    ctrlKey: string;
    ctrlPath: string;
};
export type AirConditionerHeaterCoolerCharacteristicUpdate = {
    currentState: number;
    targetState?: number;
};
export type AirConditionerFanCharacteristicUpdate = {
    rotationSpeed: number;
    swingMode: number;
};
export type AirConditionerFanV2CharacteristicUpdate = {
    active: number;
    targetFanState: number;
    rotationSpeed?: number;
    swingMode: number;
};
export type AirConditionerAirQualityCharacteristicUpdate = {
    airQuality: number;
    PM2?: number;
    PM10?: number;
};
export type AirConditionerSensorCharacteristicUpdate = {
    value: number;
    statusActive: boolean;
};
export type AirConditionerThresholdTemperatureUpdate = {
    heatingThresholdTemperature?: number;
    coolingThresholdTemperature?: number;
};
export type AirConditionerTargetHeaterCoolerSetup = {
    validValues: number[];
    initialValue: number;
};
export type AirConditionerTemperatureRangeProps = {
    minValue: number;
    maxValue: number;
    minStep: number;
};
export type AirConditionerFanRotationSpeedProps = {
    minValue: number;
    maxValue: number;
    minStep: number;
};
export declare function readAirConditionerState(data: any, device: Device, config: Config, logger: Logger): AirConditionerState;
export declare function targetOpModeFromHomeKit(value: CharacteristicValue, currentOpMode: number, targetState: AirConditionerTargetHeaterCoolerStateValues): number;
export declare function targetHeaterCoolerSetupForConfig(acMode: string, targetState: AirConditionerTargetHeaterCoolerStateValues): AirConditionerTargetHeaterCoolerSetup | null;
export declare function temperatureRangePropsFromRange(range: RangeValue | null | undefined, convertTemperature: (temperature: number) => number): AirConditionerTemperatureRangeProps | null;
export declare function fanRotationSpeedProps(): AirConditionerFanRotationSpeedProps;
export declare function heaterCoolerCharacteristicUpdateFromState(state: Pick<AirConditionerState, 'isPowerOn' | 'opMode' | 'currentTemperature' | 'targetTemperature'>, currentState: AirConditionerCurrentHeaterCoolerStateValues, targetState: AirConditionerTargetHeaterCoolerStateValues): AirConditionerHeaterCoolerCharacteristicUpdate | null;
export declare function windStrengthFromTargetFanState(value: CharacteristicValue, targetFanState: AirConditionerTargetFanStateValues): number;
export declare function fanCharacteristicUpdateFromState(state: Pick<AirConditionerState, 'windStrength' | 'isSwingOn'>, swingMode: AirConditionerSwingModeValues): AirConditionerFanCharacteristicUpdate;
export declare function fanV2CharacteristicUpdateFromState(state: Pick<AirConditionerState, 'isPowerOn' | 'isSwingOn' | 'windStrength' | 'isWindStrengthAuto'>, active: AirConditionerActiveValues, targetFanState: Required<AirConditionerTargetFanStateValues>, swingMode: AirConditionerSwingModeValues): AirConditionerFanV2CharacteristicUpdate;
export declare function isSwingModeEnabled(swingMode: string): boolean;
export declare function airQualityCharacteristicUpdateFromState(state: Pick<AirConditionerState, 'airQuality'>, enabled?: boolean): AirConditionerAirQualityCharacteristicUpdate | null;
export declare function temperatureSensorCharacteristicUpdateFromState(state: Pick<AirConditionerState, 'currentTemperature' | 'isPowerOn'>, enabled?: boolean): AirConditionerSensorCharacteristicUpdate | null;
export declare function humiditySensorCharacteristicUpdateFromState(state: Pick<AirConditionerState, 'currentRelativeHumidity' | 'isPowerOn'>, enabled?: boolean): AirConditionerSensorCharacteristicUpdate | null;
export declare function thresholdTemperatureUpdateFromState(targetTemperature: number, currentStateValue: CharacteristicValue | null | undefined, currentState: AirConditionerCurrentHeaterCoolerStateValues): AirConditionerThresholdTemperatureUpdate | null;
export declare function windStrengthFromRotationSpeed(value: CharacteristicValue): number | null;
export declare function swingCommandsForMode(value: CharacteristicValue, swingMode: string): AirConditionerSwingCommand[];
export declare function featureToggleValue(snapshot: Record<string, unknown> | undefined, snapshotKey: string, enabled?: boolean): boolean | undefined;
export declare function modelFeatureToggleValue(snapshot: Record<string, unknown> | undefined, snapshotKey: string, model: string, enabledModels: readonly string[], enabled?: boolean): boolean | undefined;
export declare function coolModeFeatureCommandFromState(state: Pick<AirConditionerState, 'isPowerOn' | 'opMode'>, value: CharacteristicValue, dataKey: string): AirConditionerFeatureCommand | null;
export declare function temperatureKeepAliveCommandForDevice(device: Pick<Device, 'id' | 'online'>): AirConditionerKeepAliveCommand | null;
/**
 * Represents an LG ThinQ Air Conditioner device.
 * This class extends the `baseDevice` class and provides functionality to control and monitor
 * various features of an air conditioner, such as temperature, fan speed, swing mode, and more.
 */
export default class AirConditioner extends BaseDevice {
    readonly platform: LGThinQHomebridgePlatform;
    readonly accessory: PlatformAccessory<AccessoryContext>;
    protected service: Service;
    protected serviceAirQuality: Service | undefined;
    protected serviceSensor: Service | undefined;
    protected serviceHumiditySensor: Service | undefined;
    protected serviceLight: Service | undefined;
    protected serviceFanV2: Service | undefined;
    protected serviceJetMode: Service | undefined;
    protected serviceQuietMode: Service | undefined;
    protected serviceEnergySaveMode: Service | undefined;
    protected serviceAirClean: Service | undefined;
    protected jetModeModels: string[];
    protected quietModeModels: string[];
    protected energySaveModeModels: string[];
    protected airCleanModels: string[];
    protected currentTargetState: number;
    private temperatureKeepAliveInterval;
    private temperatureKeepAliveFailureCount;
    protected serviceLabelButtons: Service | undefined;
    constructor(platform: LGThinQHomebridgePlatform, accessory: PlatformAccessory<AccessoryContext>, logger: Logger);
    private configureSwingModeCharacteristic;
    private startTemperatureKeepAlive;
    private stopTemperatureKeepAlive;
    private handleTemperatureKeepAliveFailure;
    private setupTemperatureSensorService;
    private setupHumiditySensorService;
    private setupLedControlService;
    private setupFanControlService;
    private setupFeatureSwitchServices;
    private setupJetModeService;
    private setupQuietModeService;
    private setupEnergySaveService;
    private setupAirCleanService;
    protected createFanService(): void;
    protected createAirQualityService(): void;
    /**
     * Gives a sub-service a stable, device-prefixed name.
     *
     * Without both `Name` and `ConfiguredName`, the Home app falls back to a
     * generic label ("Sensor", "Light", "Switch"), which is indistinguishable once
     * an accessory exposes several of them.
     */
    protected nameSubService(service: Service, label: string): void;
    protected createHeaterCoolerService(): void;
    get config(): Config;
    get Status(): ACStatus;
    private setCoolModeFeatureActive;
    /**
     * Sets the energy-saving mode for the air conditioner.
     *
     * @param value - A boolean indicating whether to enable or disable energy-saving mode.
     */
    setEnergySaveActive(value: CharacteristicValue): Promise<void>;
    /**
     * Sets the air purification mode for the air conditioner.
     *
     * @param value - A boolean indicating whether to enable or disable air purification mode.
     */
    setAirCleanActive(value: CharacteristicValue): Promise<void>;
    /**
     * Sets the quiet mode for the air conditioner.
     *
     * @param value - A boolean indicating whether to enable or disable quiet mode.
     */
    setQuietModeActive(value: CharacteristicValue): Promise<void>;
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
    setJetModeActive(value: CharacteristicValue): Promise<void>;
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
    setFanState(value: CharacteristicValue): Promise<void>;
    /**
     * Updates the accessory characteristics based on the current device state.
     *
     * @param device - The device object containing the current state.
     */
    updateAccessoryCharacteristic(device: Device): void;
    /**
     * Updates the "Active" characteristic of the accessory's service to reflect the current power status.
     *
     * This method checks the power status of the device (`isPowerOn`) and updates the "Active" characteristic
     * accordingly. If the device is powered on, the characteristic is set to `ACTIVE`, otherwise it is set to `INACTIVE`.
     */
    updateAccessoryActiveCharacteristic(): void;
    /**
     * Updates the `CurrentTemperature` characteristic of the accessory's service
     * with the current temperature value from the device's status.
     *
     * This method ensures that the Homebridge platform reflects the most recent
     * temperature reading from the air conditioner.
     */
    updateAccessoryCurrentTemperatureCharacteristic(): void;
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
    updateAccessoryStateCharacteristics(): void;
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
    updateAccessoryTemperatureCharacteristics(): void;
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
    updateAccessoryFanStateCharacteristics(): void;
    /**
     * Updates the Total Consumption characteristic of the accessory with the current consumption value.
     * This method retrieves the current consumption from the device's status and updates the
     * corresponding custom characteristic in the Homebridge service.
     *
     * @remarks
     * Ensure that the `TotalConsumption` custom characteristic is properly defined in the platform
     * and that the `Status.currentConsumption` value is up-to-date before calling this method.
     */
    updateAccessoryTotalConsumptionCharacteristic(): void;
    /**
     * Updates the air quality characteristics of the accessory based on the current air quality status.
     * This method checks if the air quality feature is enabled and updates the corresponding characteristics
     * in the Homebridge service with the current air quality readings.
     *
     * @remarks
     * The method updates the `AirQuality`, `PM2_5Density`, and `PM10Density` characteristics if the air quality
     * data is available and the air quality feature is enabled.
     */
    updateAccessoryAirQualityCharacteristic(): void;
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
    updateAccessoryTemperatureSensorCharacteristic(): void;
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
    updateAccessoryHumiditySensorCharacteristic(): void;
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
    updateAccessoryFanV2Characteristic(): void;
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
    updateAccessoryLedControlCharacteristic(): void;
    updateAccessoryJetModeCharacteristic(): void;
    updateAccessoryquietModeModelsCharacteristic(): void;
    updateAccessoryenergySaveModeModelsCharacteristic(): void;
    updateAccessoryairCleanModelsCharacteristic(): void;
    setLight(value: CharacteristicValue): Promise<void>;
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
    setTargetState(value: CharacteristicValue): Promise<void>;
    setActive(value: CharacteristicValue): Promise<void>;
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
    setTargetTemperature(value: CharacteristicValue): Promise<void>;
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
    setFanSpeed(value: CharacteristicValue): Promise<void>;
    setSwingMode(value: CharacteristicValue): Promise<void>;
    setOpMode(deviceId: string, opMode: number): Promise<boolean>;
    protected isJetModeEnabled(model: string): boolean;
    setupButton(device: Device): void;
    protected setupButtonOpmode(device: Device, name: string, opMode: number): void;
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
    handleButtonOpmode(value: CharacteristicValue, opMode: number): Promise<void>;
}
export declare class ACStatus {
    protected data: any;
    protected device: Device;
    protected config: Config;
    private logger;
    private readonly state;
    constructor(data: any, device: Device, config: Config, logger: Logger);
    /**
     * detect fahrenheit unit device by country code
     * list: us
     */
    get isFahrenheitUnit(): boolean;
    /**
     * Converts temperature from Homekit to LG format.
     * @param temperatureInCelsius The temperature in Celsius to convert.
     * @returns The converted temperature in LG format.
     */
    convertTemperatureCelsiusFromHomekitToLG(temperatureInCelsius: CharacteristicValue): number;
    /**
     * algorithm conversion LG vs Homekit is different
     * so we need to handle it before submit to homekit
     */
    convertTemperatureCelsiusFromLGToHomekit(temperature: number): number;
    get opMode(): number;
    get isPowerOn(): boolean;
    get currentRelativeHumidity(): number;
    get currentTemperature(): number;
    get targetTemperature(): number;
    get airQuality(): AirConditionerAirQualityState | null;
    get windStrength(): number;
    get isWindStrengthAuto(): boolean;
    get isSwingOn(): boolean;
    get isLightOn(): boolean;
    get currentConsumption(): number;
    get type(): string;
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
    getTemperatureRange([minRange, maxRange]: [EnumValue, EnumValue]): RangeValue;
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
    getTemperatureRangeForHeating(): [EnumValue, EnumValue];
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
    getTemperatureRangeForCooling(): [EnumValue, EnumValue];
}
