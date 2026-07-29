export function createNoopLogger() {
    const noop = () => undefined;
    return {
        debug: noop,
        error: noop,
        info: noop,
        log: noop,
        success: noop,
        warn: noop,
    };
}
//# sourceMappingURL=noopLogger.js.map