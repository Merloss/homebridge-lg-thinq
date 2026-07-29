export function removeDeviceUpdateListener(events, listeners, deviceId) {
    const existing = listeners[deviceId];
    if (!existing) {
        return false;
    }
    events.off(deviceId, existing);
    delete listeners[deviceId];
    return true;
}
export function bindDeviceUpdateListener(events, listeners, deviceId, listener) {
    removeDeviceUpdateListener(events, listeners, deviceId);
    listeners[deviceId] = listener;
    events.on(deviceId, listener);
}
//# sourceMappingURL=platformEvents.js.map