import { DialogShell } from "@/shared/components/DialogShell";
import { ManaWheel } from "./color-wheels/ManaWheel";
import { ConfirmButton } from "./color-wheels/ConfirmButton";

interface ColorPickerProps {
  readonly id: string;
}

/**
 * §6.5 Color Picker Modal (RSC shell).
 *
 * Circular wheel (WUBRG + Colorless clockwise) with a centered CheckCircle ✓.
 * Width = fit-content via centered content on a full-screen dialog (keeps
 * backdrop dismiss working across the whole viewport). Multi-select toggles
 * dispatch live (`ManaActionButton`); ✓ / Colorless / backdrop / Escape close
 * only.
 *
 * @see DESIGN.md §6.5, SPEC.md §8.5.1
 */
export function ColorPicker({ id }: ColorPickerProps) {
  return (
    <DialogShell
      id={id}
      ariaLabelledBy="color-picker-title"
      className="items-center justify-center"
    >
      <h2 id="color-picker-title" className="sr-only">
        Color Picker
      </h2>
      <div className="relative aspect-square w-[min(90cqmin,32rem)]">
        <ManaWheel id={id} />
        <ConfirmButton id={id} />
      </div>
    </DialogShell>
  );
}
