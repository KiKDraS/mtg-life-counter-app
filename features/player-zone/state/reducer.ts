import type { PlayerState, PlayerAction } from "./types";
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
      const nextCommanderDamage = [...state.commanderDamage];

      const idx = nextCommanderDamage.findIndex(
        (cd) => cd.playerId === action.commanderPlayerId,
      );

      if (idx !== -1) {
        nextCommanderDamage[idx] = {
          ...nextCommanderDamage[idx],
          value: nextCommanderDamage[idx].value + action.delta,
        };
      } else {
        nextCommanderDamage.push({
          playerId: action.commanderPlayerId,
          value: action.delta,
        });
      }

      return {
        ...state,
        commanderDamage: nextCommanderDamage,
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

    default:
      return state;
  }
}
