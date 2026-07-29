import { randomUUID } from 'crypto';
import { MonitorError, NotConnectedError } from '../errors/index.js';
export function hasThinQ1WorkId(workIds, device) {
    return device.id in workIds && workIds[device.id] !== null;
}
function isThinQ1WorkIdResponse(data) {
    return data !== null && typeof data === 'object' && 'workId' in data;
}
export async function registerThinQ1WorkId(options) {
    const { api, workIds, device, createWorkId = randomUUID, } = options;
    const workId = await api.sendMonitorCommand(device.id, 'Start', createWorkId()).then(data => {
        if (isThinQ1WorkIdResponse(data) && typeof data.workId === 'string') {
            return data.workId;
        }
        return null;
    });
    workIds[device.id] = workId;
    return workId;
}
export async function unregisterThinQ1WorkId(options) {
    const { api, workIds, device } = options;
    if (hasThinQ1WorkId(workIds, device)) {
        try {
            await api.sendMonitorCommand(device.id, 'Stop', workIds[device.id]);
        }
        catch {
            // Keep unregister best-effort so a failed Stop does not block cleanup.
        }
        delete workIds[device.id];
    }
}
export async function pollThinQ1MonitorResult(options) {
    const { api, workIds, device, createWorkId, } = options;
    let result = null;
    if (!hasThinQ1WorkId(workIds, device)) {
        const workId = await registerThinQ1WorkId({
            api,
            workIds,
            device,
            createWorkId,
        });
        if (workId === undefined || workId === null) {
            return result;
        }
    }
    try {
        result = await api.getMonitorResult(device.id, workIds[device.id]);
    }
    catch (err) {
        if (err instanceof MonitorError) {
            await unregisterThinQ1WorkId({ api, workIds, device });
            await registerThinQ1WorkId({
                api,
                workIds,
                device,
                createWorkId,
            });
            try {
                result = await api.getMonitorResult(device.id, workIds[device.id]);
            }
            catch {
                // Preserve existing retry behavior: stop after the single retry.
            }
        }
        else if (err instanceof NotConnectedError) {
            // Device is offline; preserve the previous null-result behavior.
        }
        else {
            throw err;
        }
    }
    return result;
}
//# sourceMappingURL=thinq1Monitor.js.map