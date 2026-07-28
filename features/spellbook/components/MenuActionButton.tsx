"use client";

import { cn } from "@/shared/lib/cn";
import { PropsWithChildren } from "react";

interface MenuActionProps extends PropsWithChildren {
  readonly ariaLabel: string;
  readonly onClick: () => void;
}

/**
 * @description
 * Client Component for Spellbook actions.
 * Handles the interactivity (onClick) while accepting Server-rendered icons as children.
 */
export function MenuActionButton({
  ariaLabel,
  onClick,
  children,
}: Readonly<MenuActionProps>) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "flex size-12 items-center justify-center rounded-full",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
        "active:scale-95 transition-transform",
      )}
    >
      {children}
    </button>
  );
}
