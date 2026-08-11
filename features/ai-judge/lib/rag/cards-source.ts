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
const QUOTED_RE = /"([^"]{2,40})"/g;
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

/** Drop trailing connector tokens from a run — never below 2 tokens. */
const trimTrailingConnectors = (run: string[]): string[] => {
  const out = run.slice();
  while (out.length > 2 && CONNECTORS.has(normalize(stripPunct(out[out.length - 1])))) {
    out.pop();
  }
  return out;
};

/** Dedupe by normalized name, preserving first-occurrence order. */
const dedupeNames = (names: string[]): string[] => {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const key = normalize(name);
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(name);
    }
  }
  return unique;
};

/**
 * @description One title-case run starting at `words[start]`, advanced to its
 * end. Extends through connectors and digit-led tokens; a connector after a
 * comma splits the run (comma ends one card phrase, connector starts the
 * next); interrogative/filler words terminate it.
 * @param words Question tokens.
 * @param start Index of the run's first token.
 * @returns The raw run tokens plus the next unconsumed index.
 */
function collectRun(words: string[], start: number): { run: string[]; next: number } {
  const run: string[] = [];
  let seenComma = false;
  let i = start;
  while (i < words.length) {
    const raw = words[i];
    const token = stripPunct(raw);
    if (run.length > 0 && LEADING_SKIP.has(normalize(token))) break;
    if (!isRunToken(token)) break;
    if (CONNECTORS.has(normalize(token)) && seenComma) break;
    run.push(raw);
    if (raw.endsWith(",")) seenComma = true;
    i++;
  }
  return { run, next: i };
}

/**
 * @description All best-effort card names in a question (SPEC §9.3.1). Quoted
 * names first, then every title-case run (see {@link collectRun}). Trailing
 * connectors trimmed. Runs shorter than 2 tokens dropped (quoted: 1). Deduped
 * by normalized name. O(n) single pass, O(n) dedupe.
 * @param question The player's question.
 * @returns All card-name candidates — empty when none found.
 */
export function extractCardNames(question: string): string[] {
  const names: string[] = [];
  for (const match of question.matchAll(QUOTED_RE)) {
    names.push(match[1].trim());
  }

  const words = question.split(/\s+/);
  let i = 0;
  while (i < words.length) {
    const clean = stripPunct(words[i]);
    if (LEADING_SKIP.has(normalize(clean)) || !isTitleCase(clean)) {
      i++;
      continue;
    }
    const { run, next } = collectRun(words, i);
    if (run.length >= 2) names.push(joinRun(trimTrailingConnectors(run)));
    i = next;
  }
  return dedupeNames(names);
}
