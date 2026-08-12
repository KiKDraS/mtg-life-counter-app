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
 * Unchecks the belt's #spellbook-toggle peer checkbox so the belt closes on any action tap.
 */
export function MenuActionButton({
  ariaLabel,
  onClick,
  children,
}: Readonly<MenuActionProps>) {
  const handleClick = () => {
    const toggle = document.getElementById("spellbook-toggle") as
      | HTMLInputElement
      | null;
    if (toggle) {
      toggle.checked = false;
    }
    onClick();
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
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
