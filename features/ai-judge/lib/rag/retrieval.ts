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

/** Rule ids mentioned in the question (e.g. "702.12" or "CR 702.12a"). */
const mentionedRules = (question: string): Set<string> => {
  const mentioned = new Set<string>();
  let match: RegExpExecArray | null;
  RULE_ID_RE.lastIndex = 0;
  while ((match = RULE_ID_RE.exec(question)) !== null) mentioned.add(match[1]);
  return mentioned;
};

/** Exact-rule mention boost: header +10, sub-rule under it +12. */
const mentionScore = (ruleId: string, mentioned: Set<string>): number => {
  let score = 0;
  for (const m of mentioned) {
    if (ruleId === m) score += 10;
    else if (ruleId.startsWith(m)) score += 12;
  }
  return score;
};

/** Token-overlap score between the rule text and the question tokens. */
const overlapScore = (ruleText: string, questionTokens: Set<string>): number => {
  const ruleTokens = normalizeTokens(ruleText);
  let score = 0;
  for (const token of questionTokens) {
    if (ruleTokens.has(token)) score += 1;
  }
  return score;
};

/** Bare section header ("405. Stack") — title only, no body. */
const SECTION_HEADER_RE = /^\d{3}\.\s+[A-Z]/;

/**
 * @description Expand a bare section header into its subrules — every rule
 * whose id starts with "<sectionNo>.". O(n) map scan; map iteration order =
 * rule-id order (document order, CR numbers ascend).
 * @param sectionId Three-digit section id, e.g. "405".
 * @param artifact Rules artifact to pull subrules from.
 * @param cap Max subrules to return.
 * @returns Subrules in rule-id order.
 */
function expandSection(
  sectionId: string,
  artifact: RulesArtifact,
  cap: number,
): RetrievedRule[] {
  const prefix = `${sectionId}.`;
  const subrules: RetrievedRule[] = [];
  for (const [ruleId, text] of artifact.rules) {
    if (subrules.length >= cap) break;
    if (ruleId.startsWith(prefix)) subrules.push({ ruleId, text, score: 0 });
  }
  return subrules;
}

/**
 * @description Score a rule against the question (exact rule-id mention boost,
 * token overlap) and return the top-k, sorted desc. Ties broken by insertion
 * order (stable sort).
 * @param question The player's question.
 * @param artifact The rules artifact to search.
 * @returns Top-k ({@link TOP_K}) matching rules, score desc.
 */
export function retrieveRules(question: string, artifact: RulesArtifact): RetrievedRule[] {
  const mentioned = mentionedRules(question);
  const questionTokens = normalizeTokens(question);
  const scored: RetrievedRule[] = [];

  for (const [ruleId, text] of artifact.rules) {
    let score = mentionScore(ruleId, mentioned);
    score += overlapScore(text, questionTokens);
    if (score > 0) scored.push({ ruleId, text, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Bare section headers carry no body — never return them. Expand matching
  // sections into their subrules (title match = topic match, most relevant),
  // then fill remaining slots with the other candidates. Deduped by rule id.
  // O(n) single pass; expansion sets are ≤ TOP_K.
  const results: RetrievedRule[] = [];
  const rest: RetrievedRule[] = [];
  for (const candidate of scored) {
    if (SECTION_HEADER_RE.test(candidate.text)) {
      for (const sub of expandSection(candidate.ruleId, artifact, TOP_K - results.length)) {
        results.push(sub);
      }
    } else if (!results.some((r) => r.ruleId === candidate.ruleId)) {
      rest.push(candidate);
    }
  }
  return [...results, ...rest].slice(0, TOP_K);
}
