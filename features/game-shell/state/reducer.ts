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

// ============================================================================
// HELPERS
// ============================================================================

/**
 * @description
 * Rebuilds the player colors dictionary when player count changes.
 * Guaranteed O(N) performance with a single allocation, avoiding expensive
 * Object.entries() mapping and garbage collection spikes.
 */
function adjustPlayerColors(
  oldColors: Record<PlayerId, PlayerColor>,
  oldCount: number,
  newCount: number,
): Record<PlayerId, PlayerColor> {
  // same count — keep colors unchanged
  if (oldCount === newCount) {
    return oldColors;
  }

  const newColors = {} as Record<PlayerId, PlayerColor>;

  for (let i = 0; i < newCount; i++) {
    const id = i as PlayerId;
    // §8.4.1 / §8.4.2 — Keep existing colors for first N, append defaults for new players
    newColors[id] = i < oldCount ? oldColors[id] : [...DEFAULT_PLAYER_COLOR];
  }

  return newColors;
}

// ============================================================================
// REDUCER
// ============================================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case SET_PLAYER_COUNT:
      return {
        ...state,
        playerCount: action.count,
        playerColors: adjustPlayerColors(
          state.playerColors,
          state.playerCount,
          action.count,
        ),
        // §8.4 — reset applies to existing players; same-count selection too.
        version: state.version + 1,
        hydratedPlayerStates: null,
      };

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
      const hasHydrationData =
        action.init !== null || action.playerStates !== null;

      // §4.3 — neither store found → keep §3 defaults, no remount needed.
      if (!hasHydrationData) {
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
        version: state.version + 1,
      };
    }

    default:
      return state;
  }
}
