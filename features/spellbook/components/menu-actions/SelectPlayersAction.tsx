"use client";

import { type PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";

/* ponytail: Player Selector modal (DESIGN.md §6.3) not built yet.
 * Wire to useGameStateContext + setPlayerCount when modal component exists. */
export function SelectPlayersAction({ children }: Readonly<PropsWithChildren>) {
  const handleSelect = () => {
    /* §6.3 — opens Player Count SVG selector modal. */
  };

  return (
    <MenuActionButton ariaLabel="Players" onClick={handleSelect}>
      {children}
    </MenuActionButton>
  );
}
