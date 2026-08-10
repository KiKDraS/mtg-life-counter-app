/**
 * Display labels for all domain enums.
 *
 * Text values used for aria-labels, UI tooltips, and accessibility.
 * Import these instead of hardcoding string literals in JSX.
 */

import type { ManaColor } from "./colors";
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

/* ── Player action display labels ── */
export const ACTION_LABELS: Record<PlayerAction, string> = {
  lifeSettings: "Life Settings",
  selectPlayers: "Select Players",
  restartGame: "Restart Game",
  callJudge: "Call Judge",
  colorSettings: "Color Settings",
} as const;
