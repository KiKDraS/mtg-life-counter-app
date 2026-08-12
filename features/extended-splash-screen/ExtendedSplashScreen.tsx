import Image from "next/image";
import appleIcon from "@/app/apple-icon.png";
import { HideSplashScreenHandler } from "./components/HideSplashScreenHandler";

/**
 * @description
 * Extended splash — fixed overlay covering first paint while the app
 * hydrates (SPEC §4.6). Suppresses the SSR-defaults vs hydrated-IndexedDB
 * state flicker. RSC shell: no client boundary here; hide logic lives in
 * the {@link HideSplashScreenHandler} sibling (client leaf).
 *
 * Overlay uses `bg-ui-splash` token (was hardcoded `#292A2A`, SPEC §4.6).
 * `motion-reduce:transition-none` per DESIGN.md §9 — reduced-motion users
 * get instant hide, no 300ms fade.
 *
 * @see SPEC.md §4.6
 * @see DESIGN.md §9
 */
export const ExtendedSplashScreen = () => {
  return (
    <>
      <HideSplashScreenHandler />
      <div
        id="extended-splash-screen"
        className="fixed inset-0 z-9999 flex items-center justify-center bg-ui-splash opacity-100 transition-opacity duration-300 ease-in-out motion-reduce:transition-none pwa:hidden"
      >
        <Image
          src={appleIcon}
          alt="App Icon"
          className="w-[clamp(48px, 100%, 196px)]"
          width={196}
          height={196}
          priority
        />
      </div>
    </>
  );
};
