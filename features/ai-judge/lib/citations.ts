/**
 * Citation parse + validate + sanitize (SPEC §9.7).
 *
 * Extracts citations from the LLM's structured output. Never crashes on
 * malformed output — returns [] on anything unparseable.
 */

import type { Citation } from "./types";

/** Control chars that must not reach the client (CR/LF/tab/ESC…). */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;
const MAX_EXCERPT = 300;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const sanitize = (value: string): string => value.replace(CONTROL_CHARS, "").trim();

/** Truncate excerpt to 300 chars, keep whole words. */
const clipExcerpt = (excerpt: string): string => {
  const clean = sanitize(excerpt);
  if (clean.length <= MAX_EXCERPT) return clean;
  return `${clean.slice(0, MAX_EXCERPT).replace(/\s+\S*$/, "")}…`;
};

/** Validate one parsed citation object; null → filtered. */
function toCitation(value: unknown): Citation | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  if (v.type === "rule") {
    if (!isNonEmptyString(v.ruleId)) return null;
    return {
      type: "rule",
      ruleId: sanitize(v.ruleId),
      section: isNonEmptyString(v.section) ? sanitize(v.section) : sanitize(v.ruleId),
      excerpt: isNonEmptyString(v.excerpt) ? clipExcerpt(v.excerpt) : "",
    };
  }
  if (v.type === "card") {
    if (!isNonEmptyString(v.name)) return null;
    return {
      type: "card",
      name: sanitize(v.name),
      source: isNonEmptyString(v.source) ? sanitize(v.source) : "scryfall",
      date: isNonEmptyString(v.date) ? sanitize(v.date) : "",
      excerpt: isNonEmptyString(v.excerpt) ? clipExcerpt(v.excerpt) : "",
    };
  }
  return null;
}

/** Locate the first `{...}` JSON-ish block in raw text (markdown fence aware). */
function extractJsonBlock(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

/**
 * Parse `{answer, citations}` from LLM output.
 *
 * Path 1: content IS a JSON string → parse directly.
 * Path 2: JSON inside markdown fences or embedded in prose → extract block.
 * Path 3: nothing parseable → [].
 */
export function parseCitations(raw: string): Citation[] {
  if (raw.trim().length === 0) return [];

  const parseBlock = (block: string): Citation[] => {
    try {
      const parsed: unknown = JSON.parse(block);
      if (typeof parsed !== "object" || parsed === null) return [];
      const citations = (parsed as Record<string, unknown>).citations;
      if (!Array.isArray(citations)) return [];
      return citations.map(toCitation).filter((c): c is Citation => c !== null);
    } catch {
      return [];
    }
  };

  const direct = parseBlock(raw.trim());
  if (direct.length > 0) return direct;

  const block = extractJsonBlock(raw);
  return block ? parseBlock(block) : [];
}

/** Build a rule citation, normalizing the id to `CR <id>` form (§9.7). */
export function buildRuleCitation(ruleId: string, section: string, excerpt: string): Citation {
  const normalized = ruleId.startsWith("CR ") ? ruleId : `CR ${ruleId}`;
  return { type: "rule", ruleId: normalized, section, excerpt: clipExcerpt(excerpt) };
}

/** Build a card citation from a Scryfall ruling (§9.7). */
export function buildCardCitation(name: string, date: string, excerpt: string): Citation {
  return { type: "card", name, source: "scryfall", date, excerpt: clipExcerpt(excerpt) };
}
