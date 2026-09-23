/**
 * Context orchestration for the AI Judge route (SPEC §9.7, §9.3).
 *
 * Pure orchestration of lib calls — no fetch or SDK logic here. Builds the
 * user-message context: best-effort Scryfall card rulings + rules RAG
 * (versioned cache → fetch → stale fallback → degraded mode). Every external
 * dependency is null-safe; the answer always proceeds.
 */

import { retrieveSemanticRules } from "./embed";
import {
  getRulesArtifact,
  getStaleRulesArtifact,
  putRulesArtifact,
} from "@/features/ai-judge/lib/cache";
import type { CitationLookup } from "@/features/ai-judge/lib/citations";
import { buildUserPrompt } from "@/features/ai-judge/lib/prompts";
import type { CardRuling } from "@/features/ai-judge/lib/rag/cards-source";
import { extractCardNames } from "@/features/ai-judge/lib/rag/cards-source";
import { normalize } from "@/features/ai-judge/lib/rag/es-dict";
import type { RetrievedRule } from "@/features/ai-judge/lib/rag/retrieval";
import { retrieveRules } from "@/features/ai-judge/lib/rag/retrieval";
import type { RulesArtifact } from "@/features/ai-judge/lib/rag/rules-source";
import {
  RULES_URL,
  parseRulesHtml,
} from "@/features/ai-judge/lib/rag/rules-source";
import { getRulings, resolveCard } from "@/features/ai-judge/lib/scryfall";

/** Rules page fetch timeout — beyond this, serve stale or degrade (§9.3.2). */
export const RULES_FETCH_TIMEOUT_MS = 10_000;

/** Rulings cap per card — top-ranked by question-token overlap (§9.3.1). */
const MAX_RULINGS_PER_CARD = 3;

/**
 * @description Rank rulings by question-token overlap with the comment
 * (SPEC §9.3.1). ≤ cap → as-is. O(tokens × rulings) — both tiny (≤ ~20),
 * once per card. Stable sort keeps original order for ties; zero-overlap
 * rulings still fill the cap (score 0, original order).
 * @param question The player's trimmed question.
 * @param rulings Card rulings, original order.
 * @returns Top-{@link MAX_RULINGS_PER_CARD} rulings, overlap desc.
 */
function rankRulings(question: string, rulings: CardRuling[]): CardRuling[] {
  if (rulings.length <= MAX_RULINGS_PER_CARD) return rulings;
  const tokens = normalize(question)
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const scored = rulings.map((ruling) => {
    const comment = normalize(ruling.comment);
    const score = tokens.filter((t) => comment.includes(t)).length;
    return { ruling, score };
  });
  scored.sort((a, b) => b.score - a.score); // stable — ties keep original order
  return scored.slice(0, MAX_RULINGS_PER_CARD).map((s) => s.ruling);
}

/** RAG context for one question: user-message text + sources actually used. */
export interface JudgeContext {
  readonly contextText: string;
  readonly sourcesUsed: string[];
  /** SPEC §9.5 — per-leg context build ms; both within contextMs (parallel max). */
  readonly timings: { readonly scryfallMs: number; readonly rulesMs: number };
  /** SPEC §9.7 — retrieved rules + card contexts for citation assembly. */
  readonly lookup: CitationLookup;
}

/** One resolved card's context (SPEC §9.3.1). Present whenever the card
 * resolves — even with zero rulings. */
export interface CardContext {
  readonly name: string;
  readonly typeLine: string | null;
  readonly oracleText: string | null;
  readonly rulings: CardRuling[];
}

/** Card-path result: all resolved card contexts + "scryfall" source only
 * when at least one card resolves (§9.3.1). */
export interface CardRulingsResult {
  readonly cards: CardContext[];
  readonly sourcesUsed: string[];
}

