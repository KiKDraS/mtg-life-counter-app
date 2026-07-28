"use client";

import { type PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";

/* ponytail: AI Judge modal (DESIGN.md §6.4) not built yet.
 * Wire when chat component exists. */
export function CallJudgeAction({ children }: PropsWithChildren) {
  const handleCallJudge = () => {
    /* §6.4 — opens AI Judge chat modal. */
  };

  return (
    <MenuActionButton ariaLabel="AI Judge" onClick={handleCallJudge}>
      {children}
    </MenuActionButton>
  );
}
