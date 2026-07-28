/**
 * Raised when LG answers with HTTP 429. Kept distinct from NotConnectedError so
 * callers can back off instead of treating the account as offline.
 */
export class RateLimitError extends Error {
  constructor(message: string, public readonly retryAfterMs: number | null = null) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Parses the `Retry-After` header, which LG sends either as a delay in seconds
 * or as an HTTP date. Returns null when the header is missing or unparseable.
 */
export function retryAfterMs(header: unknown, now: number = Date.now()): number | null {
  if (typeof header === 'number' && Number.isFinite(header)) {
    return Math.max(0, header * 1000);
  }

  if (typeof header !== 'string' || !header.trim()) {
    return null;
  }

  const seconds = Number(header.trim());
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(header);
  if (Number.isNaN(date)) {
    return null;
  }

  return Math.max(0, date - now);
}
