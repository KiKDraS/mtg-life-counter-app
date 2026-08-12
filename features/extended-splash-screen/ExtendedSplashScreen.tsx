import Image from "next/image";
import appleIcon from "@/app/apple-icon.png";
import { HideSplashScreenHandler } from "./components/HideSplashScreenHandler";

export const ExtendedSplashScreen = () => {
  return (
    <>
      <HideSplashScreenHandler />
      <div
        id="extended-splash-screen"
        className="fixed inset-0 z-9999 flex items-center justify-center bg-[#292A2A] opacity-100 transition-opacity duration-300 ease-in-out"
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
