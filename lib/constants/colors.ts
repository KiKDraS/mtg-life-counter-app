/**
 * Design tokens — color hex values only.
 *
 * Keep in sync with DESIGN.md §2. When DESIGN.md changes, update this file first.
 * Labels and domain types live in their own files (labels.ts, guilds.ts, shards.ts, etc.).
 *
 * Faction color tuples define gradient stops ordered top-left → bottom-right.
 * Shards (3-color) use an allied-color triad; guilds (2-color) use their color pair.
 */

/* ── Player identity colors (§2.1) ── */
export const MANA = {
  w: "#F8F6D8" as const, // White  — warm, sheltering
  u: "#C1D7E9" as const, // Blue   — electric, intellectual
  b: "#B8B0A8" as const, // Black  — ambitious, dark
  r: "#E49977" as const, // Red    — passionate, aggressive
  g: "#A3C095" as const, // Green  — natural, wild
  c: "#CAC5C0" as const, // Colorless — neutral / eldrazi
} as const;

export type ManaColor = keyof typeof MANA;

/* ── Faction key type aliases (kept local to avoid circular deps with domain files) ── */
type ShardKey = "bant" | "esper" | "grixis" | "jund" | "naya";
type GuildKey = "azorius" | "boros" | "dimir" | "golgari" | "gruul" | "izzet" | "orzhov" | "rakdos" | "selesnya" | "simic";

/* ── Alara shard gradient stops (3-color triads) ── */
export const SHARD_COLORS: Record<ShardKey, readonly [string, string, string]> = {
  bant:  [MANA.g, MANA.w, MANA.u] as const,
  esper: [MANA.w, MANA.u, MANA.b] as const,
  grixis:[MANA.u, MANA.b, MANA.r] as const,
  jund:  [MANA.b, MANA.r, MANA.g] as const,
  naya:  [MANA.r, MANA.g, MANA.w] as const,
};

/* ── Ravnica guild gradient stops (2-color pairs) ── */
export const GUILD_COLORS: Record<GuildKey, readonly [string, string]> = {
  azorius: [MANA.w, MANA.u] as const,
  boros:   [MANA.r, MANA.w] as const,
  dimir:   [MANA.u, MANA.b] as const,
  golgari: [MANA.b, MANA.g] as const,
  gruul:   [MANA.r, MANA.g] as const,
  izzet:   [MANA.u, MANA.r] as const,
  orzhov:  [MANA.w, MANA.b] as const,
  rakdos:  [MANA.b, MANA.r] as const,
  selesnya:[MANA.g, MANA.w] as const,
  simic:   [MANA.g, MANA.u] as const,
};

/* ── UI & shell colors (§2.2) ── */
export const UI = {
  overlay:   "#1A1A1A" as const, // Commander damage & counters overlay bg
  belt:      "#000000" as const, // Spellbook belt, AI Judge modal
  danger:    "#D50000" as const, // Life ≤ 0, commander damage ≥ 21
  textLight: "#FAF8F5" as const, // Text on dark backgrounds
  textDark:  "#1A1A1A" as const, // Text on light backgrounds
} as const;
