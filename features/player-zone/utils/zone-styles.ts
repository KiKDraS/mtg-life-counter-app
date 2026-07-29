import { MANA, UI } from "@/shared/lib/constants/colors";
import { textColorFor } from "@/shared/lib/text-color-for";
import { WUBRG } from "@/features/player-zone/constants/player";
import type { PlayerColor } from "@/features/player-zone/types/player";

/* §6.5 — hard-stop diagonal bands: W 0‑20%, U 20‑40%, B 40‑60%, R 60‑80%, G 80‑100% */
const WUBRG_GRADIENT = `linear-gradient(to bottom right, ${MANA.w} 0%,${MANA.w} 20%,${MANA.u} 20%,${MANA.u} 40%,${MANA.b} 40%,${MANA.b} 60%,${MANA.r} 60%,${MANA.r} 80%,${MANA.g} 80%,${MANA.g} 100%)`;

export interface ZoneStyles {
  readonly background: string;
  readonly textColor: string;
}

/**
 * @description Resolve background + auto-contrast text color for a player zone.
 * WUBRG returns a 5-color diagonal-strip gradient; single-mana colors return
 * a solid background with WCAG-computed light/dark text via textColorFor().
 *
 * @param color — player color identity (ManaColor or "wubrg").
 * @returns CSS background and textColor strings.
 *
 * @see DESIGN.md §6.5 — Color Picker / Zone Colors
 */
export function zoneStylesFor(color: PlayerColor): ZoneStyles {
  const isWubrg = color === WUBRG;
  if (isWubrg) {
    return { background: WUBRG_GRADIENT, textColor: UI.textDark };
  }

  return {
    background: MANA[color],
    textColor: textColorFor(MANA[color]),
  };
}
