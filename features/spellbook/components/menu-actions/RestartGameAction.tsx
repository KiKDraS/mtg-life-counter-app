"use client";

import { type PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";
import { useGameStateContext } from "@/features/game-shell/state/hooks";
import { restartGame } from "@/features/game-shell/state/actions";

export function RestartGameAction({ children }: Readonly<PropsWithChildren>) {
  const { dispatch } = useGameStateContext();

  const handleRestart = () => {
    dispatch(restartGame());
  };

  return (
    <MenuActionButton ariaLabel="Restart Life" onClick={handleRestart}>
      {children}
    </MenuActionButton>
  );
}
