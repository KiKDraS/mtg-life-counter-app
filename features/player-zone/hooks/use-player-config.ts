import { PlayerZoneRotation } from "../types/player";

/* §4.3 — Zone rotation per position + player count. */
const LAYOUT_MAP: Record<number, PlayerZoneRotation[]> = {
  2: [180, 0],
  3: [180, 90, -90],
  4: [90, -90, 90, -90],
  5: [180, 90, -90, 90, -90],
  6: [180, 90, -90, 90, -90, 0],
};

/** §4.3 — Rotation for a player at `index` in a `total`-player game. */
export function getPlayerRotation(
  index: number,
  total: number,
): PlayerZoneRotation {
  return LAYOUT_MAP[total]?.[index] ?? 0;
}

/* ponytail: both constant until Color Picker changes them per-player. */
