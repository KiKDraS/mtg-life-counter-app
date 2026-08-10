/**
 * Alara shard domain types.
 *
 * All 5 shards as a discriminated union.
 * Gradient stops removed (cce6e2c) — shards not in active color picker.
 */

export type Shard =
  | "bant"
  | "esper"
  | "grixis"
  | "jund"
  | "naya";
