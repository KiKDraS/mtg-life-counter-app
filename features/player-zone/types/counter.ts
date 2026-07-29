/* §7.4 — Counter types */

export type CounterType = "poison" | "energy" | "experience" | "time" | "custom";

export interface Counter {
  readonly id: string;
  readonly type: CounterType;
  readonly value: number;
  /** Only set for custom counters — displayed as first-letter pill. */
  readonly name?: string;
}
