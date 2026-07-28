"use client";

import { PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";

export const SetLifeAction = ({ children }: PropsWithChildren) => {
  const setLife = () => {};

  return (
    <MenuActionButton ariaLabel="Initial Life" onClick={setLife}>
      {children}
    </MenuActionButton>
  );
};
