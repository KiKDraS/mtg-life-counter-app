import { useLifeAdjustment } from "@/features/player-zone/hooks/use-life-adjustment";
import {
  adjustLife,
  usePlayerStateContext,
} from "@/features/player-zone/state/player-state-context";
import { LifeSign } from "@/features/player-zone/types/life";
import { cn } from "@/shared/lib/cn";

/**
 * @description
 * Reusable life adjustment button (+ / -).
 * Encapsulates the hold-to-accelerate hook and context dispatch.
 */
export function LifeAdjustmentButton({
  delta,
  label,
  ariaLabel,
}: {
  readonly delta: LifeSign;
  readonly label: string;
  readonly ariaLabel: string;
}) {
  const { dispatch } = usePlayerStateContext();
  const adjustment = useLifeAdjustment((d) => dispatch(adjustLife(d)));

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        "flex h-full w-full items-center justify-center text-4xl font-bold leading-none",
        "select-none touch-manipulation",
        "transition-shadow duration-150 active:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.08)]",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current",
      )}
      {...adjustment(delta)}
    >
      {label}
    </button>
  );
}
