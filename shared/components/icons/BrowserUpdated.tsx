import type { SVGAttributes } from "react";
import { cn } from "@/shared/lib/cn";
import { UI } from "@/shared/lib/constants/colors";

type BrowserUpdatedProps = SVGAttributes<SVGSVGElement>;

function BrowserUpdated({
  className,
  ...props
}: Readonly<BrowserUpdatedProps>) {
  return (
    <span
      role="img"
      aria-label="Browser Updated"
      className={cn("inline-block", className)}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill={UI.iconLight}
        viewBox="0 -960 960 960"
        className="w-full h-full"
        {...props}
      >
        <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H160v400Zm0-480h640v-80H160v80Zm320 400 160-160H520v-160h-80v160H320l160 160Zm-320 80v-480 480Z" />
      </svg>
    </span>
  );
}

export default BrowserUpdated;
