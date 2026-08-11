/**
 * Scryfall card helpers — pure TS (SPEC §9.3.1).
 *
 * No fetch here (route layer does IO). Types + card-name extraction only.
 */

import { normalize } from "./es-dict";

/** Canonical card schema = raw Scryfall card JSON subset. Never reshaped (§9.3.1). */
export interface ScryfallCard {
  readonly id: string;
  readonly name: string;
  readonly oracle_text: string | null;
  readonly type_line: string | null;
  /** Canonical rulings endpoint (SPEC §9.3.1) — fallback `/cards/{id}/rulings`. */
  readonly rulings_uri: string | null;
}

/** Rulings shape per SPEC §9.3.1: `{data: [{source, published_at, comment}]}`. */
export interface ScryfallRuling {
  readonly source: string;
  readonly published_at: string | null;
  readonly comment: string;
}

/** Ruling bound to its card name — what the prompt context renders (§9.7). */
export interface CardRuling {
  readonly name: string;
  readonly source: string;
  readonly published_at: string | null;
  readonly comment: string;
}

/** Allowed lowercase connectors inside a card-name run (§9.3.1). */
const CONNECTORS = new Set([
  "and", "or", "the", "of", "to", "a", "an", "for", "with",
  "at", "on", "in", "from", "by", "vs", "&",
]);

/** Leading interrogatives/fillers stripped before the name run (SPEC §9.3.1). */
const LEADING_SKIP = new Set([
  "how", "what", "why", "when", "where", "who", "which",
  "is", "are", "does", "do", "can", "could", "would", "should",
  "tell", "explain", "me", "if", "about", "doesn't", "doesnt",
  "como", "que", "cual", "cuando", "donde", "quien",
  "es", "puede", "puedo", "explica", "funciona",
]);

/** Title-case word: capitalized, ≥2 chars, letters/apostrophe/hyphen only. */
const TITLE_CASE_RE = /^[A-Z][a-z'-]{1,}$/;
const QUOTED_RE = /"([^"]{2,40})"/;
const LEADING_PUNCT_RE = /^[¿¡"'([{]+/;
const TRAILING_PUNCT_RE = /[.,!?;:)\]}'"]+$/;

/** Token without attached punctuation ("Narset," → "Narset", "¿Qué" → "Qué"). */
const stripPunct = (w: string): string =>
  w.replace(LEADING_PUNCT_RE, "").replace(TRAILING_PUNCT_RE, "");

/** Title-case after accent strip — "Cómo" reads as "Como" but is a starter anyway. */
const isTitleCase = (w: string): boolean =>
  TITLE_CASE_RE.test(w.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

/** Token may continue the run: title-case word, connector, or digit-led. */
const isRunToken = (w: string): boolean =>
  isTitleCase(w) || CONNECTORS.has(normalize(w)) || /^[0-9]/.test(w);

/** Raw tokens joined; sentence punctuation stripped from the edges only. */
const joinRun = (run: string[]): string => {
  const out = run.slice();
  out[0] = out[0].replace(LEADING_PUNCT_RE, "");
  out[out.length - 1] = out[out.length - 1].replace(TRAILING_PUNCT_RE, "");
  return out.join(" ");
};

/** Keep the longer candidate — first run wins ties. */
const longerRun = (best: string | null, run: string[]): string | null =>
  best === null || run.length > best.split(" ").length ? joinRun(run) : best;

/**
 * @description Best-effort card name from a question (SPEC §9.3.1). Quoted
 * name wins; else the longest run of 2+ tokens starting at a title-case word,
 * with allowed lowercase connectors ("and", "the", "to"…) inside the run.
 * Leading interrogatives/fillers ("How", "Does", "me", "about", "¿Qué"…)
 * stripped before the run. Run ends at a lowercase non-connector ("work",
 * "legal"…) or sentence punctuation. O(n) single pass.
 * @param question The player's question.
 * @returns Card name candidate, or null when none found (card path skipped).
 */
export function extractCardName(question: string): string | null {
  const quoted = question.match(QUOTED_RE);
  if (quoted) return quoted[1].trim();

  const words = question.split(/\s+/);
  let best: string | null = null;

  for (let i = 0; i < words.length; i++) {
    const clean = stripPunct(words[i]);
    if (LEADING_SKIP.has(normalize(clean))) continue;
    if (!isTitleCase(clean)) continue;

    const run: string[] = [];
    for (let j = i; j < words.length; j++) {
      if (!isRunToken(stripPunct(words[j]))) break;
      run.push(words[j]);
    }
    if (run.length >= 2) best = longerRun(best, run);
    i += run.length - 1;
  }
  return best;
}
