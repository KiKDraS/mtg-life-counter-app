"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from "react";
import { PlayerContext } from "./context";
import { playerReducer } from "./reducer";
import type { PlayerContextValue, PlayerState } from "./types";
import type {
  PlayerColor,
  PlayerId,
  PlayerZoneRotation,
} from "@/features/player-zone/types/player";
import { DEFAULT_COUNTERS } from "@/features/player-zone/constants/counter";
import { DEFAULT_PLAYER_COLOR } from "@/features/player-zone/constants/player";
import { useOptionalGameStateContext } from "@/features/game-shell/state/hooks";
import { useOptionalPlayerStatesRegistry } from "@/features/persistence/player-states-registry";

interface PlayerProviderProps extends PropsWithChildren {
  playerIndex: number;
  playerZoneRotation: PlayerZoneRotation;
  isOnBottomSlot: boolean;
}

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
  playerZoneRotation,
  isOnBottomSlot,
  children,
}: Readonly<PlayerProviderProps>) {
  /* Always call hooks at the top level — Rules of Hooks compliant. */
  const gameCtx = useOptionalGameStateContext();
  const hasGameCtx = playerIndex !== undefined && gameCtx !== null;

  const registry = useOptionalPlayerStatesRegistry();
  /* Stable no-op outside a registry — PlayerProvider may render standalone. */
  const noopReport = useCallback(() => {}, []);
  const reportPlayerState = registry?.reportPlayerState ?? noopReport;

  const playerCount = hasGameCtx ? gameCtx.state.playerCount : 2;
  /* §4.3 — persisted live state wins over §3 defaults when restored. */
  const hydrated = hasGameCtx
    ? gameCtx.state.hydratedPlayerStates?.[playerIndex as PlayerId] ?? null
    : null;
  const initialState: PlayerState = {
    playerId: (playerIndex ?? 0) as PlayerId,
    life: hydrated?.life ?? (hasGameCtx ? gameCtx.state.initialLife : 40),
    color: (hasGameCtx
      ? gameCtx.state.playerColors[playerIndex as PlayerId]
      : DEFAULT_PLAYER_COLOR) as PlayerColor,
    commanderDamage:
      hydrated?.commanderDamage?.length === playerCount
        ? hydrated.commanderDamage
        : Array.from({ length: playerCount }, (_, i) => ({
            playerId: i as PlayerId,
            value: 0,
          })),
    counters: hydrated?.counters ?? DEFAULT_COUNTERS,
  };
  const [state, dispatch] = useReducer(playerReducer, initialState);

  /* §4.2 — report live state up to the single-writer registry. */
  useEffect(() => {
    reportPlayerState(state);
  }, [state, reportPlayerState]);

  const value: PlayerContextValue = useMemo(
    () => ({ state, playerZoneRotation, isOnBottomSlot, dispatch }),
    [state, playerZoneRotation, isOnBottomSlot],
  );

  return <PlayerContext value={value}>{children}</PlayerContext>;
}
