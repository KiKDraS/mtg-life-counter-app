import type {
  PlayerId,
  PlayerColor,
} from "@/features/player-zone/types/player";
import type { PlayerState } from "@/features/player-zone/state/types";
import type { GameInit } from "@/features/persistence/idb";

/* ── State ── */
export interface GameState {
  /** §3 — Number of players (2–6). Default 2. */
  readonly playerCount: number;
  /** §3 — Starting life total. Default 40 (Commander). */
  readonly initialLife: number;
  /**
   * §9.9 — user-initiated reset counter ONLY: bumped by RESTART,
   * SET_PLAYER_COUNT, SET_INITIAL_LIFE (not HYDRATE, not color changes).
   * Key for PlayerProvider remount + AI Judge chat (`chat-v${version}`);
   * stable across reloads so persisted chat survives (SPEC §9.9).
   */
  readonly version: number;
  /** §8.5.1 — multi-select color identity per player. Default `["r"]`. */
  readonly playerColors: Record<PlayerId, PlayerColor>;
  /** true after the initial IndexedDB read resolves (found or not). */
  readonly isHydrated: boolean;
  /** Live per-player states loaded at startup; null once any setup action runs. */
  readonly hydratedPlayerStates: PlayerState[] | null;
}

/* ── Action types ── */
export type GameAction =
  | { type: "SET_PLAYER_COUNT"; count: number }
  | { type: "SET_INITIAL_LIFE"; value: number }
  | { type: "RESTART" }
  | {
      type: "SET_GAME_PLAYER_COLOR";
      playerId: PlayerId;
      color: PlayerColor;
    }
  | { type: "HYDRATE"; init: GameInit | null; playerStates: PlayerState[] | null };

/* ── Context value ── */
export interface GameContextValue {
  readonly state: GameState;
  readonly dispatch: React.Dispatch<GameAction>;
}
