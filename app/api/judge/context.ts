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
import {
  RULES_URL,
  parseRulesHtml,
} from "@/features/ai-judge/lib/rag/rules-source";
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
  const sourcesUsed: string[] = [];
  const rulings: CardRuling[] = [];

  const cardName = extractCardName(question);
  if (cardName) {
    const card = await resolveCard(cardName);
    if (card) {
      sourcesUsed.push("scryfall");
      const cardRulings = await getRulings(card.id);
      if (cardRulings) {
        for (const ruling of cardRulings) {
          rulings.push({
            name: card.name,
            source: ruling.source,
            published_at: ruling.published_at,
            comment: ruling.comment,
          });
        }
      }
    }
  }

  let rules: RetrievedRule[] = [];
  let rulesSourceOk = false;
  try {
    let artifact = getRulesArtifact();
    if (!artifact) {
      const response = await fetch(RULES_URL, {
        signal: AbortSignal.timeout(RULES_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`mtg.wtf returned ${response.status}`);
      const parsed = parseRulesHtml(await response.text());
      putRulesArtifact(parsed);
      artifact = parsed;
    }
    rules = retrieveRules(question, artifact);
    rulesSourceOk = true;
  } catch (err) {
    // 24h TTL fallback: serve last known artifact; else degraded mode.
    const stale = getStaleRulesArtifact();
    if (stale) {
      rules = retrieveRules(question, stale);
      rulesSourceOk = true;
    } else {
      console.error(
        "Rules fetch failed, degraded mode:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  if (rulesSourceOk) sourcesUsed.push("mtg.wtf");
  else if (sourcesUsed.length === 0) sourcesUsed.push("scryfall");

  return {
    contextText: buildUserPrompt(question, rules, rulings),
    sourcesUsed,
  };
}
