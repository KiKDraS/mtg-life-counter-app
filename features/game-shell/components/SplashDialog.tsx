"use client";

import type { PropsWithChildren } from "react";

/**
 * §4.6 Extended Splash — client leaf.
 *
 * Dedicated fullscreen modal covering the hydration hold. NOT DialogShell /
 * OverlaySurface — both have dismiss paths (backdrop click, Escape) that
 * violate the contract: the ONLY way out is hydration completing.
 *
 * Contract:
 * - Escape prevented via `cancel` guard (no dismiss path).
 * - No backdrop onClick — native modal default: backdrop clicks do nothing.
 * - No autofocus, no close button, no animations.
 * - bg `#292A2A` = manifest `background_color` → seamless OS-splash → DOM.
 * - Opened/closed from GameInner via DOM id (timer after SPLASH_DELAY_MS,
 *   hard cut on `isHydrated`).
 *
 * @see DESIGN.md §4.4
 * @see SPEC.md §4.6
 */
export function SplashDialog({ children }: Readonly<PropsWithChildren>) {
  return (
    <dialog
      id="extended-splash"
      data-testid="extended-splash"
      aria-label="Loading game"
      aria-modal="true"
      onCancel={(event) => event.preventDefault()}
      className="m-0 h-dvh w-dvw rounded-none border-0 bg-[#292A2A] text-ui-textLight"
    >
      <div className="flex h-full w-full flex-col items-center justify-center">
        {children}
      </div>
    </dialog>
  );
}
