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
 * §7.4 — Counters overlay.
 *
 * 2-column grid showing default counters (poison, energy, experience, time)
 * plus any custom counters added by the user.
 *
 * Close via tap-to-close (background), swipe (zone-level), or Escape.
 *
 * @see DESIGN.md §7.4
 */
export function Counters({
  dialogRef,
  onClose,
  counters,
  onAdjust,
  onAdd,
  onRemove,
}: CountersProps) {
  const handleAddCustom = useCallback(() => {
    const name = window.prompt("Custom counter name:");
    if (!name?.trim()) return;
    const id = `custom-${++customIdSeq}`;
    onAdd(id, name.trim());
  }, [onAdd]);

  /* Group counters into rows of 2 for the 2-column grid. */
  const rows: [Counter, Counter?][] = [];
  for (let i = 0; i < counters.length; i += 2) {
    rows.push([counters[i], counters[i + 1]]);
  }

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

        {/* 2-column grid */}
        <div className="flex w-full max-w-lg flex-col gap-6 px-4">
          {rows.map(([left, right]) => (
            <div key={left.id} className="flex justify-between gap-4">
              <CounterRow
                counter={left}
                onAdjust={onAdjust}
                onRemove={onRemove}
              />
              {right && (
                <CounterRow
                  counter={right}
                  onAdjust={onAdjust}
                  onRemove={onRemove}
                />
              )}
            </div>
          ))}
        </div>
      </OverlaySurface>

      {/* [+] button — fixed bottom-right */}
      <button
        type="button"
        aria-label="Add custom counter"
        className="absolute right-4 bottom-4 flex size-14 items-center justify-center rounded-full text-4xl font-bold leading-none select-none touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white z-40"
        style={{
          color: UI.textLight,
          backgroundColor: "rgba(255,255,255,0.1)",
        }}
        onClick={handleAddCustom}
      >
        +
      </button>
    </DialogShell>
  );
}
