/**
 * Citation assembly + validate + sanitize (SPEC §9.7).
 *
 * The model emits compact citation ids (`{"citations":[{type, ruleId|name}]}`)
 * after the `<<<CITATIONS>>>` delimiter; the server assembles verbatim
 * excerpts from the retrieved context. Never crashes on malformed output —
 * unknown ids are dropped, never fabricated.
 */

import type { CardRuling } from "./rag/cards-source";
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

/** Build a rule citation, normalizing the id to `CR <id>` form (§9.7). */
export function buildRuleCitation(ruleId: string, section: string, excerpt: string): Citation {
  const normalized = ruleId.startsWith("CR ") ? ruleId : `CR ${ruleId}`;
  return { type: "rule", ruleId: normalized, section, excerpt: clipExcerpt(excerpt) };
}

/**
 * Build a card citation from a Scryfall ruling or, when no ruling excerpt is
 * available, the card's oracle text (SPEC §9.7 — excerpt = ruling comment when
 * rulings exist, else oracle text, truncated to 300 chars).
 * @param name Card name.
 * @param date Ruling date if known, else "".
 * @param excerpt Ruling comment (may be empty).
 * @param oracleText Oracle text fallback for the empty-excerpt case.
 */
export function buildCardCitation(
  name: string,
  date: string,
  excerpt: string,
  oracleText?: string,
): Citation {
  const excerptText = excerpt.trim().length > 0 ? excerpt : (oracleText ?? "");
  return { type: "card", name, source: "scryfall", date, excerpt: clipExcerpt(excerptText) };
}

/** Context data the server assembles citations from (SPEC §9.7). */
export interface CitationLookup {
  /** ruleId → verbatim rule text (retrieved top-k, §9.4). */
  readonly rules: ReadonlyMap<string, string>;
  /** card name → oracle text + rulings. */
  readonly cards: ReadonlyMap<string, { readonly oracleText: string | null; readonly rulings: CardRuling[] }>;
}

/**
 * Rule section title: parent header text ("702.34. Flashback") when a header
 * key exists in lookup, else the rule id. Parent candidates derived by
 * stripping trailing parts: "702.34a" → "702.34", "702".
 */
function ruleSection(ruleId: string, rules: ReadonlyMap<string, string>): string {
  let parent = ruleId;
  while (parent.includes(".")) {
    parent = parent.slice(0, parent.lastIndexOf("."));
    const header = rules.get(parent);
    if (header !== undefined) return header;
  }
  return ruleId;
}

/** One compact rule id → assembled citation; unknown id → null. */
function ruleCitation(v: Record<string, unknown>, lookup: CitationLookup): Citation | null {
  if (!isNonEmptyString(v.ruleId)) return null;
  const ruleId = sanitize(v.ruleId);
  const text = lookup.rules.get(ruleId);
  if (text === undefined) return null; // unknown id — no excerpt to fabricate
  return buildRuleCitation(ruleId, ruleSection(ruleId, lookup.rules), text);
}

/** One compact card name → assembled citation; unknown card → null. */
function cardCitation(v: Record<string, unknown>, lookup: CitationLookup): Citation | null {
  if (!isNonEmptyString(v.name)) return null;
  const name = sanitize(v.name);
  const card = lookup.cards.get(name);
  if (!card) return null;
  const first = card.rulings[0];
  return buildCardCitation(name, first?.published_at ?? "", first?.comment ?? "", card.oracleText ?? undefined);
}

/** One tail item → assembled citation; unknown shape → null. */
function citationFromItem(item: unknown, lookup: CitationLookup): Citation | null {
  if (typeof item !== "object" || item === null) return null;
  const v = item as Record<string, unknown>;
  if (v.type === "rule") return ruleCitation(v, lookup);
  if (v.type === "card") return cardCitation(v, lookup);
  return null;
}

/** Parse + shape-check the tail JSON; null when unparseable/not a list. */
function parseTail(tailJson: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(tailJson);
    if (typeof parsed !== "object" || parsed === null) return null;
    const citations = (parsed as Record<string, unknown>).citations;
    return Array.isArray(citations) ? citations : null;
  } catch {
    return null;
  }
}

/**
 * @description Assemble Citations from the model's compact id tail (SPEC
 * §9.7). Unknown ids / unparseable tail → citation dropped, never fabricated.
 * Empty/unparseable → []. O(citations) — each id is one Map lookup.
 * @param tailJson The trimmed citations tail after `<<<CITATIONS>>>`, or null
 * when the model emitted no delimiter.
 * @param lookup Retrieved rules + card contexts to assemble excerpts from.
 * @returns Assembled citations (rule → CR-normalized id, verbatim excerpt;
 * card → first ruling comment, oracle text fallback).
 */
export function assembleCitations(tailJson: string | null, lookup: CitationLookup): Citation[] {
  if (!tailJson || tailJson.length === 0) return [];
  const citations = parseTail(tailJson);
  if (!citations) return [];

  const out: Citation[] = [];
  for (const item of citations) {
    const citation = citationFromItem(item, lookup);
    if (citation) out.push(citation);
  }
  return out;
}