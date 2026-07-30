"use client";

import { type PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";

const PLAYER_SELECTOR_MODAL_ID = "player-selector-modal";

/**
 * §8.4 — Opens the Player Selector modal.
 * Modal lives in SpellbookMenu as a sibling to the belt.
 */
export function SelectPlayersAction({ children }: Readonly<PropsWithChildren>) {
  const handleSelect = () => {
    (
      document.getElementById(PLAYER_SELECTOR_MODAL_ID) as
        | HTMLDialogElement
        | null
    )?.show();
  };

  return (
    <MenuActionButton ariaLabel="Players" onClick={handleSelect}>
      {children}
    </MenuActionButton>
  );
}
