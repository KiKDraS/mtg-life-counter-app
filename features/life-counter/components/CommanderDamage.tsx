"use client";

import { DialogShell } from "@/shared/components/DialogShell";

interface CommanderDamageProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onClose: () => void;
}

/**
 * §7.3 — Commander Damage overlay (placeholder).
 *
 * Full-screen dialog showing commander damage per opponent.
 * Close via swipe (zone-level), backdrop click, or Escape.
 *
 * @see DESIGN.md §7.3
 */
export function CommanderDamage({
  dialogRef,
  onClose,
}: CommanderDamageProps) {

  return (
    <DialogShell
      dialogRef={dialogRef}
      ariaLabelledBy="commander-damage-title"
      onClose={onClose}
    >
      <div className="m-auto flex flex-col items-center gap-6 py-16">
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
