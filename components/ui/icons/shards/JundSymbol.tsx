import type { SVGAttributes } from "react";
import { SHARD_COLORS, UI } from "@/lib/constants/colors";

type JundSymbolProps = {
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const [c1, c2, c3] = SHARD_COLORS.jund;

function JundSymbol({ size = 48, className, ...props }: JundSymbolProps) {
  return (
    <span role="img" aria-label="Jund" className={className}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} {...props}>
        <defs>
          <linearGradient id="jundGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="33.3%" stopColor={c1} />
            <stop offset="33.3%" stopColor={c2} />
            <stop offset="66.6%" stopColor={c2} />
            <stop offset="66.6%" stopColor={c3} />
            <stop offset="100%" stopColor={c3} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#jundGrad)" />
        {/* Dragon's jaw — Jund's savage dragon theme */}
        <path fill={UI.iconDark} d="M15 68 Q15 10 50 8 Q85 10 85 68 L70 68 L70 35 L55 55 L40 35 L40 55 L30 45 L30 68 Z" />
        {/* Upper fangs */}
        <path fill={UI.iconDark} d="M25 38 L22 52 L30 42 Z" />
        <path fill={UI.iconDark} d="M55 48 L52 62 L60 52 Z" />
        <path fill={UI.iconDark} d="M75 38 L72 52 L80 42 Z" />
        {/* Lower jaw */}
        <path fill={UI.iconDark} d="M20 72 L30 78 L42 72 L55 78 L67 72 L78 76 L80 84 L65 84 L55 80 L42 84 L30 80 L18 84 Z" />
      </svg>
    </span>
  );
}

export default JundSymbol;
