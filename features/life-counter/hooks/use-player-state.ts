"use client";

import { useReducer } from "react";
import type { PlayerColor } from "@/features/life-counter/types/player";

/* ── State ── */
export interface PlayerState {
  readonly life: number;
  readonly color: PlayerColor;
  /* ponytail: single opponent for 2p. Migrate to Record<number, number> when adding multi-player. */
  readonly commanderDamage: number;
}

/* ── Action types ── */
const ADJUST_LIFE = "ADJUST_LIFE" as const;
const SET_LIFE = "SET_LIFE" as const;
const SET_COLOR = "SET_COLOR" as const;
const ADJUST_COMMANDER_DAMAGE = "ADJUST_COMMANDER_DAMAGE" as const;

type PlayerAction =
  | { type: typeof ADJUST_LIFE; delta: number }
  | { type: typeof SET_LIFE; value: number }
  | { type: typeof SET_COLOR; color: PlayerColor }
  | { type: typeof ADJUST_COMMANDER_DAMAGE; delta: number };

/* ── Action creators ── */
export function adjustLife(delta: number): PlayerAction {
  return { type: ADJUST_LIFE, delta };
}

export function setLife(value: number): PlayerAction {
  return { type: SET_LIFE, value };
}

export function setColor(color: PlayerColor): PlayerAction {
  return { type: SET_COLOR, color };
}

export function adjustCommanderDamage(delta: number): PlayerAction {
  return { type: ADJUST_COMMANDER_DAMAGE, delta };
}

/* ── Reducer ── */
function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case ADJUST_LIFE:
      return { ...state, life: state.life + action.delta };
    case SET_LIFE:
      return { ...state, life: action.value };
    case SET_COLOR:
      return { ...state, color: action.color };
    case ADJUST_COMMANDER_DAMAGE:
      return {
        ...state,
        commanderDamage: state.commanderDamage + action.delta,
        life: state.life - action.delta,
      };
  }
}

/* ── Hook ── */
export function usePlayerState(
  initialLife: number,
  initialColor: PlayerColor,
) {
  return useReducer(playerReducer, {
    life: initialLife,
    color: initialColor,
    commanderDamage: 0,
  });
}
