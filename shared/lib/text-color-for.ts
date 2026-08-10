// @/shared/lib/text-color-for.ts
import { UI } from "@/shared/lib/constants/colors";

type ContrastCandidate = typeof UI.textLight | typeof UI.textDark;

function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.substring(0, 2), 16) / 255;
  const g = Number.parseInt(clean.substring(2, 4), 16) / 255;
  const b = Number.parseInt(clean.substring(4, 6), 16) / 255;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * @description
 * Returns the text color that guarantees the highest MINIMUM contrast
 * across an array of background colors (Minimax algorithm).
 */
export function textColorFor(backgroundHexes: string[]): ContrastCandidate {
  const lightLuminance = relativeLuminance(UI.textLight);
  const darkLuminance = relativeLuminance(UI.textDark);

  let worstLightContrast = Infinity;
  let worstDarkContrast = Infinity;

  // Calculamos el peor caso posible para cada color de texto
  for (const hex of backgroundHexes) {
    const bg = relativeLuminance(hex);
    worstLightContrast = Math.min(
      worstLightContrast,
      contrastRatio(bg, lightLuminance),
    );
    worstDarkContrast = Math.min(
      worstDarkContrast,
      contrastRatio(bg, darkLuminance),
    );
  }

  // Elegimos el candidato cuyo "peor caso" siga siendo más legible
  return worstLightContrast > worstDarkContrast ? UI.textLight : UI.textDark;
}
