import { describe, expect, jest, test } from '@jest/globals';
import {
  createMqttReconnectState,
  MQTT_MAX_RECONNECT_DELAY_MS,
  MQTT_OFFLINE_RECONNECT_DELAY_MS,
  mqttReconnectDelayMs,
  MqttRuntimeDevice,
  stopMqttReconnect,
  wireMqttDeviceEvents,
} from './mqttConnection.js';

type HandlerMap = {
  error?: (err: unknown) => void;
  connect?: () => void;
  message?: (topic: string, payload: Buffer) => void;
  offline?: () => void;
};

class FakeMqttDevice implements MqttRuntimeDevice {
  public handlers: HandlerMap = {};
  public subscribe = jest.fn();
  public end = jest.fn();

  on(event: keyof HandlerMap, handler: any): unknown {
    this.handlers[event] = handler;
    return this;
  }
}

function fakeLogger() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
}

describe('MQTT runtime event wiring', () => {
  test('subscribes to all topics on connect', () => {
    const device = new FakeMqttDevice();
    const logger = fakeLogger();

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: ['topic-a', 'topic-b'],
      onMessage: jest.fn(),
      reconnect: jest.fn(async () => undefined),
    });

    device.handlers.connect?.();

    expect(logger.info).toHaveBeenCalledWith('Successfully connected to the MQTT server.');
    expect(logger.debug).toHaveBeenCalledWith('mqtt connected:', 'mqtt://server');
    expect(device.subscribe).toHaveBeenNthCalledWith(1, 'topic-a');
    expect(device.subscribe).toHaveBeenNthCalledWith(2, 'topic-b');
  });

  test('logs MQTT runtime errors', () => {
    const device = new FakeMqttDevice();
    const logger = fakeLogger();
    const error = new Error('mqtt down');

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: [],
      onMessage: jest.fn(),
      reconnect: jest.fn(async () => undefined),
    });

    device.handlers.error?.(error);

    expect(logger.error).toHaveBeenCalledWith('mqtt err:', error);
  });

  test('parses JSON messages and logs the raw payload', () => {
    const device = new FakeMqttDevice();
    const logger = fakeLogger();
    const onMessage = jest.fn();

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: [],
      onMessage,
      reconnect: jest.fn(async () => undefined),
    });

    device.handlers.message?.('topic-a', Buffer.from('{"state":"on"}'));

    expect(onMessage).toHaveBeenCalledWith({ state: 'on' });
    expect(logger.debug).toHaveBeenCalledWith('mqtt message received:', '{"state":"on"}');
  });

  test('logs invalid JSON messages without emitting an update', () => {
    const device = new FakeMqttDevice();
    const logger = fakeLogger();
    const onMessage = jest.fn();

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: [],
      onMessage,
      reconnect: jest.fn(async () => undefined),
    });

    device.handlers.message?.('topic-a', Buffer.from('not-json'));

    expect(onMessage).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('mqtt message parse error:', expect.any(SyntaxError));
    expect(logger.debug).toHaveBeenCalledWith('mqtt invalid message received:', 'not-json');
  });

  test('ends offline devices and schedules reconnect', () => {
    const device = new FakeMqttDevice();
    const logger = fakeLogger();
    const reconnect = jest.fn(async () => undefined);
    const scheduleReconnect = jest.fn((handler: () => void | Promise<void>, delayMs: number) => {
      void handler;
      void delayMs;
    });

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: [],
      onMessage: jest.fn(),
      reconnect,
      scheduleReconnect,
    });

    device.handlers.offline?.();

    expect(device.end).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('reconnecting in 60 seconds'));
    expect(scheduleReconnect).toHaveBeenCalledWith(expect.any(Function), MQTT_OFFLINE_RECONNECT_DELAY_MS);
  });

  test('scheduled offline reconnect calls the supplied reconnect function', async () => {
    const device = new FakeMqttDevice();
    const logger = fakeLogger();
    const reconnect = jest.fn(async () => undefined);
    let scheduledHandler: (() => void | Promise<void>) | undefined;
    const scheduleReconnect = jest.fn((handler: () => void | Promise<void>) => {
      scheduledHandler = handler;
    });

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: [],
      onMessage: jest.fn(),
      reconnect,
      scheduleReconnect,
    });

    device.handlers.offline?.();
    await scheduledHandler?.();

    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  test('keeps retrying when a reconnect attempt fails', async () => {
    // The device has already been ended, so no further 'offline' event will
    // arrive. If a failed attempt did not schedule the next one, MQTT would stay
    // dead until Homebridge restarted — the symptom after any outage longer than
    // the first retry delay.
    const device = new FakeMqttDevice();
    const logger = fakeLogger();
    const reconnectError = new Error('still offline');
    const reconnect = jest.fn(async () => {
      throw reconnectError;
    });
    const scheduled: { handler: () => void | Promise<void>; delayMs: number }[] = [];
    const scheduleReconnect = jest.fn((handler: () => void | Promise<void>, delayMs: number) => {
      scheduled.push({ handler, delayMs });
    });

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: [],
      onMessage: jest.fn(),
      reconnect,
      scheduleReconnect,
    });

    device.handlers.offline?.();
    await scheduled[0].handler();

    expect(logger.error).toHaveBeenCalledWith('mqtt reconnect failed:', reconnectError);
    expect(scheduled).toHaveLength(2);

    await scheduled[1].handler();
    expect(reconnect).toHaveBeenCalledTimes(2);
    expect(scheduled).toHaveLength(3);
  });

  test('backs off exponentially, capped, across repeated failures', async () => {
    const device = new FakeMqttDevice();
    const logger = fakeLogger();
    const reconnect = jest.fn(async () => {
      throw new Error('still offline');
    });
    const scheduled: { handler: () => void | Promise<void>; delayMs: number }[] = [];
    const scheduleReconnect = jest.fn((handler: () => void | Promise<void>, delayMs: number) => {
      scheduled.push({ handler, delayMs });
    });

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: [],
      onMessage: jest.fn(),
      reconnect,
      scheduleReconnect,
    });

    device.handlers.offline?.();
    for (let i = 0; i < 8; i++) {
      await scheduled[i].handler();
    }

    expect(scheduled.map(entry => entry.delayMs).slice(0, 5))
      .toEqual([60000, 120000, 240000, 480000, MQTT_MAX_RECONNECT_DELAY_MS]);
    expect(scheduled.every(entry => entry.delayMs <= MQTT_MAX_RECONNECT_DELAY_MS)).toBe(true);
  });

  test('resets the backoff once the connection comes back', async () => {
    const device = new FakeMqttDevice();
    const logger = fakeLogger();
    const state = createMqttReconnectState();
    const scheduled: { handler: () => void | Promise<void>; delayMs: number }[] = [];
    const scheduleReconnect = jest.fn((handler: () => void | Promise<void>, delayMs: number) => {
      scheduled.push({ handler, delayMs });
    });

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: [],
      onMessage: jest.fn(),
      reconnect: jest.fn(async () => {
        throw new Error('still offline');
      }),
      scheduleReconnect,
      state,
    });

    device.handlers.offline?.();
    await scheduled[0].handler();
    expect(scheduled[1].delayMs).toBe(120000);

    device.handlers.connect?.();
    expect(state.attempt).toBe(0);
  });

  test('drops duplicate offline events instead of stacking reconnect chains', () => {
    const device = new FakeMqttDevice();
    const logger = fakeLogger();
    const scheduleReconnect = jest.fn();

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: [],
      onMessage: jest.fn(),
      reconnect: jest.fn(async () => undefined),
      scheduleReconnect,
    });

    device.handlers.offline?.();
    device.handlers.offline?.();
    device.handlers.offline?.();

    expect(scheduleReconnect).toHaveBeenCalledTimes(1);
  });

  test('a superseded connection cannot disturb the live one', () => {
    const state = createMqttReconnectState();
    const logger = fakeLogger();
    const scheduleReconnect = jest.fn();
    const oldDevice = new FakeMqttDevice();
    const newDevice = new FakeMqttDevice();

    const wire = (device: FakeMqttDevice) => wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: ['topic-a'],
      onMessage: jest.fn(),
      reconnect: jest.fn(async () => undefined),
      scheduleReconnect,
      state,
    });

    wire(oldDevice);
    wire(newDevice);

    // The stale device going offline must not schedule a reconnect, and its late
    // 'connect' must not re-subscribe on a connection that has been replaced.
    oldDevice.handlers.offline?.();
    oldDevice.handlers.connect?.();

    expect(scheduleReconnect).not.toHaveBeenCalled();
    expect(oldDevice.subscribe).not.toHaveBeenCalled();

    newDevice.handlers.offline?.();
    expect(scheduleReconnect).toHaveBeenCalledTimes(1);
  });

  test('stops retrying after shutdown', async () => {
    const device = new FakeMqttDevice();
    const logger = fakeLogger();
    const state = createMqttReconnectState();
    const reconnect = jest.fn(async () => undefined);
    const scheduled: (() => void | Promise<void>)[] = [];
    const scheduleReconnect = jest.fn((handler: () => void | Promise<void>) => {
      scheduled.push(handler);
    });

    wireMqttDeviceEvents({
      device,
      logger,
      mqttServer: 'mqtt://server',
      subscriptions: [],
      onMessage: jest.fn(),
      reconnect,
      scheduleReconnect,
      state,
    });

    device.handlers.offline?.();
    stopMqttReconnect(state);
    await scheduled[0]();

    expect(reconnect).not.toHaveBeenCalled();

    device.handlers.offline?.();
    expect(scheduleReconnect).toHaveBeenCalledTimes(1);
  });
});

describe('mqttReconnectDelayMs', () => {
  test('doubles per attempt and caps', () => {
    expect(mqttReconnectDelayMs(0)).toBe(60000);
    expect(mqttReconnectDelayMs(1)).toBe(120000);
    expect(mqttReconnectDelayMs(3)).toBe(480000);
    expect(mqttReconnectDelayMs(50)).toBe(MQTT_MAX_RECONNECT_DELAY_MS);
  });
});
