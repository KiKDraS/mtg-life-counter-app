"use client";

import { useEffect, useMemo, useReducer, type ReactNode } from "react";
import { GameContext } from "./context";
import { gameReducer } from "./reducer";
import { GAME_INITIAL } from "./constants";
import { hydrateGame } from "./actions";
import type { GameContextValue } from "./types";
import {
  idbGet,
  idbPut,
  STORE_INIT,
  STORE_STATE,
  type GameInit,
  type GameStateRecord,
} from "@/features/persistence/idb";

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
