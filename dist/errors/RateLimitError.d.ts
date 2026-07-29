/**
 * Raised when LG answers with HTTP 429. Kept distinct from NotConnectedError so
 * callers can back off instead of treating the account as offline.
 */
export declare class RateLimitError extends Error {
    readonly retryAfterMs: number | null;
    constructor(message: string, retryAfterMs?: number | null);
}
/**
 * Parses the `Retry-After` header, which LG sends either as a delay in seconds
 * or as an HTTP date. Returns null when the header is missing or unparseable.
 */
export declare function retryAfterMs(header: unknown, now?: number): number | null;
