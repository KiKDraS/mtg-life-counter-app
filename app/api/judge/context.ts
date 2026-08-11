/**
 * Context orchestration for the AI Judge route (SPEC §9.7, §9.3).
 *
 * Pure orchestration of lib calls — no fetch or SDK logic here. Builds the
 * user-message context: best-effort Scryfall card rulings + rules RAG
 * (versioned cache → fetch → stale fallback → degraded mode). Every external
 * dependency is null-safe; the answer always proceeds.
 */

import { buildUserPrompt } from "@/features/ai-judge/lib/prompts";
import { getRulings, resolveCard } from "@/features/ai-judge/lib/scryfall";
import { extractCardName } from "@/features/ai-judge/lib/rag/cards-source";
import type { CardRuling } from "@/features/ai-judge/lib/rag/cards-source";
import { retrieveRules } from "@/features/ai-judge/lib/rag/retrieval";
import type { RetrievedRule } from "@/features/ai-judge/lib/rag/retrieval";
import { RULES_URL, parseRulesHtml } from "@/features/ai-judge/lib/rag/rules-source";
import type { RulesArtifact } from "@/features/ai-judge/lib/rag/rules-source";
import {
  getRulesArtifact,
  getStaleRulesArtifact,
  putRulesArtifact,
} from "@/features/ai-judge/lib/cache";

/** Rules page fetch timeout — beyond this, serve stale or degrade (§9.3.2). */
export const RULES_FETCH_TIMEOUT_MS = 10_000;

/** RAG context for one question: user-message text + sources actually used. */
export interface JudgeContext {
  readonly contextText: string;
  readonly sourcesUsed: string[];
}

/** Card-path result: mapped rulings + "scryfall" source only when resolved. */
export interface CardRulingsResult {
  readonly rulings: CardRuling[];
  readonly sourcesUsed: string[];
}

/**
 * @description Card rulings path (SPEC §9.3.1). Null-safe at every step:
 * card name missing, card unresolvable/ambiguous, or rulings unavailable →
 * empty result, no error (§9.3.1).
 * @param question The player's trimmed question.
 * @returns Mapped rulings plus `["scryfall"]` when a card resolved, else
 * empty arrays.
 */
export async function resolveCardRulings(question: string): Promise<CardRulingsResult> {
  const cardName = extractCardName(question);
  if (!cardName) return { rulings: [], sourcesUsed: [] };
  const card = await resolveCard(cardName);
  if (!card) return { rulings: [], sourcesUsed: [] };

  const rulings = (await getRulings(card.id)) ?? [];
  return {
    rulings: rulings.map((ruling) => ({
      name: card.name,
      source: ruling.source,
      published_at: ruling.published_at,
      comment: ruling.comment,
    })),
    sourcesUsed: ["scryfall"],
  };
}

/** Fetch + parse + cache the rules artifact; throws on failure (§9.3.2). */
async function fetchRules(): Promise<RulesArtifact> {
  const response = await fetch(RULES_URL, {
    signal: AbortSignal.timeout(RULES_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`mtg.wtf returned ${response.status}`);
  const parsed = parseRulesHtml(await response.text());
  putRulesArtifact(parsed);
  return parsed;
}

/**
 * @description Rules RAG path (SPEC §9.3.2): fresh cache → fetch+parse+cache
 * → stale-cache fallback (24h TTL) → null (degraded). Never throws.
 * @param question The player's trimmed question.
 * @returns Top-k rules with the artifact version, or null in degraded mode.
 */
export async function loadRules(
  question: string,
): Promise<{ rules: RetrievedRule[]; version: string } | null> {
  try {
    const artifact = getRulesArtifact() ?? (await fetchRules());
    return { rules: retrieveRules(question, artifact), version: artifact.version };
  } catch (err) {
    const stale = getStaleRulesArtifact();
    if (stale) return { rules: retrieveRules(question, stale), version: stale.version };
    console.error(
      "Rules fetch failed, degraded mode:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * @description Build the user-message context (SPEC §9.7): card rulings +
 * top-k rules. Best-effort and null-safe:
 * - Card missing/ambiguous/error → rulings skipped, no error (§9.3.1).
 * - Rules fetch fail → stale artifact, else degraded mode, answer on card
 *   rulings only (§9.3.2).
 * @param question The player's trimmed question.
 * @returns The assembled context text plus the sources used (`scryfall`,
 * `mtg.wtf`).
 */
export async function buildContext(question: string): Promise<JudgeContext> {
  const [card, rules] = await Promise.all([
    resolveCardRulings(question),
    loadRules(question),
  ]);

  const sourcesUsed = [...card.sourcesUsed];
  if (rules) sourcesUsed.push("mtg.wtf");
  else if (sourcesUsed.length === 0) sourcesUsed.push("scryfall");

  return {
    contextText: buildUserPrompt(question, rules?.rules ?? [], card.rulings),
    sourcesUsed,
  };
}
