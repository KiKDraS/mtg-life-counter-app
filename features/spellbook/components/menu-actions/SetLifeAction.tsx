"use client";

import { type PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";

/* ponytail: Initial Life modal (DESIGN.md §6.2) not built yet.
 * Wire to useGameStateContext + setInitialLife when modal component exists. */
export function SetLifeAction({ children }: PropsWithChildren) {
  const handleSetLife = () => {
    /* §6.2 — opens Initial Life preset modal. */
  };

  return (
    <MenuActionButton ariaLabel="Initial Life" onClick={handleSetLife}>
      {children}
    </MenuActionButton>
  );
}
