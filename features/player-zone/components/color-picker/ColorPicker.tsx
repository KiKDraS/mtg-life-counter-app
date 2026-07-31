import { WUBRG } from "@/features/player-zone/constants/player";
import { DialogShell } from "@/shared/components/DialogShell";
import { ManaActionButton } from "./ManaActionButton";
import { ManaWheel } from "./color-wheels/ManaWheel";

interface ColorPickerProps {
  readonly id: string;
}

/**
 * §6.5 Color Picker Modal (RSC shell).
 *
 * Native `<dialog>` with an 80/20 vertical split:
 *   - 80% — mana symbol wheel (WUBRG order, circular layout via CSS transforms)
 *   - 20% — filter strip with WUBRG action, Colorless action
 *
 * Mana wheel buttons delegate to the Client Leaf {@link ManaActionButton}
 * which dispatches SET_COLOR and closes the dialog.
 *
 * @see DESIGN.md §6.5
 */
export function ColorPicker({ id }: ColorPickerProps) {
  return (
    <DialogShell id={id} ariaLabelledBy="color-picker-title">
      {/* 80% — color selection area */}
      <div className="w-full h-full max-w-4/5 m-auto grid grid-rows-1 grid-cols-[80%_20%]">
        <div className="relative flex w-full h-full m-auto items-center justify-center">
          <ManaWheel id={id} />
        </div>

        {/* 20% — filter strip (§6.5) */}
        <div className="flex h-14 shrink-0 items-center justify-around border-t border-white/10">
          <ManaActionButton
            color={WUBRG}
            dialogId={id}
            className="rounded px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
          >
            WUBRG
          </ManaActionButton>
        </div>
      </div>
    </DialogShell>
  );
}
