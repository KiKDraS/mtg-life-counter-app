"use client";

import { DialogShell } from "@/shared/components/DialogShell";
import { OverlaySurface } from "@/shared/components/OverlaySurface";

interface CountersProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onClose: () => void;
}

/**
 * §7.4 — Counters overlay (placeholder, WIP).
 *
 * Full-screen dialog showing poison, energy, experience, time counters.
 * Close via tap-to-close (background), swipe (zone-level), or Escape.
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
      <OverlaySurface dialogRef={dialogRef}>
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
      </OverlaySurface>
    </DialogShell>
  );
}
