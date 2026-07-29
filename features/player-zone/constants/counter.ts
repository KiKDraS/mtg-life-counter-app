import type { Counter } from "@/features/player-zone/types/counter";

/* §7.4 — direction constants for useLifeAdjustment on counter ± buttons */
export const INCREMENT_COUNTER = 1 as const;
export const DECREMENT_COUNTER = -1 as const;

/* §7.4 — custom counter type identifier */
export const COUNTER_TYPE_CUSTOM = "custom" as const;

/* Default counters pre-seeded in every player state. */
export const DEFAULT_COUNTERS: Counter[] = [
  { id: "poison", type: "poison", value: 0 },
  { id: "energy", type: "energy", value: 0 },
  { id: "experience", type: "experience", value: 0 },
  { id: "time", type: "time", value: 0 },
];

/* Poison lethal threshold */
export const POISON_LETHAL = 10;
