import type { PlayerId } from "./player";

export interface CommanderDamage {
  readonly playerId: PlayerId;
  readonly value: number;
}
