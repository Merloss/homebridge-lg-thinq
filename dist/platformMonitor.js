import { ManualProcessNeeded } from './errors/index.js';
import { PlatformType } from './lib/constants.js';
export function accessoriesForPlatform(accessories, platform) {
    return accessories.filter(accessory => accessory.context.device.platform === platform);
}
export function hasEnabledThinQ1Accessories(accessories, enableThinQ1) {
    return enableThinQ1 && accessoriesForPlatform(accessories, PlatformType.ThinQ1).length > 0;
}
export async function pollThinQ2Devices(options) {
    const { thinq, events } = options;
    const devices = await thinq.devices();
    devices.filter(device => device.platform === PlatformType.ThinQ2).forEach(device => {
        events.emit(device.id, device.snapshot);
    });
}
export function emitThinQ2MqttUpdate(events, data) {
    if (typeof data !== 'object' || data === null || !('data' in data) || !('deviceId' in data)) {
        return;
    }
    const message = data;
    events.emit(message.deviceId, message.data?.state?.reported);
}
export async function pollThinQ1Accessories(options) {
    const { thinq, accessories, events, enableThinQ1, log } = options;
    for (const accessory of accessories) {
        const device = accessory.context.device;
        if (device.platform !== PlatformType.ThinQ1 || !enableThinQ1) {
            continue;
        }
        try {
            const deviceWithSnapshot = await thinq.pollMonitor(device);
            const snapshot = deviceWithSnapshot.snapshot;
            if (snapshot && snapshot.raw !== null) {
                events.emit(device.id, snapshot);
            }
        }
        catch (err) {
            // ManualProcessNeeded must reach the caller so it can stop the poll loop
            // entirely; every other device error is isolated so one unreachable
            // appliance cannot stop the rest of the account from updating.
            if (err instanceof ManualProcessNeeded) {
                throw err;
            }
            log?.debug('[' + device.name + '] ThinQ1 poll failed:', err);
        }
    }
}
export function removeMonitorInterval(monitorIntervals, interval) {
    const intervalIndex = monitorIntervals.indexOf(interval);
    if (intervalIndex >= 0) {
        monitorIntervals.splice(intervalIndex, 1);
    }
}
export function handleThinQ1PollError(options) {
    const { err, log, interval, monitorIntervals } = options;
    if (!(err instanceof ManualProcessNeeded)) {
        log.debug('ThinQ1 polling failed:', err);
        return false;
    }
    log.info('Stop polling device data.');
    log.warn(err.message);
    clearInterval(interval);
    removeMonitorInterval(monitorIntervals, interval);
    return true;
}
export async function startThinQ2Monitor(options) {
    const { log, thinq, events, intervalTime, mqttFallbackIntervalTime, monitorIntervals } = options;
    log.info('Start MQTT listener for ThinQ2 devices');
    // MQTT is registered before the poll timer so we know whether polling is the
    // primary update path or just a slow reconciliation pass. Polling at the full
    // rate on top of a working push channel is what drove accounts into HTTP 429.
    const mqttConnected = await thinq.registerMQTTListener((data) => {
        emitThinQ2MqttUpdate(events, data);
    });
    const pollInterval = mqttConnected ? mqttFallbackIntervalTime : intervalTime;
    if (mqttConnected) {
        log.debug('MQTT push is active; polling ThinQ2 devices every ' + Math.round(pollInterval / 1000) + 's as a fallback.');
    }
    else {
        log.warn('MQTT push channel unavailable. Falling back to polling ThinQ2 devices every '
            + Math.round(pollInterval / 1000) + 's.');
    }
    const thinq2Interval = setInterval(() => {
        pollThinQ2Devices({ thinq, events }).catch(err => {
            log.debug('ThinQ2 polling failed:', err);
        });
    }, pollInterval);
    thinq2Interval.unref?.();
    monitorIntervals.push(thinq2Interval);
    return mqttConnected;
}
export function startThinQ1Monitor(options) {
    const { log, thinq, accessories, events, intervalTime, refreshInterval, enableThinQ1, monitorIntervals, } = options;
    const configuredRefreshInterval = Number(refreshInterval);
    const refreshSeconds = Number.isFinite(configuredRefreshInterval) && configuredRefreshInterval > 0
        ? configuredRefreshInterval
        : intervalTime / 1000;
    log.info('Start polling device data every ' + refreshSeconds + ' seconds.');
    const interval = setInterval(async () => {
        try {
            await pollThinQ1Accessories({
                thinq,
                accessories,
                events,
                enableThinQ1,
                log,
            });
        }
        catch (err) {
            handleThinQ1PollError({
                err,
                log,
                interval,
                monitorIntervals,
            });
        }
    }, intervalTime);
    interval.unref?.();
    monitorIntervals.push(interval);
}
export function clearMonitorIntervals(monitorIntervals) {
    while (monitorIntervals.length) {
        const interval = monitorIntervals.pop();
        if (interval) {
            clearInterval(interval);
        }
    }
}
//# sourceMappingURL=platformMonitor.js.map