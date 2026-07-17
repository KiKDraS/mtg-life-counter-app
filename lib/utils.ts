import { UI } from "@/lib/constants/colors";

/**
 * Return the warm white or warm near-black that maximizes WCAG contrast
 * against the given hex background.
 *
 * Uses the sRGB relative-luminance algorithm (WCAG 2.2 §1.4.3).
 * Threshold ≈ 0.179 (perceived brightness).
 */
export function contrastText(hex: string): (typeof UI)[keyof typeof UI] {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.substring(0, 2), 16) / 255;
  const g = Number.parseInt(clean.substring(2, 4), 16) / 255;
  const b = Number.parseInt(clean.substring(4, 6), 16) / 255;

  const linearize = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

  const luminance =
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);

  return luminance > 0.179 ? UI.textDark : UI.textLight;
}
