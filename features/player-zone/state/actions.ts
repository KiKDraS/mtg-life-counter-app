import type { PlayerAction } from "./types";
import type {
  PlayerId,
  PlayerColor,
} from "@/features/player-zone/types/player";
import {
  ADJUST_LIFE,
  SET_COLOR,
  ADJUST_COMMANDER_DAMAGE,
  ADJUST_COUNTER,
  ADD_COUNTER,
} from "./constants";

/* ── Action creators ── */
export function adjustLife(delta: number): PlayerAction {
  return { type: ADJUST_LIFE, delta };
}

export function setColor(color: PlayerColor): PlayerAction {
  return { type: SET_COLOR, color };
}

export function adjustCommanderDamage(
  commanderPlayerId: PlayerId,
  delta: number,
): PlayerAction {
  return { type: ADJUST_COMMANDER_DAMAGE, commanderPlayerId, delta };
}

export function adjustCounter(id: string, delta: number): PlayerAction {
  return { type: ADJUST_COUNTER, id, delta };
}

export function addCounter(id: string, name: string): PlayerAction {
  return { type: ADD_COUNTER, id, name };
}
