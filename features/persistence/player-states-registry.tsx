"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PlayerState } from "@/features/player-zone/state/player-state-context";
import { useOptionalGameStateContext } from "@/features/game-shell/state/game-state-context";
import { idbPut, STORE_STATE } from "./idb";

interface PlayerStatesRegistryValue {
  readonly reportPlayerState: (state: PlayerState) => void;
}

const PlayerStatesRegistryContext =
  createContext<PlayerStatesRegistryValue | null>(null);

/**
 * §4.2 — Single-writer collector for the `game-state` store.
 *
 * Per-player {@link PlayerProvider}s report their live state up here (one
 * writer), which persists the full `{ playerStates }` record after every
 * change. Writes only once hydration completes and every player has reported,
 * so the persisted array always matches `playerCount`.
 *
 * @see SPEC.md §4.2, §5
 */
export function PlayerStatesRegistry({
  children,
}: {
  readonly children: ReactNode;
}) {
  const gameCtx = useOptionalGameStateContext();
  const [map, setMap] = useState<Record<number, PlayerState>>({});
  // playerCount change → providers remount (version bump); drop pre-remount
  // stale reports so the next write is fresh. Empty map produces no write.
  // (Render-time state adjustment per React docs.)
  const [lastPlayerCount, setLastPlayerCount] = useState(
    gameCtx?.state.playerCount,
  );
  if (lastPlayerCount !== gameCtx?.state.playerCount) {
    setLastPlayerCount(gameCtx?.state.playerCount);
    setMap({});
  }

  const reportPlayerState = useCallback((state: PlayerState) => {
    setMap((prev) => ({ ...prev, [state.playerId]: state }));
  }, []);

  useEffect(() => {
    if (!gameCtx?.state.isHydrated) return;
    const playerStates = Array.from(
      { length: gameCtx.state.playerCount },
      (_, i) => map[i],
    ).filter((s): s is PlayerState => s !== undefined);
    // ponytail: remount transient window — skip until every player reported.
    if (playerStates.length !== gameCtx.state.playerCount) return;
    void idbPut(STORE_STATE, "state", { playerStates }).catch(() => {});
  }, [map, gameCtx?.state.isHydrated, gameCtx?.state.playerCount]);

  return (
    <PlayerStatesRegistryContext value={{ reportPlayerState }}>
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
