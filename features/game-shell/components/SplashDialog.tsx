"use client";

import type { PropsWithChildren } from "react";
import { useGameStateContext } from "@/features/game-shell/state/hooks";

/**
 * §4.6 Extended Splash — client leaf.
 *
 * Dedicated fullscreen modal covering the hydration hold. NOT DialogShell /
 * OverlaySurface — both have dismiss paths (backdrop click, Escape) that
 * violate the contract: the ONLY way out is hydration completing.
 *
 * Contract:
 * - `open={!isHydrated}` — declarative: matches the inline script's
 *   parse-time `showModal()` (no hydration mismatch), closes when HYDRATE
 *   lands (React removes the attribute → dialog closes).
 * - Escape prevented via `cancel` guard (no dismiss path).
 * - No backdrop onClick — native modal default: backdrop clicks do nothing.
 * - No autofocus, no close button, no animations.
 * - bg `#292A2A` = manifest `background_color` → seamless OS-splash → DOM.
 * - `open:fixed inset-0` — covers viewport between HTML parse and inline
 *   script execution (streamed chunks), before `showModal()` promotes it.
 *
 * @see DESIGN.md §4.4
 * @see SPEC.md §4.6
 */
export function SplashDialog({ children }: Readonly<PropsWithChildren>) {
  const { state } = useGameStateContext();
  return (
    <dialog
      id="extended-splash"
      data-testid="extended-splash"
      aria-label="Loading game"
      aria-modal="true"
      open={!state.isHydrated}
      onCancel={(event) => event.preventDefault()}
      className="m-0 h-dvh w-dvw rounded-none border-0 bg-[#292A2A] text-ui-textLight open:fixed open:inset-0"
    >
      <div className="flex h-full w-full flex-col items-center justify-center">
        {children}
      </div>
    </dialog>
  );
}
