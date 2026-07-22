"use client";

import { DialogShell } from "@/shared/components/DialogShell";
import { useSwipe } from "@/features/life-counter/hooks/use-swipe";

interface CommanderDamageProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onClose: () => void;
}

/**
 * §7.3 — Commander Damage overlay (placeholder).
 *
 * Full-screen dialog showing commander damage per opponent.
 * Swipe X-axis in either direction to close and return to life total.
 *
 * @see DESIGN.md §7.3
 */
export function CommanderDamage({
  dialogRef,
  onClose,
}: CommanderDamageProps) {

  /* Swipe X-axis (either direction) → close the overlay */
  useSwipe(dialogRef as React.RefObject<HTMLElement | null>, {
    onSwipeLeft: () => dialogRef.current?.close(),
    onSwipeRight: () => dialogRef.current?.close(),
  });

  return (
    <DialogShell
      dialogRef={dialogRef}
      ariaLabelledBy="commander-damage-title"
      onClose={onClose}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h2
          id="commander-damage-title"
          className="text-heading font-bold text-ui-textLight"
        >
          Commander Damage
        </h2>
        {/* ponytail: placeholder — full implementation per §7.3 when feature is built */}
        <p className="text-body text-ui-textLight/60">
          Swipe to close · Placeholder for opponent commander damage columns
        </p>
      </div>
    </DialogShell>
  );
}
