"use client";

import { DialogShell } from "@/shared/components/DialogShell";

interface CountersProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onClose: () => void;
}

/**
 * §7.4 — Counters overlay (placeholder).
 *
 * Full-screen dialog showing poison, energy, experience, time counters.
 * Close via swipe (zone-level), backdrop click, or Escape.
 *
 * @see DESIGN.md §7.4
 */
export function Counters({ dialogRef, onClose }: CountersProps) {
  return (
    <DialogShell
      dialogRef={dialogRef}
      ariaLabelledBy="counters-title"
      onClose={onClose}
    >
      <div className="m-auto flex flex-col items-center gap-6 py-16">
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
