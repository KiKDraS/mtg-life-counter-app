"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import {
  useGameStateContext,
  setInitialLife,
  restartGame,
} from "@/features/game-shell/state/game-state-context";

interface InitialLifeContentProps {
  readonly dialogId: string;
}

type View = "grid" | "numpad";

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
  const [view, setView] = useState<View>("grid");
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    (document.getElementById(dialogId) as HTMLDialogElement | null)?.close();
    // Reset view for next open
    setView("grid");
  }, [dialogId]);

  const selectLife = useCallback(
    (value: number) => {
      dispatch(setInitialLife(value));
      dispatch(restartGame());
      close();
    },
    [dispatch, close],
  );

  const handleCustomSubmit = useCallback(() => {
    const raw = inputRef.current?.value.trim();
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) return;
    selectLife(value);
  }, [selectLife]);

  const handleNumpadKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleCustomSubmit();
    },
    [handleCustomSubmit],
  );

  if (view === "numpad") {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-body text-ui-textLight/70">
          Enter custom starting life
        </p>

        <input
          ref={inputRef}
          type="number"
          min={1}
          placeholder="40"
          autoFocus
          onKeyDown={handleNumpadKeyDown}
          className={cn(
            "w-40 rounded border border-white/20 bg-transparent px-4 py-3 text-center",
            "text-display font-black tabular-nums text-ui-textLight",
            "focus:border-white/60 focus:outline-none",
            "[&::-webkit-inner-spin-button]:appearance-none",
            "[&::-webkit-outer-spin-button]:appearance-none",
          )}
        />

        <button
          type="button"
          onClick={handleCustomSubmit}
          className={cn(
            "rounded bg-ui-textLight/10 px-8 py-2",
            "text-body font-medium text-ui-textLight",
            "hover:bg-ui-textLight/20 transition-colors",
            "focus-visible:outline-2 focus-visible:outline-white",
            "cursor-pointer",
          )}
        >
          + Add
        </button>
      </div>
    );
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
              "flex flex-col items-center justify-center rounded-lg border border-white/10 py-6",
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
        onClick={() => setView("numpad")}
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
