import type { SVGAttributes } from "react";
import { UI } from "@/shared/lib/constants/colors";
import { cn } from "@/shared/lib/cn";

type RestartGameProps = {
  className?: string;
} & SVGAttributes<SVGSVGElement>;

function RestartGame({ className, ...props }: RestartGameProps) {
  return (
    <span
      role="img"
      aria-label="Restart Game"
      className={cn("inline-block", className)}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill={UI.iconLight}
        viewBox="0 -960 960 960"
        className="w-full h-full"
        {...props}
      >
        <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
      </svg>
    </span>
  );
}

export default RestartGame;
