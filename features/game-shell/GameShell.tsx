import type { PropsWithChildren } from "react";
import { GameInner } from "./GameInner";
import { GameProvider } from "@/features/game-shell/state/GameProvider";
import { ExtendedSplash } from "./components/ExtendedSplash";

/**
 * @description
 * Game shell — RSC grid root. No client boundary here (SPEC §1).
 * Client tree lives in GameProvider + GameInner (Donut Hole pattern):
 * the interactive inner reads GameState and renders rows, while the belt
 * (`children`) passes through as RSC. ExtendedSplash rides the same donut
 * hole — RSC shell around a client dialog leaf.
 */
export function GameShell({ children }: Readonly<PropsWithChildren>) {
  return (
    <GameProvider>
      <GameInner>
        {children}
        <ExtendedSplash />
      </GameInner>
    </GameProvider>
  );
}
