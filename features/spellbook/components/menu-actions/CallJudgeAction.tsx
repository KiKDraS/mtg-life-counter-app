"use client";

import { PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";

export const CallJudgeAction = ({ children }: PropsWithChildren) => {
  const callJudge = () => {};
  return (
    <MenuActionButton ariaLabel="AI Judge" onClick={callJudge}>
      {children}
    </MenuActionButton>
  );
};
