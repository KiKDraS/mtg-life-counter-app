import { DialogShell } from "@/shared/components/DialogShell";
import { OverlaySurface } from "@/shared/components/OverlaySurface";
import { CountersContent } from "./CountersContent";
import { CustomCounterModal } from "./CustomCounterModal";

interface CountersProps {
  readonly id: string;
}

/**
 * §7.4 — Counters overlay (RSC shell).
 *
 * Full-screen dialog showing supplementary game stats (poison, energy, etc.).
 * Interactive content lives in {@link CountersContent}.
 * The "Add custom counter" sub-dialog is rendered as a sibling {@link CustomCounterModal}.
 *
 * @see DESIGN.md §7.4
 */
export function Counters({ id }: CountersProps) {
  const customCounterId = `${id}-custom`;

  return (
    <>
      <DialogShell
        id={id}
        ariaLabelledBy="counters-title"
        className="overflow-y-auto scrollbar-none"
      >
        <OverlaySurface dialogId={id} className="gap-[8cqmin] px-[6cqmin]">
          <CountersContent dialogId={id} customCounterId={customCounterId} />
        </OverlaySurface>
      </DialogShell>

      <CustomCounterModal id={customCounterId} />
    </>
  );
}
