import { UI } from "@/shared/lib/constants/colors";

/**
 * @description
 * Renders the central life total and conditional lethal badges.
 * Handles double-click and keyboard events to open the numpad.
 */
export function LifeTotalDisplay({
  life,
  textColor,
  isLethal,
  isCommanderLethal,
  isPoisonLethal,
  onOpenNumpad,
}: {
  readonly life: number;
  readonly textColor: string;
  readonly isLethal: boolean;
  readonly isCommanderLethal: boolean;
  readonly isPoisonLethal: boolean;
  readonly onOpenNumpad: () => void;
}) {
  const badgeClass =
    "text-caption font-bold uppercase tracking-wider leading-tight";

  return (
    <button
      type="button"
      tabIndex={-1}
      className="flex h-full flex-col items-center justify-center"
      onClick={(e) => {
        if (e.detail === 2) onOpenNumpad();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onOpenNumpad();
          e.preventDefault();
        }
      }}
    >
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
    </button>
  );
}
