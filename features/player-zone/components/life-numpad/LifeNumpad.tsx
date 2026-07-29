import { DialogShell } from "@/shared/components/DialogShell";
import { NumpadInput } from "./NumpadInput";

interface LifeNumpadProps {
  readonly id: string;
}

/**
 * §7.1 — Numpad for exact life entry (RSC shell).
 *
 * Native `<dialog>` with a 3×4 phone-style keypad.
 * Double-tap the life total opens this dialog.
 * The interactive digit entry lives in {@link NumpadInput}.
 *
 * @see DESIGN.md §7.1
 */
export function LifeNumpad({ id }: LifeNumpadProps) {
  return (
    <DialogShell id={id} ariaLabelledBy="numpad-title">
      <h2 id="numpad-title" className="sr-only">
        Set life total
      </h2>
      <div className="p-6">
        <NumpadInput dialogId={id} />
      </div>
    </DialogShell>
  );
}
