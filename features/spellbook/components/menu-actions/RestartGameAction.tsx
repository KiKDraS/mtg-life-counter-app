"use client";

import { type PropsWithChildren } from "react";
import { MenuActionButton } from "../MenuActionButton";
import {
  useGameStateContext,
  restartGame,
} from "@/features/game-shell/state/game-state-context";

export function RestartGameAction({ children }: PropsWithChildren) {
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
