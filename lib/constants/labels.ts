/**
 * Display labels for all domain enums.
 *
 * Text values used for aria-labels, UI tooltips, and accessibility.
 * Import these instead of hardcoding string literals in JSX.
 */

import type { ManaColor } from "./colors";
import type { Guild } from "./guilds";

/* ── Mana symbol labels ── */
export const MANA_LABELS: Record<ManaColor, string> = {
  w: "White mana",
  u: "Blue mana",
  b: "Black mana",
  r: "Red mana",
  g: "Green mana",
  c: "Colorless mana",
} as const;

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
