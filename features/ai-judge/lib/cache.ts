/**
 * In-memory caches — Node side (SPEC §9.3).
 *
 * Memory only, no fs/DB. Caches keyed by version, never by TTL guesswork:
 * artifact key = version+hash; freshness timestamps only decide refetch.
 */

import type { RulesArtifact } from "./rag/rules-source";
import type { ScryfallCard, ScryfallRuling } from "./rag/cards-source";

const HOUR = 60 * 60 * 1000;
const CARD_TTL = 24 * HOUR; // SPEC §9.3.1
const RULING_TTL = 7 * 24 * HOUR; // SPEC §9.3.1
const RULES_TTL = 24 * HOUR; // SPEC §9.3.2 fallback freshness
const CARD_LRU_MAX = 500; // SPEC §9.3.1

interface RulesEntry {
  readonly artifact: RulesArtifact;
  readonly fetchedAt: number;
}

interface CardEntry {
  readonly card: ScryfallCard;
  readonly fetchedAt: number;
  readonly etag: string | null;
}

/** Current artifact, keyed by version+hash identity (SPEC §9.3 — caches keyed by version). */
let currentRules: RulesEntry | null = null;

/** LRU 500 / TTL 24h. Map preserves insertion order → delete+set = refresh. */
const cardCache = new Map<string, CardEntry>();

/** cardId → rulings, TTL 7d. */
const rulingCache = new Map<string, { rulings: ScryfallRuling[]; fetchedAt: number }>();

const isFresh = (fetchedAt: number, ttl: number, now = Date.now()): boolean =>
  now - fetchedAt < ttl;

/**
 * @description Fresh (<24h) rules artifact or null → route refetches (SPEC
 * §9.3.2). O(1).
 * @returns The cached artifact when fresh, else null.
 */
export function getRulesArtifact(): RulesArtifact | null {
  if (currentRules && isFresh(currentRules.fetchedAt, RULES_TTL)) return currentRules.artifact;
  return null;
}

/**
 * @description Last known rules artifact, any age — fetch-fail fallback.
 * O(1).
 * @returns The cached artifact or null when never fetched.
 */
export function getStaleRulesArtifact(): RulesArtifact | null {
  return currentRules?.artifact ?? null;
}

/**
 * Store a freshly fetched+parsed artifact.
 *
 * Replaces the cached artifact only when version or hash changed (SPEC §9.3 —
 * caches keyed by version, never by TTL guesswork). When unchanged, only the
 * fetchedAt timestamp refreshes so the 24h TTL restarts without replacing the
 * artifact object.
 *
 * @param artifact Artifact parsed from the fetched rules page.
 * @returns void.
 */
export function putRulesArtifact(artifact: RulesArtifact): void {
  const current = currentRules;
  if (
    current &&
    current.artifact.version === artifact.version &&
    current.artifact.hash === artifact.hash
  ) {
    currentRules = { artifact: current.artifact, fetchedAt: Date.now() };
    return;
  }
  currentRules = { artifact, fetchedAt: Date.now() };
}

/**
 * @description Card cache hit → touch (move to newest) + return. Miss/stale →
 * null. O(1).
 * @param name Card name key.
 * @returns Cached card + etag, or null on miss/stale.
 */
export function getCachedCard(name: string): { card: ScryfallCard; etag: string | null } | null {
  const entry = cardCache.get(name);
  if (!entry) return null;
  if (!isFresh(entry.fetchedAt, CARD_TTL)) {
    cardCache.delete(name);
    return null;
  }
  cardCache.delete(name);
  cardCache.set(name, entry);
  return { card: entry.card, etag: entry.etag };
}

/**
 * @description Insert card; evict oldest when over LRU cap. O(1).
 * @param name Card name key.
 * @param card Scryfall card to cache.
 * @param etag ETag for revalidation, or null.
 * @returns void.
 */
export function putCachedCard(name: string, card: ScryfallCard, etag: string | null): void {
  if (cardCache.has(name)) cardCache.delete(name);
  cardCache.set(name, { card, fetchedAt: Date.now(), etag });
  if (cardCache.size > CARD_LRU_MAX) {
    const oldest = cardCache.keys().next().value;
    if (oldest !== undefined) cardCache.delete(oldest);
  }
}

/**
 * @description Rulings if fresh, else null. O(1).
 * @param cardId Scryfall card id key.
 * @returns Cached rulings array, or null on miss/stale.
 */
export function getCachedRulings(cardId: string): ScryfallRuling[] | null {
  const entry = rulingCache.get(cardId);
  if (!entry) return null;
  if (!isFresh(entry.fetchedAt, RULING_TTL)) {
    rulingCache.delete(cardId);
    return null;
  }
  return entry.rulings;
}

/**
 * @description Store rulings. O(1).
 * @param cardId Scryfall card id key.
 * @param rulings Rulings to cache.
 * @returns void.
 */
export function putCachedRulings(cardId: string, rulings: ScryfallRuling[]): void {
  rulingCache.set(cardId, { rulings, fetchedAt: Date.now() });
}
