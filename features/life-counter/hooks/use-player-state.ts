"use client";

import { useReducer } from "react";
import type { PlayerColor } from "@/features/life-counter/components/color-picker";

/* ── State ── */
export interface PlayerState {
  readonly life: number;
  readonly color: PlayerColor;
}

/* ── Action types ── */
const ADJUST_LIFE = "ADJUST_LIFE" as const;
const SET_COLOR = "SET_COLOR" as const;

type PlayerAction =
  | { type: typeof ADJUST_LIFE; delta: number }
  | { type: typeof SET_COLOR; color: PlayerColor };

/* ── Action creators ── */
export function adjustLife(delta: number): PlayerAction {
  return { type: ADJUST_LIFE, delta };
}

export function setColor(color: PlayerColor): PlayerAction {
  return { type: SET_COLOR, color };
}

/* ── Reducer ── */
function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case ADJUST_LIFE:
      return { ...state, life: state.life + action.delta };
    case SET_COLOR:
      return { ...state, color: action.color };
  }
}

/* ── Hook ── */
export function usePlayerState(
  initialLife: number,
  initialColor: PlayerColor,
) {
  return useReducer(playerReducer, { life: initialLife, color: initialColor });
}
