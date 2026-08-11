import type { GameState } from "./types";
import type {
  PlayerId,
  PlayerColor,
} from "@/features/player-zone/types/player";
import { DEFAULT_PLAYER_COLOR } from "@/features/player-zone/constants/player";

/* ── Action types ── */
export const SET_PLAYER_COUNT = "SET_PLAYER_COUNT" as const;
export const SET_INITIAL_LIFE = "SET_INITIAL_LIFE" as const;
export const RESTART = "RESTART" as const;
export const SET_GAME_PLAYER_COLOR = "SET_GAME_PLAYER_COLOR" as const;
export const HYDRATE = "HYDRATE" as const;

/* §3 defaults: 2 players, 40 life, version=0. */
function initPlayerColors(count: number): Record<PlayerId, PlayerColor> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [i, [...DEFAULT_PLAYER_COLOR]]),
  ) as Record<PlayerId, PlayerColor>;
}

export const GAME_INITIAL: GameState = {
  playerCount: 2,
  initialLife: 40,
  version: 0,
  playerColors: initPlayerColors(2),
  isHydrated: false,
  hydratedPlayerStates: null,
};
