import { UI } from "@/lib/constants/colors";

type ContrastCandidate = typeof UI.textLight | typeof UI.textDark;

/** sRGB channel → linear-light value (WCAG 2.2 §1.4.3). */
function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#RRGGBB` color. */
function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.substring(0, 2), 16) / 255;
  const g = Number.parseInt(clean.substring(2, 4), 16) / 255;
  const b = Number.parseInt(clean.substring(4, 6), 16) / 255;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two relative luminances. */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Return the warm white or warm near-black that yields the higher WCAG
 * contrast ratio against the given hex background.
 */
export function textColorFor(backgroundHex: string): ContrastCandidate {
  const bg = relativeLuminance(backgroundHex);
  const withLight = contrastRatio(bg, relativeLuminance(UI.textLight));
  const withDark = contrastRatio(bg, relativeLuminance(UI.textDark));
  return withLight > withDark ? UI.textLight : UI.textDark;
}

/**
 * @deprecated Use {@link textColorFor}. Kept as an alias so existing callers
 * keep working.
 */
export function contrastText(hex: string): ContrastCandidate {
  return textColorFor(hex);
}
