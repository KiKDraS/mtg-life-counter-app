import type { ManaColor } from "@/shared/lib/constants/colors";
import { MANA } from "@/shared/lib/constants/colors";
import { cn } from "@/shared/lib/cn";
import { DialogShell } from "@/shared/components/DialogShell";
import ManaSelector from "@/shared/components/icons/ManaSelector";
import { ManaActionButton } from "./ManaActionButton";

interface ColorPickerProps {
  readonly id: string;
}

/* MANA keys in WUBRG order, slice off Colorless for the 5-color wheel. */
const MANA_KEYS = Object.keys(MANA).slice(0, 5) as ManaColor[];

const manaWheelBtnClass = cn(
  "absolute rounded-full",
  "transition-transform",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
);

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
      <div className="relative flex items-center justify-center w-81.25 h-full m-auto">
        {MANA_KEYS.map((color, i) => {
          const angle = i * 72;
          return (
            <ManaActionButton
              key={color}
              color={color}
              dialogId={id}
              className={manaWheelBtnClass}
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-6.5rem) rotate(-${angle}deg)`,
              }}
            >
              <ManaSelector color={color} size={72} />
            </ManaActionButton>
          );
        })}
      </div>

      {/* 20% — filter strip (§6.5) */}
      <div className="flex h-14 shrink-0 items-center justify-around border-t border-white/10 px-4">
        <ManaActionButton
          color="wubrg"
          dialogId={id}
          className="rounded px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          WUBRG
        </ManaActionButton>

        <ManaActionButton
          color="c"
          dialogId={id}
          className="rounded px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Colorless
        </ManaActionButton>
      </div>
    </DialogShell>
  );
}
