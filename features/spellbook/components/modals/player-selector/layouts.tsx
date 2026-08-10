import { MANA } from "@/shared/lib/constants/colors";

/* ── Layout definitions ──
 *
 * viewBox 120x160. Rows spaced evenly with ~8px gaps.
 * Full rows: x=10, w=100. Split rows: 2 cols at x=10/x=65, w=45 each.
 */

interface PlayerRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * §4.1 — Zone positions per player count.
 *
 * Layout structure per DESIGN.md §4.1:
 *   2p: 2 stacked full rows
 *   3p: 1 full top + 2 split bottom
 *   4p: 2x2 grid (top split + bottom split)
 *   5p: 1 full + 2 rows of 2 split
 *   6p: 1 full + 2 rows split + 1 full bottom
 *
 * viewBox 120x160. Gap ~8px between rows.
 */
const LAYOUTS: Record<number, PlayerRect[]> = {
  2: [
    { x: 10, y: 8, w: 100, h: 68 },
    { x: 10, y: 84, w: 100, h: 68 },
  ],
  3: [
    { x: 10, y: 8, w: 100, h: 68 },
    { x: 10, y: 84, w: 45, h: 68 },
    { x: 65, y: 84, w: 45, h: 68 },
  ],
  4: [
    { x: 10, y: 8, w: 45, h: 68 },
    { x: 65, y: 8, w: 45, h: 68 },
    { x: 10, y: 84, w: 45, h: 68 },
    { x: 65, y: 84, w: 45, h: 68 },
  ],
  5: [
    { x: 10, y: 7, w: 100, h: 44 },
    { x: 10, y: 58, w: 45, h: 44 },
    { x: 65, y: 58, w: 45, h: 44 },
    { x: 10, y: 109, w: 45, h: 44 },
    { x: 65, y: 109, w: 45, h: 44 },
  ],
  6: [
    { x: 10, y: 8, w: 100, h: 30 },
    { x: 10, y: 46, w: 45, h: 30 },
    { x: 65, y: 46, w: 45, h: 30 },
    { x: 10, y: 84, w: 45, h: 30 },
    { x: 65, y: 84, w: 45, h: 30 },
    { x: 10, y: 122, w: 100, h: 30 },
  ],
};

/* ── Colors ── */

/** §2.1 — cycle WUBRG for multi-zone layouts to suggest player identity. */
const MANA_ORDER = [MANA.w, MANA.u, MANA.b, MANA.r, MANA.g, MANA.c] as const;

/**
 * §6.3 — SVG layout preview for a given player count.
 *
 * Renders player zone rects matching §4.1 layout diagrams (WUBRG fill cycle).
 */
export function LayoutPreview({ count }: { readonly count: number }) {
  const rects = LAYOUTS[count];
  if (!rects) return null;

  return (
    <svg viewBox="0 0 120 160" className="w-full h-full" aria-hidden="true">
      {rects.map((rect, i) => {
        const fill = MANA_ORDER[i % MANA_ORDER.length];
        return (
          <g key={i}>
            {/* Zone rect */}
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              rx={4}
              ry={4}
              fill={fill}
              opacity={0.9}
              stroke="rgba(0,0,0,0.15)"
              strokeWidth={1}
            />
          </g>
        );
      })}
    </svg>
  );
}
