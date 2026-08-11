import type { GameState, GameAction } from "./types";
import {
  SET_PLAYER_COUNT,
  SET_INITIAL_LIFE,
  RESTART,
  SET_GAME_PLAYER_COLOR,
  HYDRATE,
} from "./constants";
import { DEFAULT_PLAYER_COLOR } from "@/features/player-zone/constants/player";
import type {
  PlayerId,
  PlayerColor,
} from "@/features/player-zone/types/player";

/* ── Reducer ── */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case SET_PLAYER_COUNT: {
      const newCount = action.count;
      const oldCount = state.playerCount;
      let newColors: Record<PlayerId, PlayerColor>;
      if (newCount > oldCount) {
        // §8.4.1 — preserve existing colors, append defaults for new players
        const extras = Object.fromEntries(
          Array.from({ length: newCount - oldCount }, (_, i) => [
            String(oldCount + i),
            [...DEFAULT_PLAYER_COLOR],
          ]),
        );
        newColors = { ...state.playerColors, ...extras } as Record<
          PlayerId,
          PlayerColor
        >;
      } else if (newCount < oldCount) {
        // §8.4.2 — keep first N, discard removed players
        newColors = Object.fromEntries(
          Object.entries(state.playerColors).slice(0, newCount),
        ) as Record<PlayerId, PlayerColor>;
      } else {
        // same count — keep colors unchanged, still triggers reset via restartGame()
        newColors = state.playerColors;
      }
      return {
        ...state,
        playerCount: newCount,
        playerColors: newColors,
        // §8.4 — reset applies to existing players; same-count selection too.
        version: state.version + 1,
        hydratedPlayerStates: null,
      };
    }
    case SET_INITIAL_LIFE:
      // §8.3 — remount → §8.1 reset with the new initial life.
      return {
        ...state,
        initialLife: action.value,
        version: state.version + 1,
        hydratedPlayerStates: null,
      };
    case RESTART:
      return {
        ...state,
        version: state.version + 1,
        hydratedPlayerStates: null,
      };
    case SET_GAME_PLAYER_COLOR:
      return {
        ...state,
        playerColors: {
          ...state.playerColors,
          [action.playerId]: action.color,
        },
        hydratedPlayerStates: null,
      };
    case HYDRATE: {
      // §4.3 — neither store found → keep §3 defaults, no remount needed.
      if (action.init === null && action.playerStates === null) {
        return { ...state, isHydrated: true };
      }
      return {
        ...state,
        isHydrated: true,
        playerCount: action.init?.players ?? state.playerCount,
        initialLife: action.init?.initialLife ?? state.initialLife,
        playerColors: action.init?.playerColors ?? state.playerColors,
        hydratedPlayerStates: action.playerStates,
        // Remount providers whenever anything is restored (init OR live state)
        // so §4.3 bootstrap applies to already-mounted providers too.
        version:
          action.init !== null || action.playerStates !== null
            ? state.version + 1
            : state.version,
      };
    }
  }
}
