import type { ManaColor } from "@/shared/lib/constants/colors";

/* §8.5.1 — multi-select color identity. Array of selected mana colors. */
export type PlayerColor = ManaColor[];

export type PlayerId = 0 | 1 | 2 | 3 | 4 | 5;

export type PlayerZoneRotation = 0 | 90 | -90 | 180;
