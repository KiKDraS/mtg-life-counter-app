"use client";

import {
  createContext,
  use,
  useReducer,
  type ReactNode,
} from "react";
import type { PlayerId, PlayerColor } from "@/features/player-zone/types/player";
import { DEFAULT_PLAYER_COLOR } from "@/features/player-zone/constants/player";

/* ── State ── */
export interface GameState {
  /** §3 — Number of players (2–6). Default 2. */
  readonly playerCount: number;
  /** §3 — Starting life total. Default 40 (Commander). */
  readonly initialLife: number;
  /** Bumped on restart → PlayerProvider key changes → remount with fresh defaults. */
  readonly version: number;
  /** §6.5 — Per-player color identity, synced by ColorPicker. All "r" until changed. */
  readonly playerColors: Record<PlayerId, PlayerColor>;
}

/* ── Action types ── */
const SET_PLAYER_COUNT = "SET_PLAYER_COUNT" as const;
const SET_INITIAL_LIFE = "SET_INITIAL_LIFE" as const;
const RESTART = "RESTART" as const;
const SET_GAME_PLAYER_COLOR = "SET_GAME_PLAYER_COLOR" as const;

type GameAction =
  | { type: typeof SET_PLAYER_COUNT; count: number }
  | { type: typeof SET_INITIAL_LIFE; value: number }
  | { type: typeof RESTART }
  | { type: typeof SET_GAME_PLAYER_COLOR; playerId: PlayerId; color: PlayerColor };

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

/* ── Reducer ── */
function gameReducer(state: GameState, action: GameAction): GameState {
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
            DEFAULT_PLAYER_COLOR,
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
      };
    }
    case SET_INITIAL_LIFE:
      return { ...state, initialLife: action.value };
    case RESTART:
      return { ...state, version: state.version + 1 };
    case SET_GAME_PLAYER_COLOR:
      return {
        ...state,
        playerColors: {
          ...state.playerColors,
          [action.playerId]: action.color,
        },
      };
  }
}

/* ── Context ── */
interface GameContextValue {
  readonly state: GameState;
  readonly dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

/* §3 defaults: 2 players, 40 life, version=0. */
function initPlayerColors(count: number): Record<PlayerId, PlayerColor> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [i, DEFAULT_PLAYER_COLOR as PlayerColor]),
  ) as Record<PlayerId, PlayerColor>;
}

const GAME_INITIAL: GameState = {
  playerCount: 2,
  initialLife: 40,
  version: 0,
  playerColors: initPlayerColors(2),
};

/**
 * §2 — Game-level state provider.
 *
 * Donut Hole pattern: thin client boundary that wraps the entire game tree.
 * Server-rendered children (layouts, SVG icons, modals) pass through
 * `children` unchanged.
 *
 * Holds player count, initial life, and a version counter. Bumping version
 * causes each PlayerProvider (keyed on `version`) to remount with fresh
 * defaults — effectively "restart all lives".
 *
 * @see SPEC.md §5 — GameState
 */
export function GameProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [state, dispatch] = useReducer(gameReducer, GAME_INITIAL);

  return (
    <GameContext value={{ state, dispatch }}>{children}</GameContext>
  );
}

/**
 * Reads game state and dispatch from the nearest GameProvider.
 * Throws if called outside a <GameProvider>.
 */
export function useGameStateContext(): GameContextValue {
  const ctx = use(GameContext);
  if (!ctx)
    throw new Error("useGameStateContext must be used within a <GameProvider>");
  return ctx;
}

/**
 * Non-throwing variant — returns null when called outside a <GameProvider>.
 * Always call this at the top level (Rules of Hooks compliant).
 */
export function useOptionalGameStateContext(): GameContextValue | null {
  return use(GameContext);
}
