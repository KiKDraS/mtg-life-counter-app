/**
 * Scryfall fetch wrapper — Node side, route layer (SPEC §9.3.1).
 *
 * - 10 req/s queue, 429 → backoff 1s/2s/4s max 3 retries then give up.
 * - 5s timeout per fetch → null (card path skipped).
 * - ETag / If-None-Match → 304 reuses cached value (SPEC §9.3.1).
 * - 404 not_found / ambiguous → null, no error.
 * - Never throws: every failure returns null (best-effort, answer proceeds).
 */

import {
  getCachedCard,
  getCachedRulings,
  putCachedCard,
  putCachedRulings,
} from "./cache";
import type { ScryfallCard, ScryfallRuling } from "./rag/cards-source";

const SCRYFALL_BASE = "https://api.scryfall.com";
const USER_AGENT = process.env.USER_AGENT ?? "mtg-life-counter-app/0.1 (MTG life counter PWA)";
const TIMEOUT_MS = 5_000;
const MIN_INTERVAL_MS = 100; // 10 req/s
const MAX_429_RETRIES = 3;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Simple 10 req/s gate. Synchronous slot claim — no races within one event-loop turn. */
let lastRequestAt = 0;
const acquireSlot = (): Promise<void> => {
  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt));
  lastRequestAt = now + wait;
  return wait > 0 ? sleep(wait) : Promise.resolve();
};

const buildHeaders = (etag: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  if (etag) headers["If-None-Match"] = etag;
  return headers;
};

/** 304 → revalidate; 429 with backoff budget → retry; other non-2xx → fail. */
function statusDecision(
  response: Response,
  etag: string | null,
  attempt: number,
): "revalidate" | "retry" | "fail" | "ok" {
  if (response.status === 304) return "revalidate";
  if (response.status === 429 && attempt < MAX_429_RETRIES) return "retry";
  return response.ok ? "ok" : "fail";
}

/** GET with 5s timeout + 429 backoff. Resolves null on any non-2xx failure. */
async function fetchJson(url: string, etag: string | null): Promise<{ data: unknown; etag: string | null } | null> {
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    await acquireSlot();
    try {
      const response = await fetch(url, {
        headers: buildHeaders(etag),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const decision = statusDecision(response, etag, attempt);
      if (decision === "retry") {
        await sleep(2 ** attempt * 1000); // 1s, 2s, 4s
        continue;
      }
      if (decision === "fail") return null;
      if (decision === "revalidate") {
        return { data: null, etag: response.headers.get("etag") ?? etag };
      }
      const data: unknown = await response.json();
      return { data, etag: response.headers.get("etag") };
    } catch {
      return null; // timeout / network error → skip path (SPEC §9.3.1)
    }
  }
  return null;
}

/** Strict shape check so malformed upstream data never reaches the prompt. */
const isCard = (value: unknown): value is ScryfallCard =>
  typeof value === "object" && value !== null &&
  typeof (value as ScryfallCard).id === "string" &&
  typeof (value as ScryfallCard).name === "string";

const isRuling = (value: unknown): value is ScryfallRuling =>
  typeof value === "object" && value !== null &&
  typeof (value as ScryfallRuling).comment === "string" &&
  typeof (value as ScryfallRuling).source === "string";

/** Cached entry type (shape of {@link getCachedCard} result). */
type CardCacheEntry = { card: ScryfallCard; etag: string | null };

const etagOf = (cached: CardCacheEntry | null): string | null => (cached ? cached.etag : null);

const staleCard = (cached: CardCacheEntry | null): ScryfallCard | null =>
  cached ? cached.card : null;

/** 304 revalidation: refresh cache freshness, reuse stored value. */
function revalidate(name: string, cached: CardCacheEntry, etag: string | null): ScryfallCard {
  putCachedCard(name, cached.card, etag ?? cached.etag);
  return cached.card;
}

/** Fresh lookup with cache revalidation; null on any failure. */
async function fetchResolved(name: string, cached: CardCacheEntry | null): Promise<ScryfallCard | null> {
  const url = `${SCRYFALL_BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`;
  const result = await fetchJson(url, etagOf(cached));
  if (!result) return staleCard(cached); // fail → reuse stale cache if any
  if (result.data === null && cached) return revalidate(name, cached, result.etag);
  if (!isCard(result.data)) return null;

  putCachedCard(name, result.data, result.etag);
  return result.data;
}

/**
 * @description Fuzzy card lookup (SPEC §9.3.1). Cache-first (LRU 500 / 24h,
 * ETag revalidation). Never throws.
 * @param name Card name from the question.
 * @returns The matched card, or null on 404/ambiguous/timeout/network error.
 * Reuses a stale cache entry on fetch failure when present.
 */
export async function resolveCard(name: string): Promise<ScryfallCard | null> {
  const cached = getCachedCard(name);
  if (cached && !cached.etag) return cached.card;
  return fetchResolved(name, cached);
}

/**
 * @description Rulings for a card id (SPEC §9.3.1). Cache TTL 7d. Never
 * throws.
 * @param cardId Scryfall card id.
 * @returns Rulings array, or null on any failure / empty response.
 */
export async function getRulings(cardId: string): Promise<ScryfallRuling[] | null> {
  const cached = getCachedRulings(cardId);
  if (cached) return cached;

  const url = `${SCRYFALL_BASE}/cards/${encodeURIComponent(cardId)}/rulings`;
  const result = await fetchJson(url, null);
  if (!result) return null;

  const data = result.data as { data?: unknown } | null;
  if (typeof data !== "object" || data === null || !Array.isArray(data.data)) return null;
  const rulings = data.data.filter(isRuling);
  if (rulings.length === 0) return null;

  putCachedRulings(cardId, rulings);
  return rulings;
}
