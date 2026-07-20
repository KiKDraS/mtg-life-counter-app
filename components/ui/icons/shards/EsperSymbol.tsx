import type { SVGAttributes } from "react";
import { SHARD_COLORS } from "@/lib/constants/colors";

type EsperSymbolProps = {
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const [c1, c2, c3] = SHARD_COLORS.esper;

function EsperSymbol({ size = 48, className, ...props }: EsperSymbolProps) {
  return (
    <span role="img" aria-label="Esper" className={className}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} {...props}>
        <defs>
          <linearGradient id="esperGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="50%" stopColor={c2} />
            <stop offset="100%" stopColor={c3} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#esperGrad)" />
        {/* 3-tooth gear — Esper's artifact mastery */}
        <circle cx="50" cy="50" r="16" fill="#0D0F0F" />
        <path fill="#0D0F0F" d="M43 8 L57 8 L57 25 L43 25 Z" />
        <path fill="#0D0F0F" d="M43 75 L57 75 L57 92 L43 92 Z" />
        <path fill="#0D0F0F" d="M8 43 L25 43 L25 57 L8 57 Z" />
        <path fill="#0D0F0F" d="M75 43 L92 43 L92 57 L75 57 Z" />
        {/* Center hole */}
        <circle cx="50" cy="50" r="8" fill="url(#esperGrad)" />
      </svg>
    </span>
  );
}

export default EsperSymbol;
