/**
 * Single source of truth for all color tokens.
 *
 * Keep in sync with DESIGN.md §2. When DESIGN.md changes, update this file first.
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

/* ── UI & shell colors (§2.2) ── */
export const UI = {
  overlay:   "#1A1A1A" as const, // Commander damage & counters overlay bg
  belt:      "#000000" as const, // Spellbook belt, AI Judge modal
  danger:    "#D50000" as const, // Life ≤ 0, commander damage ≥ 21
  textLight: "#FAF8F5" as const, // Text on dark backgrounds
  textDark:  "#1A1A1A" as const, // Text on light backgrounds
} as const;

/* ── Mana symbol labels ── */
export const MANA_LABELS: Record<ManaColor, string> = {
  w: "White mana",
  u: "Blue mana",
  b: "Black mana",
  r: "Red mana",
  g: "Green mana",
  c: "Colorless mana",
} as const;

/* ── Guild types §2.3 ── */
export type Guild =
  | "azorius"
  | "boros"
  | "dimir"
  | "golgari"
  | "gruul"
  | "izzet"
  | "orzhov"
  | "rakdos"
  | "selesnya"
  | "simic";

/* ── Guild display labels ── */
export const GUILD_LABELS: Record<Guild, string> = {
  azorius: "Azorius Senate",
  boros: "Boros Legion",
  dimir: "House Dimir",
  golgari: "Golgari Swarm",
  gruul: "Gruul Clans",
  izzet: "Izzet League",
  orzhov: "Orzhov Syndicate",
  rakdos: "Cult of Rakdos",
  selesnya: "Selesnya Conclave",
  simic: "Simic Combine",
} as const;
