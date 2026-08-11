import type { PropsWithChildren } from "react";
import { GameInner } from "./GameInner";
import { GameProvider } from "@/features/game-shell/state/GameProvider";

/**
 * @description
 * Game shell — RSC grid root. No client boundary here (SPEC §1).
 * Client tree lives in GameProvider + GameInner (Donut Hole pattern):
 * the interactive inner reads GameState and renders rows, while the belt
 * (`children`) passes through as RSC.
 */
export function GameShell({ children }: Readonly<PropsWithChildren>) {
  return (
    <GameProvider>
      <GameInner>{children}</GameInner>
    </GameProvider>
  );
}
