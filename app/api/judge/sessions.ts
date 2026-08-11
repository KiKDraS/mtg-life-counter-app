/**
 * In-memory session store for the AI Judge route (SPEC §9.9).
 *
 * Keyed by client sessionId (uuid per modal open). Cap 100 sessions FIFO;
 * lazy idle sweep on access drops sessions untouched > 30 min. History itself
 * is built by `features/ai-judge/lib/history.ts` — the store only owns
 * lifecycle. Never persisted.
 */

import { SYSTEM_PROMPT } from "@/features/ai-judge/lib/prompts";
import type { JudgeHistory } from "@/features/ai-judge/lib/history";

const MAX_SESSIONS = 100;
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min idle expiry

/** One live session: history + last-touch timestamp for the idle sweep. */
export interface SessionEntry {
  readonly history: JudgeHistory;
  lastTouchedAt: number;
}

const sessions = new Map<string, SessionEntry>();

/** Lazy sweep on access: drop sessions idle > 30 min. O(n), n ≤ MAX_SESSIONS. */
function sweepSessions(now: number): void {
  for (const [id, entry] of sessions) {
    if (now - entry.lastTouchedAt > SESSION_IDLE_MS) sessions.delete(id);
  }
}

/**
 * @description Session key: the client's sessionId (uuid, one per modal open)
 * when valid — string, 8–128 chars after trim. Missing/invalid →
 * `ip:timestamp`, a per-request key that is never reused, so no cross-request
 * history sharing.
 * @param bodySessionId Raw sessionId from the request body.
 * @param ip Client IP for the fallback key.
 * @returns The session key to store/read history under.
 */
export function sessionKey(bodySessionId: unknown, ip: string): string {
  if (typeof bodySessionId === "string") {
    const id = bodySessionId.trim();
    if (id.length >= 8 && id.length <= 128) return id;
  }
  return `${ip}:${Date.now()}`;
}

/**
 * @description Get-or-create history for a session key. Idle sweep on access;
 * FIFO eviction of the oldest session when over MAX_SESSIONS.
 * @param id Session key from {@link sessionKey}.
 * @returns The session's history (new empty history on first access).
 */
export function getSession(id: string): JudgeHistory {
  const now = Date.now();
  sweepSessions(now);
  const entry = sessions.get(id);
  if (entry) {
    entry.lastTouchedAt = now;
    return entry.history;
  }
  const history: JudgeHistory = { system: SYSTEM_PROMPT, turns: [] };
  sessions.set(id, { history, lastTouchedAt: now });
  if (sessions.size > MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest !== undefined) sessions.delete(oldest);
  }
  return history;
}
