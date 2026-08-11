/**
 * Lexical rule retrieval — pure TS (SPEC §9.4).
 *
 * No Node APIs. Browser-portable unchanged. O(n) single pass over the rules
 * Map per query: per-rule token overlap is bounded by the question length.
 */

import type { RulesArtifact } from "./rules-source";

export interface RetrievedRule {
  readonly ruleId: string;
  readonly text: string;
  readonly score: number;
}

export const TOP_K = 5;

/** Exact-rule mention (e.g. "702.12" or "CR 702.12" in the question). */
const RULE_ID_RE = /\b(?:CR\s*)?(\d{3}\.\d+[a-z]?)\b/gi;

/** Lowercase, punctuation-stripped tokens. Skips noise: 1-2 char + filler. */
function normalizeTokens(text: string): Set<string> {
  const STOP = new Set(["the", "and", "of", "to", "in", "is", "a", "an", "for", "on", "do", "does", "can", "with"]);
  const tokens = new Set<string>();
  for (const token of text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (token.length < 3 || STOP.has(token)) continue;
    tokens.add(token);
  }
  return tokens;
}

/**
 * Score a rule against the question:
 * - +10 when the question names the rule id and the rule falls under it
 *   (exact section boost, SPEC §9.4).
 * - +1 per question token found in the rule text (token overlap).
 *
 * Returns top-k sorted desc. Ties broken by insertion order (stable sort).
 */
export function retrieveRules(question: string, artifact: RulesArtifact): RetrievedRule[] {
  const mentioned = new Set<string>();
  let match: RegExpExecArray | null;
  RULE_ID_RE.lastIndex = 0;
  while ((match = RULE_ID_RE.exec(question)) !== null) {
    mentioned.add(match[1]);
  }

  const questionTokens = normalizeTokens(question);
  const scored: RetrievedRule[] = [];

  for (const [ruleId, text] of artifact.rules) {
    let score = 0;
    if (mentioned.size > 0) {
      // Mentioned "702.12" boosts the section header (+10) and, more, the
      // sub-rules under it like "702.12a" (+12) — sub-rules carry the text.
      for (const m of mentioned) {
        if (ruleId === m) score += 10;
        else if (ruleId.startsWith(m)) score += 12;
      }
    }
    if (questionTokens.size > 0) {
      const ruleTokens = normalizeTokens(text);
      for (const token of questionTokens) {
        if (ruleTokens.has(token)) score += 1;
      }
    }
    if (score > 0) scored.push({ ruleId, text, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, TOP_K);
}
