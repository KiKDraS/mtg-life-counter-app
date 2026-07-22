"use client";

import { DialogShell } from "@/shared/components/DialogShell";
import { useSwipe } from "@/features/life-counter/hooks/use-swipe";

interface CountersProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onClose: () => void;
}

/**
 * §7.4 — Counters overlay (placeholder).
 *
 * Full-screen dialog showing poison, energy, experience, time counters.
 * Swipe X-axis in either direction to close and return to life total.
 *
 * @see DESIGN.md §7.4
 */
export function Counters({
  dialogRef,
  onClose,
}: CountersProps) {

  /* Swipe X-axis (either direction) → close the overlay */
  useSwipe(dialogRef as React.RefObject<HTMLElement | null>, {
    onSwipeLeft: () => dialogRef.current?.close(),
    onSwipeRight: () => dialogRef.current?.close(),
  });

  return (
    <DialogShell
      dialogRef={dialogRef}
      ariaLabelledBy="counters-title"
      onClose={onClose}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h2
          id="counters-title"
          className="text-heading font-bold text-ui-textLight"
        >
          Counters
        </h2>
        {/* ponytail: placeholder — full implementation per §7.4 when feature is built */}
        <p className="text-body text-ui-textLight/60">
          Swipe to close · Placeholder for poison, energy, experience, time
        </p>
      </div>
    </DialogShell>
  );
}
