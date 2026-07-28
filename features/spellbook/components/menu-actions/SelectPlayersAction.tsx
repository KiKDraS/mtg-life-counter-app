"use client";

import { PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";

export const SelectPlayersAction = ({ children }: PropsWithChildren) => {
  const selectPlayers = () => {};

  return (
    <MenuActionButton ariaLabel="Players" onClick={selectPlayers}>
      {children}
    </MenuActionButton>
  );
};
