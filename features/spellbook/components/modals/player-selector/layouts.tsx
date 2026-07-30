import { MANA } from "@/shared/lib/constants/colors";

/* ── Layout definitions ── */

interface PlayerRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rotated: boolean;
}

/** §4.1 — zone positions per player count. viewBox 120x160. */
const LAYOUTS: Record<number, PlayerRect[]> = {
  2: [
    { x: 10, y: 10, w: 100, h: 60, rotated: true },
    { x: 10, y: 90, w: 100, h: 60, rotated: false },
  ],
  3: [
    { x: 10, y: 10, w: 100, h: 60, rotated: true },
    { x: 10, y: 90, w: 45, h: 60, rotated: true },
    { x: 65, y: 90, w: 45, h: 60, rotated: true },
  ],
  4: [
    { x: 10, y: 10, w: 45, h: 60, rotated: true },
    { x: 65, y: 10, w: 45, h: 60, rotated: true },
    { x: 10, y: 90, w: 45, h: 60, rotated: false },
    { x: 65, y: 90, w: 45, h: 60, rotated: false },
  ],
  5: [
    { x: 10, y: 10, w: 100, h: 40, rotated: true },
    { x: 10, y: 60, w: 45, h: 45, rotated: true },
    { x: 65, y: 60, w: 45, h: 45, rotated: true },
    { x: 10, y: 115, w: 45, h: 40, rotated: true },
    { x: 65, y: 115, w: 45, h: 40, rotated: true },
  ],
  6: [
    { x: 5, y: 5, w: 33, h: 70, rotated: true },
    { x: 43, y: 5, w: 33, h: 70, rotated: true },
    { x: 81, y: 5, w: 33, h: 70, rotated: true },
    { x: 5, y: 85, w: 33, h: 70, rotated: false },
    { x: 43, y: 85, w: 33, h: 70, rotated: false },
    { x: 81, y: 85, w: 33, h: 70, rotated: false },
  ],
};

/* ── Colors ── */

/** §2.1 — cycle WUBRG for multi-zone layouts to suggest player identity. */
const MANA_ORDER = [MANA.w, MANA.u, MANA.b, MANA.r, MANA.g] as const;

/**
 * §6.3 — SVG layout preview for a given player count.
 *
 * Renders player zone rects matching §4.1 layout diagrams.
 * Top-row zones show 180° rotation indicator (small arc arrow).
 * Each rect filled with cycled mana colors.
 */
export function LayoutPreview({ count }: { readonly count: number }) {
  const rects = LAYOUTS[count];
  if (!rects) return null;

  return (
    <svg
      viewBox="0 0 120 160"
      className="w-full h-full"
      aria-hidden="true"
    >
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

            {/* Rotation indicator — small arc on top-rotated zones */}
            {rect.rotated && (
              <g
                transform={`translate(${rect.x + rect.w - 8}, ${rect.y + 8})`}
              >
                <path
                  d="M 3,-4 A 5,5 0 1,1 -3,-4"
                  fill="none"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={1.5}
                />
                <polygon
                  points="-3,-4 -1,-2 -1,-6"
                  fill="rgba(0,0,0,0.35)"
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
