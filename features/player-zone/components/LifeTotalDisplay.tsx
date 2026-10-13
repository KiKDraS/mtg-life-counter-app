import { useEffect, useRef } from "react";
import { UI } from "@/shared/lib/constants/colors";

interface LifeTotalDisplayProps {
  readonly life: number;
  readonly textColor: string;
  readonly isLethal: boolean;
  readonly isCommanderLethal: boolean;
  readonly isPoisonLethal: boolean;
  readonly delta: number;
  /** Monotonic counter bumped on every committed ± life change — keys the flash. */
  readonly flashKey: number;
}

/* §4.2 — brief life-change pulse: ~200ms, no layout shift. */
const FLASH_DURATION_MS = 200;
/* §4.2 — low-alpha tint (~35%), appended to the zone text-color token. */
const FLASH_TINT_ALPHA = "59";
/* §4.2 — luminance-derived tint: warm-white text → light tint, dark text → dark tint. */
const FLASH_TINT_LIGHT = `${UI.textLight}${FLASH_TINT_ALPHA}`;
const FLASH_TINT_DARK = `${UI.textDark}${FLASH_TINT_ALPHA}`;
/* §4.2 — life number scale pop during the flash. */
const FLASH_SCALE = 1.08;

/**
 * @description
 * Renders the central life total, conditional lethal badges, and burst delta.
 * §4.2 life-change flash = life number scale pop + center-column inset
 * highlight — both WAAPI animations on existing nodes, so the
 * `aria-live="polite"` element is never remounted and nothing shifts layout.
 * Skipped entirely under `prefers-reduced-motion: reduce` (§9), on the
 * initial mount, and for non-life-± sources (commander damage, resets).
 */
export function LifeTotalDisplay({
  life,
  textColor,
  isLethal,
  isCommanderLethal,
  isPoisonLethal,
  delta,
  flashKey,
}: Readonly<LifeTotalDisplayProps>) {
  const badgeClass =
    "text-caption font-bold uppercase tracking-wider leading-tight";
  const isAlive = life > 0;

  const rootRef = useRef<HTMLDivElement>(null);
  const lifeRef = useRef<HTMLParagraphElement>(null);
  const lastFlashKeyRef = useRef(flashKey);

  useEffect(() => {
    /* Skip the initial mount — fresh state starts clean. */
    if (flashKey === lastFlashKeyRef.current) return;
    lastFlashKeyRef.current = flashKey;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lifeEl = lifeRef.current;
    const rootEl = rootRef.current;
    if (!lifeEl || !rootEl) return;

    const tint =
      textColor === UI.textLight ? FLASH_TINT_LIGHT : FLASH_TINT_DARK;

    lifeEl.animate(
      [
        { transform: "scale(1)" },
        { transform: `scale(${FLASH_SCALE})` },
        { transform: "scale(1)" },
      ],
      { duration: FLASH_DURATION_MS, easing: "ease-out" },
    );
    rootEl.animate(
      [
        { boxShadow: `inset 0 0 0 9999px ${tint}` },
        { boxShadow: "inset 0 0 0 9999px transparent" },
      ],
      { duration: FLASH_DURATION_MS, easing: "ease-out" },
    );
  }, [flashKey, textColor]);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full flex-col items-center justify-center"
    >
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
          ref={lifeRef}
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
