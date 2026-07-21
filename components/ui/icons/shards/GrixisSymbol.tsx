import type { SVGAttributes } from "react";
import { SHARD_COLORS, UI } from "@/lib/constants/colors";

type GrixisSymbolProps = {
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const [c1, c2, c3] = SHARD_COLORS.grixis;

function GrixisSymbol({ size = 48, className, ...props }: GrixisSymbolProps) {
  return (
    <span role="img" aria-label="Grixis" className={className}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} {...props}>
        <defs>
          <linearGradient id="grixisGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="33.3%" stopColor={c1} />
            <stop offset="33.3%" stopColor={c2} />
            <stop offset="66.6%" stopColor={c2} />
            <stop offset="66.6%" stopColor={c3} />
            <stop offset="100%" stopColor={c3} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#grixisGrad)" />
        {/* Skull — Grixis's necromantic / demonic theme */}
        <path fill={UI.iconDark} d="M24 28 Q24 12 37 12 Q43 6 50 6 Q57 6 63 12 Q76 12 76 28 L76 55 Q76 80 50 88 Q24 80 24 55 Z" />
        {/* Left horn */}
        <path fill={UI.iconDark} d="M28 18 Q20 8 16 4 L22 16 Z" />
        {/* Right horn */}
        <path fill={UI.iconDark} d="M72 18 Q80 8 84 4 L78 16 Z" />
        {/* Eye sockets */}
        <circle cx="36" cy="48" r="10" fill="url(#grixisGrad)" />
        <circle cx="64" cy="48" r="10" fill="url(#grixisGrad)" />
        {/* Nose cavity */}
        <path fill="url(#grixisGrad)" d="M46 62 L54 62 L50 70 Z" />
        {/* Mouth / teeth */}
        <path fill={UI.iconDark} d="M28 72 L32 68 L36 74 L40 68 L44 74 L48 68 L52 74 L56 68 L60 74 L64 68 L68 72 L72 72 L68 78 L64 76 L60 80 L56 76 L52 80 L48 76 L44 80 L40 76 L36 80 L32 76 L28 78 Z" />
      </svg>
    </span>
  );
}

export default GrixisSymbol;
