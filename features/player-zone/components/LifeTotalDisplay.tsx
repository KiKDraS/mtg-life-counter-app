import { UI } from "@/shared/lib/constants/colors";
import { cn } from "@/shared/lib/cn";

interface LifeTotalDisplayProps {
  readonly life: number;
  readonly textColor: string;
  readonly isLethal: boolean;
  readonly isCommanderLethal: boolean;
  readonly isPoisonLethal: boolean;
  readonly delta: number;
  readonly pending: number;
}

/**
 * @description
 * Renders the central life total, conditional lethal badges, and burst delta.
 * Staged ±10 preview (§4.2) shows at 50% opacity and hides the committed
 * delta while active — the two never overlap.
 */
export function LifeTotalDisplay({
  life,
  textColor,
  isLethal,
  isCommanderLethal,
  isPoisonLethal,
  delta,
  pending,
}: Readonly<LifeTotalDisplayProps>) {
  const badgeClass =
    "text-caption font-bold uppercase tracking-wider leading-tight";
  const isAlive = life > 0;
  const isPending = pending !== 0;
  const displayDelta = isPending ? pending : delta;

  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      <div className="relative">
        {displayDelta !== 0 && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute bottom-full left-0 right-0 mb-1 text-center tabular-nums font-bold leading-none text-delta",
              isPending && "opacity-50",
            )}
            style={{ color: textColor }}
          >
            {displayDelta > 0 ? "+" : "−"}
            {Math.abs(displayDelta)}
          </span>
        )}

        <p
          aria-live="polite"
          aria-atomic="true"
          className="tabular-nums font-black leading-none text-life"
          style={{ color: isLethal ? UI.danger : textColor }}
        >
          {life}
        </p>
      </div>

      {isAlive && isCommanderLethal && (
        <span className={badgeClass} style={{ color: UI.danger }}>
          Commander Damage Lethal
        </span>
      )}

      {isAlive && isPoisonLethal && (
        <span className={badgeClass} style={{ color: UI.danger }}>
          Poison Lethal
        </span>
      )}
    </div>
  );
}
