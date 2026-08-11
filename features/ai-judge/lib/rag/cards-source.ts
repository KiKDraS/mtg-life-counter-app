/**
 * Scryfall card helpers — pure TS (SPEC §9.3.1).
 *
 * No fetch here (route layer does IO). Types + card-name extraction only.
 */

/** Canonical card schema = raw Scryfall card JSON subset. Never reshaped (§9.3.1). */
export interface ScryfallCard {
  readonly id: string;
  readonly name: string;
  readonly oracle_text: string | null;
  readonly type_line: string | null;
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

/** Question starters that are sentence-initial, not card-name words. */
const QUESTION_STARTERS = new Set([
  "is", "are", "can", "does", "do", "when", "what", "how", "why", "who", "if", "doesnt", "doesn't",
]);

/** Title-case word: capitalized, at least 2 chars, letters/apostrophe/hyphen only. */
const TITLE_CASE_RE = /^[A-Z][a-z'-]{1,}$/;
const QUOTED_RE = /"([^"]{2,40})"/;

/**
 * Best-effort card name from a question (SPEC §9.3.1).
 *
 * 1. Quoted name — first match wins.
 * 2. Longest run of 2–5 consecutive title-case words. Question starters
 *    ("Is", "Can"…) never start a run. No match → null (card path skipped).
 *
 * O(n) single pass over the words.
 */
export function extractCardName(question: string): string | null {
  const quoted = question.match(QUOTED_RE);
  if (quoted) return quoted[1].trim();

  const words = question.split(/\s+/);
  let best: string | null = null;

  for (let i = 0; i < words.length; i++) {
    if (!TITLE_CASE_RE.test(words[i])) continue;
    if (i === 0 && QUESTION_STARTERS.has(words[i].toLowerCase())) continue;

    const run: string[] = [words[i]];
    for (let j = i + 1; j < words.length && run.length < 5; j++) {
      if (!TITLE_CASE_RE.test(words[j])) break;
      run.push(words[j]);
    }
    if (run.length >= 2) {
      const candidate = run.join(" ");
      if (best === null || candidate.split(" ").length > best.split(" ").length) {
        best = candidate;
      }
      i += run.length - 1;
    }
  }
  return best;
}
