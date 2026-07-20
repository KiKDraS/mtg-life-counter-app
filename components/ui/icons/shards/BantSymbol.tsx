import type { SVGAttributes } from "react";
import { SHARD_COLORS } from "@/lib/constants/colors";

type BantSymbolProps = {
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const [c1, c2, c3] = SHARD_COLORS.bant;

function BantSymbol({ size = 48, className, ...props }: BantSymbolProps) {
  return (
    <span role="img" aria-label="Bant" className={className}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} {...props}>
        <defs>
          <linearGradient id="bantGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="50%" stopColor={c2} />
            <stop offset="100%" stopColor={c3} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#bantGrad)" />
        {/* Knight's shield — Bant's chivalric order */}
        <path fill="#0D0F0F" d="M50 10 L85 30 L85 70 L50 92 L15 70 L15 30 Z" />
        {/* Inner shield crest */}
        <path fill="#0D0F0F" d="M50 20 L73 35 L73 65 L50 80 L27 65 L27 35 Z" />
      </svg>
    </span>
  );
}

export default BantSymbol;
