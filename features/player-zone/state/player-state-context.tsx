"use client";

import { createContext, use, useMemo, useReducer, type ReactNode } from "react";
import type {
  PlayerColor,
  PlayerId,
} from "@/features/player-zone/types/player";
import type { CommanderDamage } from "@/features/player-zone/types/CommanderDamage";
import type { Counter } from "@/features/player-zone/types/counter";
import {
  DEFAULT_COUNTERS,
  COUNTER_TYPE_CUSTOM,
} from "@/features/player-zone/constants/counter";
import { DEFAULT_PLAYER_COLOR } from "@/features/player-zone/constants/player";
import { useOptionalGameStateContext } from "@/features/game-shell/state/game-state-context";

/* ── State ── */
export interface PlayerState {
  readonly playerId: PlayerId;
  readonly life: number;
  readonly color: PlayerColor;
  /** §5 — one entry per commander in play, keyed by commander owner's playerId. */
  readonly commanderDamage: CommanderDamage[];
  /** §7.4 — default counters + any custom counters */
  readonly counters: Counter[];
}

/* ── Action types ── */
const ADJUST_LIFE = "ADJUST_LIFE" as const;
const SET_LIFE = "SET_LIFE" as const;
const SET_COLOR = "SET_COLOR" as const;
const ADJUST_COMMANDER_DAMAGE = "ADJUST_COMMANDER_DAMAGE" as const;
const ADJUST_COUNTER = "ADJUST_COUNTER" as const;
const ADD_COUNTER = "ADD_COUNTER" as const;

type PlayerAction =
  | { type: typeof ADJUST_LIFE; delta: number }
  | { type: typeof SET_LIFE; value: number }
  | { type: typeof SET_COLOR; color: PlayerColor }
  | {
      type: typeof ADJUST_COMMANDER_DAMAGE;
      commanderPlayerId: PlayerId;
      delta: number;
    }
  | { type: typeof ADJUST_COUNTER; id: string; delta: number }
  | { type: typeof ADD_COUNTER; id: string; name: string };

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

export function adjustCommanderDamage(
  commanderPlayerId: PlayerId,
  delta: number,
): PlayerAction {
  return { type: ADJUST_COMMANDER_DAMAGE, commanderPlayerId, delta };
}

export function adjustCounter(id: string, delta: number): PlayerAction {
  return { type: ADJUST_COUNTER, id, delta };
}

export function addCounter(id: string, name: string): PlayerAction {
  return { type: ADD_COUNTER, id, name };
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

/* ── Context ── */
interface PlayerContextValue {
  readonly state: PlayerState;
  readonly dispatch: React.Dispatch<PlayerAction>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

/**
 * §2 — Per-player state provider.
 *
 * Donut Hole pattern: thin client boundary that creates isolated React Context
 * per player. Server-rendered children (layouts, SVG icons, modals) pass
 * through the `children` prop unchanged — only leaf interactive components
 * that call {@link usePlayerStateContext} need to be client.
 *
 * When `playerIndex` is provided, initial life and color are read from the
 * parent {@link GameProvider} (SPEC §3 defaults: 40 life, derived color).
 * Standalone usage (no GameProvider) falls back to hardcoded defaults.
 *
 * @see DESIGN.md §10, SPEC.md §3
 */
export function PlayerProvider({
  playerIndex,
  children,
}: {
  readonly playerIndex?: number;
  readonly children: ReactNode;
}) {
  /* Always call hooks at the top level — Rules of Hooks compliant. */
  const gameCtx = useOptionalGameStateContext();
  const hasGameCtx = playerIndex !== undefined && gameCtx !== null;

  const playerCount = hasGameCtx ? gameCtx.state.playerCount : 2;
  const initialState: PlayerState = {
    playerId: (playerIndex ?? 0) as PlayerId,
    life: hasGameCtx ? gameCtx.state.initialLife : 40,
    color: (hasGameCtx
      ? gameCtx.state.playerColors[playerIndex as PlayerId]
      : DEFAULT_PLAYER_COLOR) as PlayerColor,
    commanderDamage: Array.from({ length: playerCount }, (_, i) => ({
      playerId: i as PlayerId,
      value: 0,
    })),
    counters: DEFAULT_COUNTERS,
  };
  const [state, dispatch] = useReducer(playerReducer, initialState);

  const value: PlayerContextValue = useMemo(
    () => ({ state, dispatch }),
    [state, dispatch],
  );

  return <PlayerContext value={value}>{children}</PlayerContext>;
}

/**
 * Reads player state and dispatch from the nearest PlayerProvider.
 * Must be called within a component rendered inside PlayerProvider.
 */
export function usePlayerStateContext(): PlayerContextValue {
  const ctx = use(PlayerContext);
  if (!ctx)
    throw new Error(
      "usePlayerStateContext must be used within a <PlayerProvider>",
    );
  return ctx;
}
