import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { removeDeviceUpdateListener } from './platformEvents.js';
export function pendingAccessoryIds(accessories) {
    return new Set(accessories.map(accessory => accessory.UUID));
}
export function markAccessorySeen(pendingIds, deviceId) {
    pendingIds.delete(deviceId);
}
export function findAccessoryForDevice(accessories, device) {
    return accessories.find(accessory => accessory.UUID === device.id);
}
export function updateAccessoryDisplayName(options) {
    const { api, log, accessory, name } = options;
    if (accessory.displayName === name) {
        return false;
    }
    log.info('Updating accessory name:', accessory.displayName, '->', name);
    accessory.updateDisplayName(name);
    api.updatePlatformAccessories([accessory]);
    return true;
}
export function createOrRestoreDeviceAccessory(options) {
    const { platform, api, log, accessories, pendingIds, device, accessoryType, category, } = options;
    const existingAccessory = findAccessoryForDevice(accessories, device);
    if (existingAccessory) {
        markAccessorySeen(pendingIds, device.id);
        log.info('Restoring existing accessory:', device.toString());
        existingAccessory.context.device = device;
        updateAccessoryDisplayName({
            api,
            log,
            accessory: existingAccessory,
            name: device.name,
        });
        return new accessoryType(platform, existingAccessory, log);
    }
    log.info('Adding new accessory:', device.toString());
    const accessory = new api.platformAccessory(device.name, device.id, category);
    accessory.context.device = device;
    const deviceHandler = new accessoryType(platform, accessory, log);
    api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    accessories.push(accessory);
    return deviceHandler;
}
export function staleAccessories(accessories, pendingIds) {
    return accessories.filter(accessory => pendingIds.has(accessory.UUID));
}
export function removeStaleAccessories(options) {
    const { api, log, accessories, events, listeners, pendingIds, } = options;
    const accessoriesToRemove = staleAccessories(accessories, pendingIds);
    if (!accessoriesToRemove.length) {
        return [];
    }
    for (const accessory of accessoriesToRemove) {
        log.info('Removing accessory:', accessory.displayName);
        removeDeviceUpdateListener(events, listeners, accessory.UUID);
        const accessoryIndex = accessories.indexOf(accessory);
        if (accessoryIndex >= 0) {
            accessories.splice(accessoryIndex, 1);
        }
    }
    api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessoriesToRemove);
    return accessoriesToRemove;
}
//# sourceMappingURL=platformAccessories.js.map