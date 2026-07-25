"use client";

import { useReducer } from "react";
import type { PlayerColor } from "@/features/life-counter/types/player";
import type { Counter } from "@/features/life-counter/types/counter";
import { DEFAULT_COUNTERS } from "@/features/life-counter/types/counter";

/* ── State ── */
export interface PlayerState {
  readonly life: number;
  readonly color: PlayerColor;
  /* ponytail: single opponent for 2p. Migrate to Record<number, number> when adding multi-player. */
  readonly commanderDamage: number;
  /* §7.4 — default counters + any custom counters */
  readonly counters: Counter[];
}

/* ── Action types ── */
const ADJUST_LIFE = "ADJUST_LIFE" as const;
const SET_LIFE = "SET_LIFE" as const;
const SET_COLOR = "SET_COLOR" as const;
const ADJUST_COMMANDER_DAMAGE = "ADJUST_COMMANDER_DAMAGE" as const;
const ADJUST_COUNTER = "ADJUST_COUNTER" as const;
const ADD_COUNTER = "ADD_COUNTER" as const;
const REMOVE_COUNTER = "REMOVE_COUNTER" as const;

type PlayerAction =
  | { type: typeof ADJUST_LIFE; delta: number }
  | { type: typeof SET_LIFE; value: number }
  | { type: typeof SET_COLOR; color: PlayerColor }
  | { type: typeof ADJUST_COMMANDER_DAMAGE; delta: number }
  | { type: typeof ADJUST_COUNTER; id: string; delta: number }
  | { type: typeof ADD_COUNTER; id: string; name: string }
  | { type: typeof REMOVE_COUNTER; id: string };

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

export function adjustCounter(id: string, delta: number): PlayerAction {
  return { type: ADJUST_COUNTER, id, delta };
}

export function addCounter(id: string, name: string): PlayerAction {
  return { type: ADD_COUNTER, id, name };
}

export function removeCounter(id: string): PlayerAction {
  return { type: REMOVE_COUNTER, id };
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
    case ADJUST_COUNTER:
      return {
        ...state,
        counters: state.counters.map((c) =>
          c.id === action.id ? { ...c, value: c.value + action.delta } : c,
        ),
      };
    case ADD_COUNTER:
      return {
        ...state,
        counters: [
          ...state.counters,
          { id: action.id, type: "custom" as const, value: 0, name: action.name },
        ],
      };
    case REMOVE_COUNTER: {
      /* ponytail: only custom counters are removable. Defaults reset to 0. */
      const counter = state.counters.find((c) => c.id === action.id);
      if (!counter || counter.type === "custom") {
        return {
          ...state,
          counters: state.counters.filter((c) => c.id !== action.id),
        };
      }
      return {
        ...state,
        counters: state.counters.map((c) =>
          c.id === action.id ? { ...c, value: 0 } : c,
        ),
      };
    }
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
    counters: DEFAULT_COUNTERS,
  });
}
