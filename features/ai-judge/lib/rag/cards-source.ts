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

/** Longest title-case run starting at i, capped at 5 words. */
const runFrom = (words: string[], i: number): string[] => {
  const run: string[] = [];
  for (let j = i; j < words.length && run.length < 5; j++) {
    if (!TITLE_CASE_RE.test(words[j])) break;
    run.push(words[j]);
  }
  return run;
};

/** Candidate run at i (skips question starters), or null when <2 words. */
const nextRun = (words: string[], i: number): { candidate: string; next: number } | null => {
  if (i === 0 && QUESTION_STARTERS.has(words[i].toLowerCase())) return null;
  const run = runFrom(words, i);
  if (run.length < 2) return null;
  return { candidate: run.join(" "), next: i + run.length - 1 };
};

/**
 * @description Best-effort card name from a question (SPEC §9.3.1). Quoted
 * name wins; else the longest run of 2–5 consecutive title-case words, with
 * question starters ("Is", "Can"…) never starting a run. O(n) single pass.
 * @param question The player's question.
 * @returns Card name candidate, or null when none found (card path skipped).
 */
export function extractCardName(question: string): string | null {
  const quoted = question.match(QUOTED_RE);
  if (quoted) return quoted[1].trim();

  const words = question.split(/\s+/);
  let best: string | null = null;

  for (let i = 0; i < words.length; i++) {
    if (!TITLE_CASE_RE.test(words[i])) continue;
    const run = nextRun(words, i);
    if (!run) continue;
    if (best === null || run.candidate.split(" ").length > best.split(" ").length) {
      best = run.candidate;
    }
    i = run.next;
  }
  return best;
}
