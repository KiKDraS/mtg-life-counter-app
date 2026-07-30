import { DialogShell } from "@/shared/components/DialogShell";
import { InitialLifeContent } from "./InitialLifeContent";

interface InitialLifeModalProps {
  readonly id: string;
}

/**
 * §6.2 Initial Life Selector Modal (RSC shell).
 *
 * Native <dialog> with a 2-col preset grid.
 * Interactive content lives in {@link InitialLifeContent}.
 *
 * Close via:
 * - Tap backdrop (DialogShell native handler)
 * - Escape (DialogShell native handler)
 * - Preset selection or numpad Enter (client leaf closes)
 *
 * No ✕ close button per §6.1.
 *
 * @see DESIGN.md §6.2
 * @see SPEC.md §8.3
 */
export function InitialLifeModal({ id }: InitialLifeModalProps) {
  return (
    <DialogShell id={id} ariaLabelledBy="initial-life-title">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <h2
          id="initial-life-title"
          className="text-heading text-ui-textLight mb-8"
        >
          Initial Life
        </h2>
        <InitialLifeContent dialogId={id} />
      </div>
    </DialogShell>
  );
}
