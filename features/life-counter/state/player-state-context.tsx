"use client";

import {
  createContext,
  use,
  useReducer,
  type ReactNode,
} from "react";
import type { PlayerColor } from "@/features/life-counter/types/player";
import type { Counter } from "@/features/life-counter/types/counter";
import { DEFAULT_COUNTERS } from "@/features/life-counter/constants/counter";
import { useOptionalGameStateContext } from "@/features/life-counter/state/game-state-context";

/* ── State ── */
export interface PlayerState {
  readonly life: number;
  readonly color: PlayerColor;
  /* ponytail: single opponent for 2p. Migrate to Record<number, number> when adding multi-player. */
  readonly commanderDamage: number;
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
  | { type: typeof ADJUST_COMMANDER_DAMAGE; delta: number }
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

export function adjustCommanderDamage(delta: number): PlayerAction {
  return { type: ADJUST_COMMANDER_DAMAGE, delta };
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
            type: "custom" as const,
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

  const [state, dispatch] = useReducer(playerReducer, {
    life: hasGameCtx ? gameCtx.state.initialLife : 40,
    color: "r" as PlayerColor,
    commanderDamage: 0,
    counters: DEFAULT_COUNTERS,
  });

  return (
    <PlayerContext value={{ state, dispatch }}>
      {children}
    </PlayerContext>
  );
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
