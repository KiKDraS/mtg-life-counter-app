"use client";

import { type PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";

const INITIAL_LIFE_MODAL_ID = "initial-life-modal";

/**
 * §8.3 — Opens the Initial Life preset modal.
 * Modal lives in SpellbookMenu as a sibling to the belt.
 */
export function SetLifeAction({ children }: Readonly<PropsWithChildren>) {
  const handleSetLife = () => {
    (
      document.getElementById(INITIAL_LIFE_MODAL_ID) as
        | HTMLDialogElement
        | null
    )?.show();
  };

  return (
    <MenuActionButton ariaLabel="Initial Life" onClick={handleSetLife}>
      {children}
    </MenuActionButton>
  );
}
