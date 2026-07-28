"use client";

import { PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";

export const RestartGameAction = ({ children }: PropsWithChildren) => {
  const handleRestart = () => {};

  return (
    <MenuActionButton ariaLabel="Restart Life" onClick={handleRestart}>
      {children}
    </MenuActionButton>
  );
};
