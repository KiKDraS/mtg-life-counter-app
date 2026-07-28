"use client";

import {
  createContext,
  use,
  useReducer,
  type ReactNode,
} from "react";

/* ── State ── */
export interface GameState {
  /** §3 — Number of players (2–6). Default 2. */
  readonly playerCount: number;
  /** §3 — Starting life total. Default 40 (Commander). */
  readonly initialLife: number;
  /** Bumped on restart → PlayerProvider key changes → remount with fresh defaults. */
  readonly version: number;
}

/* ── Action types ── */
const SET_PLAYER_COUNT = "SET_PLAYER_COUNT" as const;
const SET_INITIAL_LIFE = "SET_INITIAL_LIFE" as const;
const RESTART = "RESTART" as const;

type GameAction =
  | { type: typeof SET_PLAYER_COUNT; count: number }
  | { type: typeof SET_INITIAL_LIFE; value: number }
  | { type: typeof RESTART };

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

/* ── Reducer ── */
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case SET_PLAYER_COUNT:
      return { ...state, playerCount: action.count };
    case SET_INITIAL_LIFE:
      return { ...state, initialLife: action.value };
    case RESTART:
      return { ...state, version: state.version + 1 };
  }
}

/* ── Context ── */
interface GameContextValue {
  readonly state: GameState;
  readonly dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

/* §3 defaults: 2 players, 40 life, version=0. */
const GAME_INITIAL: GameState = {
  playerCount: 2,
  initialLife: 40,
  version: 0,
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
