/**
 * Display labels for all domain enums.
 *
 * Text values used for aria-labels, UI tooltips, and accessibility.
 * Import these instead of hardcoding string literals in JSX.
 */

import type { ManaColor } from "./colors";
import type { Guild } from "./guilds";
import type { Clan } from "./clans";
import type { Shard } from "./shards";
import type { PlayerAction } from "./actions";

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

/* ── Tarkir clan display labels ── */
export const CLAN_LABELS: Record<Clan, string> = {
  abzan: "Abzan Houses",
  jeskai: "Jeskai Way",
  sultai: "Sultai Brood",
  mardu: "Mardu Horde",
  temur: "Temur Frontier",
} as const;

/* ── Alara shard display labels ── */
export const SHARD_LABELS: Record<Shard, string> = {
  bant:  "Bant",
  esper: "Esper",
  grixis:"Grixis",
  jund:  "Jund",
  naya:  "Naya",
} as const;

/* ── Player action display labels ── */
export const ACTION_LABELS: Record<PlayerAction, string> = {
  lifeSettings:  "Life Settings",
  selectPlayers: "Select Players",
  restartGame:   "Restart Game",
  callJudge:     "Call Judge",
  colorSettings: "Color Settings",
} as const;
