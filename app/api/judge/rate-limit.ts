/**
 * Per-IP rate limiting for the AI Judge route (SPEC §9.5).
 *
 * Sliding window, 10 req/min/IP, in-memory Map. Entries with a fully expired
 * window are deleted on access so the map stays bounded.
 */

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const ipRequests = new Map<string, number[]>();

/**
 * @description Sliding-window check + record for one request. O(n) per call,
 * n ≤ RATE_LIMIT.
 * @param ip The client IP to check.
 * @returns True when the request exceeds the limit and must be rejected.
 */
export function isRateLimited(ip: string): boolean {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  const times = (ipRequests.get(ip) ?? []).filter((t) => t > cutoff);
  if (times.length === 0) {
    // Window fully expired → drop the entry, keep the map bounded.
    ipRequests.delete(ip);
  } else if (times.length >= RATE_LIMIT) {
    ipRequests.set(ip, times);
    return true;
  }
  times.push(Date.now());
  ipRequests.set(ip, times);
  return false;
}

/**
 * @description Best-effort client IP: first `x-forwarded-for` entry, else
 * "unknown".
 * @param request The incoming request.
 * @returns The client IP string.
 */
export const clientIp = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
