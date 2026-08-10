import { MANA, ManaColor, UI } from "@/shared/lib/constants/colors";
import { textColorFor } from "@/shared/lib/text-color-for";

export interface ZoneStyles {
  readonly background: string;
  readonly textColor: string;
  readonly textShadow: string;
}

/**
 * §8.5.1 — Build equal-hard-stop `to bottom right` gradient for selected colors.
 * Single color → solid. N colors → each `100/N`% band with duplicated stops.
 *
 * @see SPEC.md §8.5.1, DESIGN.md §6.5
 */
function buildGradient(colors: ManaColor[]): string {
  if (colors.length === 1) return MANA[colors[0]];
  const step = 100 / colors.length;
  const stops = colors
    .map((c, i) => {
      const start = i * step;
      const end = (i + 1) * step;
      return `${MANA[c]} ${start}%, ${MANA[c]} ${end}%`;
    })
    .join(", ");
  return `linear-gradient(to bottom right, ${stops})`;
}

/**
 * @description Resolve background + auto-contrast text color for a player zone.
 * Multi-select → equal-hard-stop `to bottom right` gradient. Text color uses
 * the FIRST (dominant) color for luminance contrast.
 *
 * @param color — selected mana colors (PlayerState.color per §8.5.1).
 * @returns CSS background and textColor strings.
 *
 * @see SPEC.md §8.5.1, DESIGN.md §6.5
 */
export function zoneStylesFor(colors: ManaColor[]): ZoneStyles {
  const hexes = colors.map((c) => MANA[c]);

  const textColor = textColorFor(hexes);

  const textShadow =
    textColor === UI.textLight
      ? "0px 2px 2px rgba(0,0,0,0.4), 0px 0px 2px rgba(0,0,0,0.8)"
      : "0px 2px 2px rgba(255,255,255,0.5), 0px 0px 2px rgba(255,255,255,0.9)";

  return {
    background: buildGradient(colors),
    textColor,
    textShadow,
  };
}
