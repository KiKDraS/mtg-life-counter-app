/* §7.4 — Counter types */

export const COUNTER_TYPES = [
  "poison",
  "energy",
  "experience",
  "time",
  "custom",
] as const;

export type CounterType = (typeof COUNTER_TYPES)[number];

export interface Counter {
  readonly id: string;
  readonly type: CounterType;
  readonly value: number;
  /** Only set for custom counters — displayed as first-letter pill. */
  readonly name?: string;
}

/* Default counters pre-seeded in every player state. */
export const DEFAULT_COUNTERS: Counter[] = [
  { id: "poison", type: "poison", value: 0 },
  { id: "energy", type: "energy", value: 0 },
  { id: "experience", type: "experience", value: 0 },
  { id: "time", type: "time", value: 0 },
];

/* Poison lethal threshold */
export const POISON_LETHAL = 10;
