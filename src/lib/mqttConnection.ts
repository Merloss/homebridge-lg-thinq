export const MQTT_OFFLINE_RECONNECT_DELAY_MS = 60000;
export const MQTT_MAX_RECONNECT_DELAY_MS = 600000;

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

export type MqttReconnectScheduler = (
  handler: () => void | Promise<void>,
  delayMs: number,
) => unknown;

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

export function createMqttReconnectState(): MqttReconnectState {
  return { generation: 0, pending: false, attempt: 0, stopped: false };
}

export function stopMqttReconnect(state: MqttReconnectState): void {
  state.stopped = true;
  state.pending = false;
}

export function mqttReconnectDelayMs(attempt: number): number {
  const delay = MQTT_OFFLINE_RECONNECT_DELAY_MS * Math.pow(2, Math.max(0, attempt));
  return Math.min(delay, MQTT_MAX_RECONNECT_DELAY_MS);
}

export function wireMqttDeviceEvents(options: {
  device: MqttRuntimeDevice;
  logger: MqttRuntimeLogger;
  mqttServer: string;
  subscriptions: string[];
  onMessage: (data: any) => void;
  reconnect: () => Promise<void>;
  scheduleReconnect?: MqttReconnectScheduler;
  state?: MqttReconnectState;
}): void {
  const {
    device,
    logger,
    mqttServer,
    subscriptions,
    onMessage,
    reconnect,
    scheduleReconnect = (handler, delayMs) => {
      const timer = setTimeout(handler, delayMs);
      (timer as { unref?: () => void }).unref?.();
      return timer;
    },
    state = createMqttReconnectState(),
  } = options;

  const generation = ++state.generation;

  /** True once a newer connection has been wired, or the platform is shutting down. */
  const isStale = () => state.stopped || state.generation !== generation;

  /**
   * Schedules the next reconnect attempt.
   *
   * The retry chain must be self-sustaining: the device has already been ended,
   * so no further 'offline' event will arrive to prompt another try. Previously
   * a failed attempt was only logged, which left MQTT dead until Homebridge was
   * restarted whenever an outage outlasted the single 60s retry.
   */
  const scheduleRetry = () => {
    if (state.pending || isStale()) {
      return;
    }

    state.pending = true;
    const delay = mqttReconnectDelayMs(state.attempt);
    state.attempt++;

    logger.info('MQTT disconnected, reconnecting in ' + Math.round(delay / 1000)
      + ' seconds (attempt ' + state.attempt + ').');

    scheduleReconnect(async () => {
      state.pending = false;

      if (isStale()) {
        return;
      }

      try {
        await reconnect();
      } catch (err) {
        logger.error('mqtt reconnect failed:', err);
        // Keep trying; the network may still be down.
        scheduleRetry();
      }
    }, delay);
  };

  device.on('error', (err) => {
    logger.error('mqtt err:', err);
  });

  device.on('connect', () => {
    if (isStale()) {
      return;
    }

    state.attempt = 0;
    logger.info('Successfully connected to the MQTT server.');
    logger.debug('mqtt connected:', mqttServer);
    for (const subscription of subscriptions) {
      device.subscribe(subscription);
    }
  });

  device.on('message', (_topic, payload) => {
    const payloadText = payload.toString();
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payloadText);
    } catch (err) {
      logger.error('mqtt message parse error:', err);
      logger.debug('mqtt invalid message received:', payloadText);
      return;
    }

    onMessage(parsedPayload);
    logger.debug('mqtt message received:', payloadText);
  });

  device.on('offline', () => {
    device.end();

    if (isStale()) {
      // A superseded connection going offline must not disturb the live one.
      return;
    }

    scheduleRetry();
  });
}
