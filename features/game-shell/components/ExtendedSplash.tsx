import Image from "next/image";
import mtgLogo from "@/features/spellbook/images/mtg-logo.png";
import { SplashDialog } from "./SplashDialog";

/**
 * §4.6 Extended Splash — RSC shell (no client directive).
 *
 * Static server-rendered content for the hydration-cover dialog:
 * centered MTG logo + app name. No hooks, no logic — the client leaf
 * (`SplashDialog`) owns the modal element, GameInner owns open/close.
 *
 * @see DESIGN.md §4.4
 * @see SPEC.md §4.6
 */
export function ExtendedSplash() {
  return (
    <SplashDialog>
      <div className="flex flex-col items-center gap-3">
        <Image
          src={mtgLogo}
          alt="MTG"
          width={64}
          height={64}
          className="drop-shadow-lg"
          priority
        />
        <p className="text-caption font-medium text-ui-textLight/70">
          Life Counter
        </p>
      </div>
    </SplashDialog>
  );
}
