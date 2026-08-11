"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { PlayerState } from "@/features/player-zone/state/types";
import { useOptionalGameStateContext } from "@/features/game-shell/state/hooks";
import { idbPut, STORE_STATE } from "./idb";

interface PlayerStatesRegistryValue {
  readonly reportPlayerState: (state: PlayerState) => void;
}

const PlayerStatesRegistryContext =
  createContext<PlayerStatesRegistryValue | null>(null);

/**
 * §4.2 — Single-writer collector for the `game-state` store.
 *
 * Context & Architecture:
 * - Performance: Uses a mutable `useRef` instead of `useState` to completely eliminate
 *   re-renders when life totals change.
 * - Event-Driven: Persists to IndexedDB synchronously upon receiving the final player's
 *   report, eliminating complex useEffect dependencies.
 */
export function PlayerStatesRegistry({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const gameCtx = useOptionalGameStateContext();

  const statesMapRef = useRef(new Map<number, PlayerState>());

  const isHydrated = gameCtx?.state.isHydrated ?? false;
  const playerCount = gameCtx?.state.playerCount ?? 0;

  useEffect(() => {
    statesMapRef.current.clear();
  }, [playerCount]);

  const reportPlayerState = useCallback(
    (state: PlayerState) => {
      const map = statesMapRef.current;
      map.set(state.playerId, state);

      if (!isHydrated || !playerCount) return;

      if (map.size === playerCount) {
        const playerStates = Array.from(
          { length: playerCount },
          (_, i) => map.get(i)!,
        );

        // Disparo en segundo plano (Fire and forget)
        idbPut(STORE_STATE, "state", { playerStates }).catch(console.warn);
      }
    },
    [isHydrated, playerCount],
  );

  const contextValue = useMemo(
    () => ({ reportPlayerState }),
    [reportPlayerState],
  );

  return (
    <PlayerStatesRegistryContext value={contextValue}>
      {children}
    </PlayerStatesRegistryContext>
  );
}

/**
 * Non-throwing variant — returns null when called outside a
 * <PlayerStatesRegistry> (tolerates standalone PlayerProvider usage).
 */
export function useOptionalPlayerStatesRegistry(): PlayerStatesRegistryValue | null {
  return use(PlayerStatesRegistryContext);
}
