/**
 * MTG Comprehensive Rules source — pure TS (SPEC §9.3.2, §9.4).
 *
 * No Node APIs, no fs, no fetch. Browser-portable (offline seam §9.11).
 * Only parse + classify. Fetching happens in the route layer.
 */

/** Single page with the full Comprehensive Rules doc (SPEC §9.3.2). */
export const RULES_URL = "https://mtg.wtf/help/rules";

/** One rule or section header, e.g. { id: "702.12a", text: "702.12a ..." }. */
export interface RuleSection {
  readonly id: string;
  readonly text: string;
}

/** Versioned artifact — caches keyed by version+hash, never by TTL guesswork (§9.3). */
export interface RulesArtifact {
  /** Date stamp from the page, "effective as of …". Falls back to "unknown". */
  readonly version: string;
  /** FNV-1a hash of the normalized text — O(1) version comparison. */
  readonly hash: string;
  readonly rules: Map<string, string>;
}

/** HTML entities used inside rule text. */
const ENTITIES: Readonly<Record<string, string>> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** FNV-1a 32-bit → hex. Pure, deterministic, no crypto module (browser-portable). */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Strip scripts/styles/tags and decode entities. Block tags become newlines. */
function stripHtml(html: string): string {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withBreaks = noScript.replace(/<\/(p|div|h[1-6]|li|section|article)>/gi, "\n");
  const noTags = withBreaks.replace(/<[^>]+>/g, " ");
  return noTags.replace(/&[a-z]+;|&#\d+;/g, (entity) => ENTITIES[entity] ?? entity);
}

// `\.?` eats the trailing dot when the id sits on its own line ("301.7.").
const RULE_RE = /^(\d{3})\.(\d+)([a-z])?\.?(?:\s|$)/;
const SECTION_RE = /^(\d{3})\.(?:\s|$)/;

/** Extract the "effective as of" date stamp. O(n) over the first 2000 chars. */
function extractVersion(text: string): string {
  const match = text.slice(0, 2000).match(/effective as of\s+([^<(\n]+)/i);
  return match ? `effective as of ${match[1].trim()}` : "unknown";
}

/**
 * Parse CR HTML → versioned artifact.
 *
 * Splits rules on `^(\d{3})\.(\d+)([a-z])?\.?\s` and sections on `^(\d{3})\.\s`
 * (SPEC §9.3.2). Output: `Map<ruleId, text>`. O(n) single pass.
 */
export function parseRulesHtml(html: string): RulesArtifact {
  const text = stripHtml(html);
  const rules = new Map<string, string>();
  let currentId: string | null = null;
  let currentText: string[] = [];

  const flush = (): void => {
    if (currentId !== null && currentText.length > 0) {
      rules.set(currentId, currentText.join(" ").replace(/\s+/g, " ").trim());
    }
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const rule = line.match(RULE_RE);
    if (rule) {
      flush();
      currentId = `${rule[1]}.${rule[2]}${rule[3] ?? ""}`;
      currentText = [line];
      continue;
    }
    const section = line.match(SECTION_RE);
    if (section) {
      flush();
      currentId = section[1];
      currentText = [line];
      continue;
    }
    currentText.push(line);
  }
  flush();

  return { version: extractVersion(text), hash: hashText(text), rules };
}
