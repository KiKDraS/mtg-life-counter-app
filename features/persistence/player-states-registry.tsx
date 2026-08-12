"use client";

import {
  createContext,
  use,
  useCallback,
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

  // Reset synchronously during render so remounted PlayerProviders (triggered by
  // a playerCount change) report into a clean map — a passive effect would run
  // after they've already reported, leaving stale keys in the map.
  const lastCountRef = useRef(playerCount);
  if (lastCountRef.current !== playerCount) {
    lastCountRef.current = playerCount;
    // Render-phase reset is intentional: it must run before remounted
    // PlayerProviders fire their passive effects and report into the map.
    // eslint-disable-next-line react-hooks/refs
    statesMapRef.current = new Map();
  }

  const reportPlayerState = useCallback(
    (state: PlayerState) => {
      const map = statesMapRef.current;
      map.set(state.playerId, state);

      if (!isHydrated || !playerCount) return;

      if (map.size === playerCount) {
        const playerStates = Array.from(
          { length: playerCount },
          (_, i) => map.get(i),
        ).filter((s): s is PlayerState => s !== undefined);
        if (playerStates.length !== playerCount) return;

        // Fire-and-forget; empty catch preserves pre-refactor silent-fail behavior.
        void idbPut(STORE_STATE, "state", { playerStates }).catch(() => {});
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
