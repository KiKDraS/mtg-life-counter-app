import { DialogShell } from "@/shared/components/DialogShell";
import { PlayerSelectorContent } from "./PlayerSelectorContent";

interface PlayerSelectorModalProps {
  readonly id: string;
}

/**
 * §6.3 Player Selector Modal (RSC shell).
 *
 * Native <dialog> with SVG layout previews for 2p–6p.
 * Interactive content lives in {@link PlayerSelectorContent}.
 *
 * Close via:
 * - Tap backdrop (DialogShell native handler)
 * - Escape (DialogShell native handler)
 * - SVG selection (client leaf closes)
 *
 * No ✕ close button per §6.1.
 *
 * @see DESIGN.md §6.3
 * @see SPEC.md §8.4
 */
export function PlayerSelectorModal({ id }: PlayerSelectorModalProps) {
  return (
    <DialogShell id={id} ariaLabelledBy="player-selector-title">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <h2
          id="player-selector-title"
          className="text-heading text-ui-textLight mb-8"
        >
          Players
        </h2>
        <PlayerSelectorContent dialogId={id} />
      </div>
    </DialogShell>
  );
}
