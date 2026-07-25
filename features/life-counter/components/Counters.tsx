"use client";

import { useCallback } from "react";
import { DialogShell } from "@/shared/components/DialogShell";
import { OverlaySurface } from "@/shared/components/OverlaySurface";
import { CounterRow } from "@/features/life-counter/components/CounterRow";
import { UI } from "@/shared/lib/constants/colors";
import type { Counter } from "@/features/life-counter/types/counter";

interface CountersProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onClose: () => void;
  readonly counters: Counter[];
  readonly onAdjust: (id: string, delta: number) => void;
  readonly onAdd: (id: string, name: string) => void;
  readonly onRemove: (id: string) => void;
}

/** Smallest unique suffix counter for custom counter ids. */
let customIdSeq = 0;

/**
 * @description
 * Counters overlay for tracking supplementary game stats (e.g., poison, energy).
 *
 * Context & Architecture:
 * - Employs native CSS Grid for a 2-column layout, eliminating JS-based array chunking.
 * - Flat mapping guarantees stable React reconciliation (`key={counter.id}`), preventing
 *   unnecessary re-renders when a counter is removed or added.
 * - Migrated inline structural styles to Tailwind utility classes to reduce memory allocation.
 *
 * @param {CountersProps} props - Component props.
 * @returns {JSX.Element}
 */
export function Counters({
  dialogRef,
  onClose,
  counters,
  onAdjust,
  onAdd,
  onRemove,
}: CountersProps) {
  /*
   * Handle adding a custom counter.
   * Note: window.prompt is synchronous and blocks the main thread.
   * For future iterations, consider replacing with a custom non-blocking UI modal.
   */
  const handleAddCustom = useCallback(() => {
    const rawName = window.prompt("Custom counter name:");
    const trimmedName = rawName?.trim();

    if (!trimmedName) return;

    /* Self-documenting ID creation */
    const customCounterId = `custom-${++customIdSeq}`;
    onAdd(customCounterId, trimmedName);
  }, [onAdd]);

  return (
    <DialogShell
      dialogRef={dialogRef}
      ariaLabelledBy="counters-title"
      onClose={onClose}
    >
      <OverlaySurface dialogRef={dialogRef}>
        <h2
          id="counters-title"
          className="text-heading font-bold text-ui-textLight"
        >
          Counters
        </h2>

        {/*
         * Architecture upgrade: CSS Grid handles the 2-column layout natively.
         * 'grid-cols-2' replaces the manual JS grouping and nested flexbox wrappers.
         */}
        <div className="grid w-full max-w-lg grid-cols-2 gap-6 px-4">
          {counters.map((counter) => (
            <CounterRow
              key={counter.id}
              counter={counter}
              onAdjust={onAdjust}
              onRemove={onRemove}
            />
          ))}
        </div>
      </OverlaySurface>

      {/* [+] button — fixed bottom-right */}
      <button
        type="button"
        aria-label="Add custom counter"
        className="absolute right-4 bottom-4 z-40 flex size-14 select-none touch-manipulation items-center justify-center rounded-full bg-white/10 text-4xl font-bold leading-none focus-visible:outline-none"
        style={{ color: UI.textLight }}
        onClick={handleAddCustom}
      >
        +
      </button>
    </DialogShell>
  );
}
