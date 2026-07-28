type Rotation = 0 | 90 | -90 | 180;

/* §4.3 — Zone rotation per position + player count. */
const LAYOUT_MAP: Record<number, Rotation[]> = {
  2: [180, 0],
  3: [180, -90, 90],
  4: [180, 180, 0, 0],
  5: [-90, 90, -90, 90, 180],
  6: [180, 180, 180, 0, 0, 0],
};

/** §4.3 — Rotation for a player at `index` in a `total`-player game. */
export function getPlayerRotation(index: number, total: number): Rotation {
  return LAYOUT_MAP[total]?.[index] ?? 0;
}

/* ponytail: both constant until Color Picker changes them per-player. */
