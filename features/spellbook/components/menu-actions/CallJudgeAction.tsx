"use client";

import { type PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";

const AI_JUDGE_MODAL_ID = "ai-judge-modal";

/**
 * §6.4 — Opens the AI Judge chat modal.
 * Modal lives in SpellbookMenu as a sibling to the belt.
 */
export function CallJudgeAction({ children }: Readonly<PropsWithChildren>) {
  const handleCallJudge = () => {
    (
      document.getElementById(AI_JUDGE_MODAL_ID) as HTMLDialogElement | null
    )?.show();
  };

  return (
    <MenuActionButton ariaLabel="AI Judge" onClick={handleCallJudge}>
      {children}
    </MenuActionButton>
  );
}
