import type { GameAction } from "./types";
import type {
  PlayerId,
  PlayerColor,
} from "@/features/player-zone/types/player";
import type { PlayerState } from "@/features/player-zone/state/types";
import type { GameInit } from "@/features/persistence/idb";
import {
  SET_PLAYER_COUNT,
  SET_INITIAL_LIFE,
  RESTART,
  SET_GAME_PLAYER_COLOR,
  HYDRATE,
} from "./constants";

/* ── Action creators ── */
export function setPlayerCount(count: number): GameAction {
  return { type: SET_PLAYER_COUNT, count };
}

export function setInitialLife(value: number): GameAction {
  return { type: SET_INITIAL_LIFE, value };
}

export function restartGame(): GameAction {
  return { type: RESTART };
}

export function setGamePlayerColor(
  playerId: PlayerId,
  color: PlayerColor,
): GameAction {
  return { type: SET_GAME_PLAYER_COLOR, playerId, color };
}

/** §4.3 — Hydrates game-init bootstrap + game-state live values post-mount. */
export function hydrateGame(
  init: GameInit | null,
  playerStates: PlayerState[] | null,
): GameAction {
  return { type: HYDRATE, init, playerStates };
}
