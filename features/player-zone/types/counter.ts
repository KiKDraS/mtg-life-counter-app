/* §7.4 — Counter types */

import { COUNTER_TYPE_CUSTOM } from "@/features/player-zone/constants/counter";

export type CounterType = "poison" | "energy" | "experience" | "time" | typeof COUNTER_TYPE_CUSTOM;

export interface Counter {
  readonly id: string;
  readonly type: CounterType;
  readonly value: number;
  /** Only set for custom counters — displayed as first-letter pill. */
  readonly name?: string;
}
