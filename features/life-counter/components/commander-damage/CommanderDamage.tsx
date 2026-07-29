import { DialogShell } from "@/shared/components/DialogShell";
import { OverlaySurface } from "@/shared/components/OverlaySurface";
import { CommanderDamageContent } from "./CommanderDamageContent";

interface CommanderDamageProps {
  readonly id: string;
  readonly playerId: number;
}

/**
 * §7.3 — Commander Damage overlay (RSC shell).
 *
 * Full-screen dialog showing commander damage from each opponent.
 * Interactive content lives in {@link CommanderDamageContent}.
 *
 * Close via:
 * - Tap background (OverlaySurface)
 * - Swipe (handled by PlayerZoneInteractive)
 * - Escape (DialogShell handles natively)
 *
 * @see DESIGN.md §7.3
 */
export function CommanderDamage({ id, playerId }: CommanderDamageProps) {
  return (
    <DialogShell id={id} ariaLabelledBy="commander-damage-title">
      <OverlaySurface dialogId={id}>
        <CommanderDamageContent playerId={playerId} />
      </OverlaySurface>
    </DialogShell>
  );
}
