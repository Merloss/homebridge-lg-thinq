export function hasSnapshotKey(snapshot, key) {
    return snapshot !== null && snapshot !== undefined && key in snapshot;
}
export function contactSensorStateValue(isContactDetected, contactState) {
    return isContactDetected ? contactState.CONTACT_DETECTED : contactState.CONTACT_NOT_DETECTED;
}
export function visibilityCharacteristicUpdate(isShown, targetVisibilityState, currentVisibilityState) {
    return {
        targetVisibilityState: isShown ? targetVisibilityState.SHOWN : targetVisibilityState.HIDDEN,
        currentVisibilityState: isShown ? currentVisibilityState.SHOWN : currentVisibilityState.HIDDEN,
    };
}
export function updateCharacteristicIfChanged(service, characteristic, value) {
    if (!service) {
        return false;
    }
    const currentValue = service.getCharacteristic(characteristic)?.value;
    if (currentValue === value) {
        return false;
    }
    service.updateCharacteristic(characteristic, value);
    return true;
}
export function updateCharacteristicIfDefined(service, characteristic, value) {
    if (value === undefined) {
        return false;
    }
    return updateCharacteristicIfChanged(service, characteristic, value);
}
export function snapshotNumber(snapshot, key, fallback = 0) {
    const value = snapshot?.[key];
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : fallback;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}
export function snapshotBoolean(snapshot, key, fallback = false) {
    const value = snapshot?.[key];
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'on', 'enable', 'enabled', 'ena'].includes(normalized)) {
            return true;
        }
        if (['0', 'false', 'off', 'disable', 'disabled', 'dis'].includes(normalized)) {
            return false;
        }
    }
    return Boolean(value);
}
export function snapshotString(snapshot, key, fallback = '') {
    const value = snapshot?.[key];
    return typeof value === 'string' ? value : fallback;
}
//# sourceMappingURL=helpers.js.map