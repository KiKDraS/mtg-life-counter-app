"use client";

import {
  createContext,
  use,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  PlayerId,
  PlayerColor,
} from "@/features/player-zone/types/player";
import type { PlayerState } from "@/features/player-zone/state/player-state-context";
import { DEFAULT_PLAYER_COLOR } from "@/features/player-zone/constants/player";
import {
  idbGet,
  idbPut,
  STORE_INIT,
  STORE_STATE,
  type GameInit,
  type GameStateRecord,
} from "@/features/persistence/idb";

/* ── State ── */
export interface GameState {
  /** §3 — Number of players (2–6). Default 2. */
  readonly playerCount: number;
  /** §3 — Starting life total. Default 40 (Commander). */
  readonly initialLife: number;
  /** Bumped on restart → PlayerProvider key changes → remount with fresh defaults. */
  readonly version: number;
  /** §8.5.1 — multi-select color identity per player. Default `["r"]`. */
  readonly playerColors: Record<PlayerId, PlayerColor>;
  /** true after the initial IndexedDB read resolves (found or not). */
  readonly isHydrated: boolean;
  /** Live per-player states loaded at startup; null once any setup action runs. */
  readonly hydratedPlayerStates: PlayerState[] | null;
}

/* ── Action types ── */
const SET_PLAYER_COUNT = "SET_PLAYER_COUNT" as const;
const SET_INITIAL_LIFE = "SET_INITIAL_LIFE" as const;
const RESTART = "RESTART" as const;
const SET_GAME_PLAYER_COLOR = "SET_GAME_PLAYER_COLOR" as const;
const HYDRATE = "HYDRATE" as const;

type GameAction =
  | { type: typeof SET_PLAYER_COUNT; count: number }
  | { type: typeof SET_INITIAL_LIFE; value: number }
  | { type: typeof RESTART }
  | {
      type: typeof SET_GAME_PLAYER_COLOR;
      playerId: PlayerId;
      color: PlayerColor;
    }
  | { type: typeof HYDRATE; init: GameInit | null; playerStates: PlayerState[] | null };

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

/** §4.3 — Hydrates game-init bootstrap + game-state live values post-mount. */
export function hydrateGame(
  init: GameInit | null,
  playerStates: PlayerState[] | null,
): GameAction {
  return { type: HYDRATE, init, playerStates };
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

/* ── Context ── */
interface GameContextValue {
  readonly state: GameState;
  readonly dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

/* §3 defaults: 2 players, 40 life, version=0. */
function initPlayerColors(count: number): Record<PlayerId, PlayerColor> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [i, [...DEFAULT_PLAYER_COLOR]]),
  ) as Record<PlayerId, PlayerColor>;
}

const GAME_INITIAL: GameState = {
  playerCount: 2,
  initialLife: 40,
  version: 0,
  playerColors: initPlayerColors(2),
  isHydrated: false,
  hydratedPlayerStates: null,
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
export function GameProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, GAME_INITIAL);

  /* §4.4 — client hydrator: read both stores post-mount, no render blocking.
     SSR renders §3 defaults exclusively (isHydrated=false). */
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      idbGet<GameInit>(STORE_INIT, "init"),
      idbGet<GameStateRecord>(STORE_STATE, "state"),
    ])
      .then(([init, stateRecord]) => {
        if (cancelled) return;
        dispatch(hydrateGame(init ?? null, stateRecord?.playerStates ?? null));
      })
      // IDB blocked/private mode → fall back to §3 defaults, keep app usable.
      .catch(() => {
        if (cancelled) return;
        dispatch(hydrateGame(null, null));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* §4.1 — persist bootstrap settings after hydration and on every setup change. */
  useEffect(() => {
    if (!state.isHydrated) return;
    const init: GameInit = {
      players: state.playerCount,
      initialLife: state.initialLife,
      playerColors: state.playerColors,
    };
    void idbPut(STORE_INIT, "init", init).catch(() => {});
  }, [state.isHydrated, state.playerCount, state.initialLife, state.playerColors]);

  const value: GameContextValue = useMemo(
    () => ({ state, dispatch }),
    [state, dispatch],
  );

  return <GameContext value={value}>{children}</GameContext>;
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
