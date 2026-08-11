import type { PlayerState, PlayerAction } from "./types";
import type { CommanderDamage } from "@/features/player-zone/types/CommanderDamage";
import {
  ADJUST_LIFE,
  SET_COLOR,
  ADJUST_COMMANDER_DAMAGE,
  ADJUST_COUNTER,
  ADD_COUNTER,
} from "./constants";
import { COUNTER_TYPE_CUSTOM } from "@/features/player-zone/constants/counter";

/* ── Reducer ── */
export function playerReducer(
  state: PlayerState,
  action: PlayerAction,
): PlayerState {
  switch (action.type) {
    case ADJUST_LIFE:
      return { ...state, life: state.life + action.delta };
    case SET_COLOR:
      return { ...state, color: action.color };
    case ADJUST_COMMANDER_DAMAGE: {
      const idx = state.commanderDamage.findIndex(
        (cd) => cd.playerId === action.commanderPlayerId,
      );
      const entry: CommanderDamage =
        idx !== -1
          ? {
              ...state.commanderDamage[idx],
              value: state.commanderDamage[idx].value + action.delta,
            }
          : { playerId: action.commanderPlayerId, value: action.delta };
      const next =
        idx !== -1
          ? state.commanderDamage.map((cd, i) => (i === idx ? entry : cd))
          : [...state.commanderDamage, entry];
      return {
        ...state,
        commanderDamage: next,
        life: state.life - action.delta,
      };
    }
    case ADJUST_COUNTER:
      return {
        ...state,
        counters: state.counters.map((c) =>
          c.id === action.id
            ? { ...c, value: Math.max(0, c.value + action.delta) }
            : c,
        ),
      };
    case ADD_COUNTER:
      return {
        ...state,
        counters: [
          ...state.counters,
          {
            id: action.id,
            type: COUNTER_TYPE_CUSTOM,
            value: 0,
            name: action.name,
          },
        ],
      };
  }
}
