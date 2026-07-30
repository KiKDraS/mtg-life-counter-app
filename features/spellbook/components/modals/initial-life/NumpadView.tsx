"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/shared/lib/cn";

interface NumpadViewProps {
  readonly onSubmit: (value: number) => void;
}

/**
 * §6.2 — Custom life value input.
 *
 * Native <input type="number"> with [+ Add] button.
 * Enter key or button click submits validated value.
 *
 * @see DESIGN.md §6.2
 */
export function NumpadView({ onSubmit }: NumpadViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const raw = inputRef.current?.value.trim();
    if (!raw) return;
    const value = Number(raw);
    const isValid = Number.isInteger(value) && value >= 1;
    if (!isValid) return;
    onSubmit(value);
  }, [onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSubmit();
    },
    [handleSubmit],
  );

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
        aria-label="Custom starting life"
        autoFocus
        onKeyDown={handleKeyDown}
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
        onClick={handleSubmit}
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
