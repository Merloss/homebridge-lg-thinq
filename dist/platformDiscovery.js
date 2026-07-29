import { Helper } from './helper.js';
import { NotConnectedError, RateLimitError } from './errors/index.js';
import { PlatformType } from './lib/constants.js';
import { isDeviceEnabled } from './platformConfig.js';
export const DISCOVERY_RETRY_DELAY_MS = 30000;
export const DISCOVERY_RATE_LIMIT_DELAY_MS = 300000;
export const MAX_DISCOVERY_RETRY_DELAY_MS = 900000;
const defaultDeviceAccessoryResolver = {
    make: device => Helper.make(device),
    category: device => Helper.category(device),
};
export function isRetryableDiscoveryError(err) {
    return err instanceof NotConnectedError || err instanceof RateLimitError;
}
/**
 * Delay before the next discovery attempt. Retrying a throttled account every
 * 30s just extends the throttle, so rate limiting backs off much further and
 * honours `Retry-After` when LG provides it.
 */
export function discoveryRetryDelayMs(err, attempt = 1) {
    if (!(err instanceof RateLimitError)) {
        return DISCOVERY_RETRY_DELAY_MS;
    }
    const base = err.retryAfterMs !== null && err.retryAfterMs > 0
        ? err.retryAfterMs
        : DISCOVERY_RATE_LIMIT_DELAY_MS;
    return Math.min(base * Math.max(1, attempt), MAX_DISCOVERY_RETRY_DELAY_MS);
}
export function unregisterUnsupportedDevice(options) {
    const { log, thinq, device } = options;
    log.info('Device not supported: ' + device.platform + ': ' + device.toString());
    thinq.unregister(device).then(() => {
        log.debug(device.id, '- unregistered!');
    }).catch(err => {
        log.debug(device.id, '- unregister failed:', err);
    });
}
export async function prepareDiscoveredDevice(options) {
    const { log, config, enableThinQ1, thinq, device, accessoryResolver = defaultDeviceAccessoryResolver, } = options;
    if (!enableThinQ1 && device.platform === PlatformType.ThinQ1) {
        log.debug('Thinq1 device is skipped: ', device.toString());
        return { status: 'skipped', reason: 'thinq1-disabled' };
    }
    if (!isDeviceEnabled(config, device)) {
        log.info('Device skipped: ', device.id);
        return { status: 'skipped', reason: 'config-disabled' };
    }
    log.info('[' + device.name + '] Setting up device!');
    const setupSuccess = await thinq.setup(device);
    if (!setupSuccess) {
        log.warn('[' + device.name + '] Failed to setup device!');
        return { status: 'skipped', reason: 'setup-failed' };
    }
    const accessoryType = accessoryResolver.make(device);
    if (accessoryType === null) {
        unregisterUnsupportedDevice({ log, thinq, device });
        return { status: 'skipped', reason: 'unsupported' };
    }
    return {
        status: 'ready',
        accessoryType,
        category: accessoryResolver.category(device),
    };
}
//# sourceMappingURL=platformDiscovery.js.map