import { UI } from "@/shared/lib/constants/colors";

interface LifeTotalDisplayProps {
  readonly life: number;
  readonly textColor: string;
  readonly isLethal: boolean;
  readonly isCommanderLethal: boolean;
  readonly isPoisonLethal: boolean;
}

/**
 * @description
 * Renders the central life total and conditional lethal badges.
 */
export function LifeTotalDisplay({
  life,
  textColor,
  isLethal,
  isCommanderLethal,
  isPoisonLethal,
}: Readonly<LifeTotalDisplayProps>) {
  const badgeClass =
    "text-caption font-bold uppercase tracking-wider leading-tight";

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <p
        aria-live="polite"
        aria-atomic="true"
        className="tabular-nums font-black leading-none text-life"
        style={{ color: isLethal ? UI.danger : textColor }}
      >
        {life}
      </p>

      {life > 0 && isCommanderLethal && (
        <span className={badgeClass} style={{ color: UI.danger }}>
          Commander Damage Lethal
        </span>
      )}

      {life > 0 && isPoisonLethal && (
        <span className={badgeClass} style={{ color: UI.danger }}>
          Poison Lethal
        </span>
      )}
    </div>
  );
}
