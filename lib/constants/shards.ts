/**
 * Alara shard domain types.
 *
 * All 5 shards as a discriminated union.
 * Color gradient stops live in colors.ts (SHARD_COLORS).
 */

export type Shard =
  | "bant"
  | "esper"
  | "grixis"
  | "jund"
  | "naya";

export { SHARD_COLORS } from "./colors";
