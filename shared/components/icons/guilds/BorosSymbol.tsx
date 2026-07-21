import type { SVGAttributes } from "react";
import { GUILD_COLORS, UI } from "@/shared/lib/constants/colors";

type BorosSymbolProps = {
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

function BorosSymbol({ size = 48, className, ...props }: BorosSymbolProps) {
  const [c1, c2] = GUILD_COLORS.boros;
  return (
    <span role="img" aria-label="Boros Legion" className={className}>
      <svg viewBox="0 0 100 100" width={size} height={size} {...props}>
        <defs>
          <linearGradient id="borosGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="50%" stopColor={c1} />
            <stop offset="50%" stopColor={c2} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#borosGrad)" />
        <g transform="translate(0, 1.44)">
          <path
            fill={UI.iconDark}
            d="m74.34 54.938 16.392-4.25-16.392-4.693a29 29 0 0 0-.497-2.481l14.404-10.487-17.823 2.22a29 29 0 0 0-1.41-2.1l10.377-16.22-16.708 9.893a29 29 0 0 0-1.573-1.077l3.33-21.046L51.718 21.85q-.63-.137-1.268-.249L45.366 0l-5.082 21.601q-.641.111-1.268.25L26.291 4.696l3.331 21.046c-.535.344-1.064.7-1.573 1.077l-16.708-9.894 10.379 16.22q-.749 1.02-1.412 2.1L2.486 33.026 16.89 43.514c-.199.815-.37 1.64-.499 2.48L0 50.688l16.39 4.25c1.006 6.57 4.199 12.416 8.803 16.786l-4.104 10.892a40 40 0 0 0 10.197 5.515l4.52-19.773-9.285-11.336V45.416h16.66v6.554H32.666v1.503h7.102l11.744 6.145 12.153-6.693-2.594 10.79-5.463 5.19 3.928 19.193a40 40 0 0 0 10.108-5.483L65.54 71.723c4.604-4.37 7.797-10.216 8.801-16.787M38.766 43.595h-7.569v-8.83h7.57zm8.921 7.555h-2.505v-7.555h-4.504V31.898h7.01zm8.74 0h-6.69V34.49h6.69zm7.512 0h-5.736V36.949h5.736z"
          />
        </g>
      </svg>
    </span>
  );
}

export default BorosSymbol;
