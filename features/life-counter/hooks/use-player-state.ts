"use client";

import { useReducer } from "react";
import type { PlayerColor } from "@/features/life-counter/types/player";

/* ── State ── */
export interface PlayerState {
  readonly life: number;
  readonly color: PlayerColor;
}

/* ── Action types ── */
const ADJUST_LIFE = "ADJUST_LIFE" as const;
const SET_LIFE = "SET_LIFE" as const;
const SET_COLOR = "SET_COLOR" as const;

type PlayerAction =
  | { type: typeof ADJUST_LIFE; delta: number }
  | { type: typeof SET_LIFE; value: number }
  | { type: typeof SET_COLOR; color: PlayerColor };

/* ── Action creators ── */

/**
 * @description Dispatch an adjust-life action (±delta from current).
 * @param delta — signed integer to add to the player's life total.
 * @returns A `PlayerAction` consumable by `playerReducer`.
 */
export function adjustLife(delta: number): PlayerAction {
  return { type: ADJUST_LIFE, delta };
}

/**
 * @description Dispatch a set-life action (absolute value, replaces current).
 * @param value — new life total (e.g. entered via numpad).
 * @returns A `PlayerAction` consumable by `playerReducer`.
 */
export function setLife(value: number): PlayerAction {
  return { type: SET_LIFE, value };
}

/**
 * @description Dispatch a set-color action.
 * @param color — the new player identity color (single mana color or "wubrg").
 * @returns A `PlayerAction` consumable by `playerReducer`.
 */
export function setColor(color: PlayerColor): PlayerAction {
  return { type: SET_COLOR, color };
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
  }
}

/* ── Hook ── */

/**
 * @description Player state reducer hook.
 * Manages life total and color identity per player zone via `useReducer`.
 * Callers dispatch `adjustLife`, `setLife`, or `setColor`.
 *
 * @param initialLife — starting life total (defaults to 40 in PlayerZone).
 * @param initialColor — starting player color identity.
 * @returns A tuple of `[PlayerState, React.Dispatch<PlayerAction>]`.
 *
 * @see DESIGN.md §4 — Player Zone
 * @see DESIGN.md §6.5 — Color Picker
 */
export function usePlayerState(
  initialLife: number,
  initialColor: PlayerColor,
) {
  return useReducer(playerReducer, { life: initialLife, color: initialColor });
}
