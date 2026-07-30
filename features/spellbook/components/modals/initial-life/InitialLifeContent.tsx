"use client";

import { useCallback, useState } from "react";
import { cn } from "@/shared/lib/cn";
import {
  useGameStateContext,
  setInitialLife,
  restartGame,
} from "@/features/game-shell/state/game-state-context";
import { NumpadView } from "./NumpadView";

interface InitialLifeContentProps {
  readonly dialogId: string;
}

/** §6.2 — View state for Initial Life modal. */
const ViewType = {
  Grid: "grid",
  Numpad: "numpad",
} as const;
type ViewType = (typeof ViewType)[keyof typeof ViewType];

const PRESETS = [
  { value: 20, label: "Standard" },
  { value: 30, label: "2HG" },
  { value: 40, label: "Commander" },
  { value: 60, label: "2HG" },
] as const;

/**
 * §6.2 Initial Life Content — Client leaf.
 *
 * Shows 2-col preset grid or custom numpad.
 * On selection: dispatches setInitialLife + restartGame, closes dialog.
 *
 * @see DESIGN.md §6.2
 * @see SPEC.md §8.3
 */
export function InitialLifeContent({ dialogId }: InitialLifeContentProps) {
  const { dispatch } = useGameStateContext();
  const [view, setView] = useState<ViewType>(ViewType.Grid);

  const close = useCallback(() => {
    (document.getElementById(dialogId) as HTMLDialogElement | null)?.close();
    setView(ViewType.Grid);
  }, [dialogId]);

  const selectLife = useCallback(
    (value: number) => {
      dispatch(setInitialLife(value));
      dispatch(restartGame());
      close();
    },
    [dispatch, close],
  );

  if (view === ViewType.Numpad) {
    return <NumpadView onSubmit={selectLife} />;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 2×2 preset grid */}
      <div className="grid w-full max-w-80 grid-cols-2 gap-3">
        {PRESETS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-label={`Set initial life to ${value}`}
            onClick={() => selectLife(value)}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border border-white/10 py-6 px-2 bg-ui-belt",
              "hover:bg-white/10 transition-colors",
              "focus-visible:outline-2 focus-visible:outline-white",
              "cursor-pointer",
            )}
          >
            <span className="text-display font-black tabular-nums leading-none text-ui-textLight">
              {value}
            </span>
            <span className="text-caption mt-1 font-medium text-ui-textLight/60">
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* [+] Add custom value */}
      <button
        type="button"
        onClick={() => setView(ViewType.Numpad)}
        className={cn(
          "text-body font-medium text-ui-textLight/60",
          "hover:text-ui-textLight transition-colors",
          "focus-visible:outline-2 focus-visible:outline-white",
          "cursor-pointer",
        )}
      >
        [+] Add custom value
      </button>
    </div>
  );
}