/**
 * @description Card rulings path (SPEC §9.3.1). Null-safe at every step per
 * card: name missing, unresolvable/ambiguous, or rulings unavailable → that
 * card skipped, no error (§9.3.1). Card lookups run in parallel through the
 * rate queue (resolveCard); card context order = extraction order.
 * Card context (name/type/oracle text) present whenever a card resolves —
 * rulings stay optional.
 * @param question The player's trimmed question.
 * @returns Card contexts + mapped rulings plus `["scryfall"]` when a card
 * resolved, else empty arrays.
 */
export async function resolveCardRulings(
  question: string,
): Promise<CardRulingsResult> {
  // Promise.all preserves input order — card block order stays extraction order.
  const cards = (
    await Promise.all(
      extractCardNames(question).map(async (name): Promise<CardContext | null> => {
        const card = await resolveCard(name);
        if (!card) return null;
        return {
          name: card.name,
          typeLine: card.type_line,
          oracleText: card.oracle_text,
          rulings: rankRulings(
            question,
            ((await getRulings(card)) ?? []).map((ruling) => ({
              name: card.name,
              source: ruling.source,
              published_at: ruling.published_at,
              comment: ruling.comment,
            })),
          ),
        };
      }),
    )
  ).filter((card): card is CardContext => card !== null);
  return { cards, sourcesUsed: cards.length > 0 ? ["scryfall"] : [] };
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
 * @returns Top-k rules + the full artifact rules map (citation assembly,
 * §9.7) + version, or null in degraded mode.
 */
export async function loadRules(
  question: string,
): Promise<{ rules: RetrievedRule[]; version: string; allRules: ReadonlyMap<string, string> } | null> {
  try {
    const artifact = getRulesArtifact() ?? (await fetchRules());
    // Semantic first when enabled (SPEC §9.4); null → lexical fallback.
    const semantic = await retrieveSemanticRules(question, artifact);
    return {
      rules: semantic ?? retrieveRules(question, artifact),
      version: artifact.version,
      allRules: artifact.rules,
    };
  } catch (err) {
    const stale = getStaleRulesArtifact();
    if (stale) {
      const semantic = await retrieveSemanticRules(question, stale);
      return {
        rules: semantic ?? retrieveRules(question, stale),
        version: stale.version,
        allRules: stale.rules,
      };
    }
    console.error(
      "Rules fetch failed, degraded mode:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * @description Build the user-message context (SPEC §9.7): all resolved card
 * contexts + top-k rules. Best-effort and null-safe:
 * - Cards missing/ambiguous/error → skipped, no error (§9.3.1).
 * - Rules fetch fail → stale artifact, else degraded mode, answer on card
 *   rulings only (§9.3.2).
 * @param question The player's trimmed question.
 * @returns The assembled context text plus the sources used (`scryfall`,
 * `mtg.wtf`) — empty when both paths degraded (§9.3.2). Per-leg build ms in
 * `timings` (SPEC §9.5), both within contextMs (parallel max).
 */
export async function buildContext(question: string): Promise<JudgeContext> {
  const tScryfall = performance.now();
  const cardP = resolveCardRulings(question);
  const tRules = performance.now();
  const rulesP = loadRules(question);
  const [card, rules] = await Promise.all([cardP, rulesP]);
  const scryfallMs = Math.round(performance.now() - tScryfall);
  const rulesMs = Math.round(performance.now() - tRules);

  const rulings = card.cards.flatMap((cardContext) => cardContext.rulings);
  const sourcesUsed = [...card.sourcesUsed];
  if (rules) sourcesUsed.push("mtg.wtf");

  const lookup: CitationLookup = {
    // Full artifact map — rule sections AND headers resolve for citations
    // (§9.7 section = parent header text).
    rules: rules?.allRules ?? new Map(),
    cards: new Map(card.cards.map((c) => [c.name, { oracleText: c.oracleText, rulings: c.rulings }])),
  };

  return {
    contextText: buildUserPrompt(
      question,
      rules?.rules ?? [],
      card.cards,
      rulings,
    ),
    sourcesUsed,
    timings: { scryfallMs, rulesMs },
    lookup,
  };
}
