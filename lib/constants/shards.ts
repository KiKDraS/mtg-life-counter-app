/**
 * Alara shard domain types and color mappings.
 *
 * All 5 shards as a discriminated union, each mapped to its 3 allied colors.
 */

import { MANA } from "./colors";

export type Shard =
  | "bant"
  | "esper"
  | "grixis"
  | "jund"
  | "naya";

/**
 * 3-color gradient stops for each shard.
 * Ordered top-left → bottom-right per the gradient direction.
 */
export const SHARD_COLORS: Record<Shard, readonly [string, string, string]> = {
  bant:  [MANA.g, MANA.w, MANA.u] as const,
  esper: [MANA.w, MANA.u, MANA.b] as const,
  grixis:[MANA.u, MANA.b, MANA.r] as const,
  jund:  [MANA.b, MANA.r, MANA.g] as const,
  naya:  [MANA.r, MANA.g, MANA.w] as const,
};
