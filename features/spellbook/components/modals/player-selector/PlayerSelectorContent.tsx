"use client";

import { useCallback } from "react";
import { cn } from "@/shared/lib/cn";
import {
  useGameStateContext,
  setPlayerCount,
  restartGame,
} from "@/features/game-shell/state/game-state-context";
import { LayoutPreview } from "./layouts";

interface PlayerSelectorContentProps {
  readonly dialogId: string;
}

/** §6.3 — Player counts in grid order: 2 rows of 2, 6p centered below. */
const PLAYER_COUNTS = [2, 3, 4, 5, 6] as const;

/**
 * §6.3 Player Selector Content — Client leaf.
 *
 * 2-col grid of SVG layout previews. No text labels — layout IS the label.
 * Tap SVG → dispatch setPlayerCount + restartGame, close dialog.
 *
 * @see DESIGN.md §6.3
 * @see SPEC.md §8.4
 */
export function PlayerSelectorContent({
  dialogId,
}: PlayerSelectorContentProps) {
  const { dispatch } = useGameStateContext();

  const selectCount = useCallback(
    (count: number) => {
      dispatch(setPlayerCount(count));
      dispatch(restartGame());
      (document.getElementById(dialogId) as HTMLDialogElement | null)?.close();
    },
    [dispatch, dialogId],
  );

  return (
    <div className="grid w-full max-w-xs grid-cols-2 gap-6 justify-items-center-safe">
      {PLAYER_COUNTS.map((count) => {
        const isSingle = count === 6;
        return (
          <button
            key={count}
            type="button"
            aria-label={`${count} players`}
            onClick={() => selectCount(count)}
            className={cn(
              "flex aspect-3/4 items-center justify-center rounded-lg border border-white/10 p-1",
              "hover:bg-white/10 transition-colors",
              "focus-visible:outline-2 focus-visible:outline-white",
              "cursor-pointer max-w-32.5",
              isSingle && "col-span-2 mx-auto w-1/2",
            )}
          >
            <LayoutPreview count={count} />
          </button>
        );
      })}
    </div>
  );
}
