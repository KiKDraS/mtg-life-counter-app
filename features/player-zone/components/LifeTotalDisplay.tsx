import { UI } from "@/shared/lib/constants/colors";

interface LifeTotalDisplayProps {
  readonly life: number;
  readonly textColor: string;
  readonly isLethal: boolean;
  readonly isCommanderLethal: boolean;
  readonly isPoisonLethal: boolean;
  readonly delta: number;
}

/**
 * @description
 * Renders the central life total, conditional lethal badges, and burst delta.
 */
export function LifeTotalDisplay({
  life,
  textColor,
  isLethal,
  isCommanderLethal,
  isPoisonLethal,
  delta,
}: Readonly<LifeTotalDisplayProps>) {
  const badgeClass =
    "text-caption font-bold uppercase tracking-wider leading-tight";
  const isAlive = life > 0;

  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      <div className="relative">
        {delta !== 0 && (
          <span
            aria-hidden="true"
            className="absolute bottom-full left-0 right-0 mb-1 text-center tabular-nums font-bold leading-none text-delta"
            style={{ color: textColor }}
          >
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta)}
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
