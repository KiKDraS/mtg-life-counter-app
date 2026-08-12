import type {
  PlayerColor,
  PlayerId,
  PlayerZoneRotation,
} from "@/features/player-zone/types/player";
import type { CommanderDamage } from "@/features/player-zone/types/CommanderDamage";
import type { Counter } from "@/features/player-zone/types/counter";

/* ── State ── */
export interface PlayerState {
  readonly playerId: PlayerId;
  readonly life: number;
  readonly color: PlayerColor;
  /** §5 — one entry per commander in play, keyed by commander owner's playerId. */
  readonly commanderDamage: CommanderDamage[];
  /** §7.4 — default counters + any custom counters */
  readonly counters: Counter[];
}

/* ── Action types ── */
export type PlayerAction =
  | { type: "ADJUST_LIFE"; delta: number }
  | { type: "SET_COLOR"; color: PlayerColor }
  | {
      type: "ADJUST_COMMANDER_DAMAGE";
      commanderPlayerId: PlayerId;
      delta: number;
    }
  | { type: "ADJUST_COUNTER"; id: string; delta: number }
  | { type: "ADD_COUNTER"; id: string; name: string };

/* ── Context value ── */
export interface PlayerContextValue {
  readonly state: PlayerState;
  readonly playerZoneRotation: PlayerZoneRotation;
  readonly isOnBottomSlot: boolean;
  readonly dispatch: React.Dispatch<PlayerAction>;
}
