import type { SVGAttributes } from "react";
import { SHARD_COLORS, UI } from "@/lib/constants/colors";

type NayaSymbolProps = {
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const [c1, c2, c3] = SHARD_COLORS.naya;

function NayaSymbol({ size = 48, className, ...props }: NayaSymbolProps) {
  return (
    <span role="img" aria-label="Naya" className={className}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} {...props}>
        <defs>
          <linearGradient id="nayaGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="33.3%" stopColor={c1} />
            <stop offset="33.3%" stopColor={c2} />
            <stop offset="66.6%" stopColor={c2} />
            <stop offset="66.6%" stopColor={c3} />
            <stop offset="100%" stopColor={c3} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#nayaGrad)" />
        {/* Three claw marks — Naya's primal beast theme */}
        <path fill={UI.iconDark} d="M22 15 Q35 42 25 78 Q20 82 16 78 Q22 40 16 18 Z" />
        <path fill={UI.iconDark} d="M50 20 Q58 48 48 82 Q44 85 40 82 Q52 46 44 22 Z" />
        <path fill={UI.iconDark} d="M76 28 Q82 52 68 85 Q64 88 60 84 Q74 50 68 30 Z" />
      </svg>
    </span>
  );
}

export default NayaSymbol;
