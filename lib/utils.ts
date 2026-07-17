/**
 * Return the warm white (`#FAF8F5`) or warm near-black (`#1A1A1A`)
 * that maximizes WCAG contrast against the given hex background.
 *
 * Uses the sRGB relative-luminance algorithm (WCAG 2.2 §1.4.3).
 * Threshold ≈ 0.179 (perceived brightness).
 */
export function contrastText(hex: string): "#FAF8F5" | "#1A1A1A" {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.substring(0, 2), 16) / 255;
  const g = Number.parseInt(clean.substring(2, 4), 16) / 255;
  const b = Number.parseInt(clean.substring(4, 6), 16) / 255;

  const linearize = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

  const luminance =
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);

  return luminance > 0.179 ? "#1A1A1A" : "#FAF8F5";
}
