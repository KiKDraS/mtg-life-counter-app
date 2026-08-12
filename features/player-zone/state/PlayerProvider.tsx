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
 * Lazy-init argument for {@link buildInitialState} — captures the derived
 * SPEC §3 defaults + §4.3 hydrated state read from the GameProvider.
 */
interface PlayerInit {
  readonly playerIndex: number;
  readonly playerCount: number;
  readonly initialLife: number;
  readonly color: PlayerColor;
  readonly hydrated: PlayerState | null;
}

/**
 * §3/§4.3 — useReducer lazy initializer. Runs once per mount (PlayerProvider
 * keyed on `version-isHydrated` → remount on user reset OR hydration landing
 * rebuilds the same state), never per render.
 * Allocates the commanderDamage array only on mount.
 */
function buildInitialState(init: PlayerInit): PlayerState {
  const { playerIndex, playerCount, initialLife, color, hydrated } = init;
  return {
    playerId: (playerIndex ?? 0) as PlayerId,
    life: hydrated?.life ?? initialLife,
    color,
    commanderDamage:
      hydrated?.commanderDamage?.length === playerCount
        ? hydrated.commanderDamage
        : Array.from({ length: playerCount }, (_, i) => ({
            playerId: i as PlayerId,
            value: 0,
          })),
    counters: hydrated?.counters ?? DEFAULT_COUNTERS,
  };
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
  /* Lazy-init arg — consumed once on mount; cheap references, no allocation. */
  const init: PlayerInit = {
    playerIndex,
    playerCount,
    initialLife: hasGameCtx ? gameCtx.state.initialLife : 40,
    color: (hasGameCtx
      ? gameCtx.state.playerColors[playerIndex as PlayerId]
      : DEFAULT_PLAYER_COLOR) as PlayerColor,
    hydrated,
  };
  const [state, dispatch] = useReducer(playerReducer, init, buildInitialState);

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
