"use client";

import { type PropsWithChildren, useEffect, useState } from "react";
import { MenuActionButton } from "../MenuActionButton";

const INSTALL_HINT_MODAL_ID = "install-hint-modal";

/**
 * §8.6 — Native PWA install prompt (BeforeInstallPromptEvent is not in the
 * TS DOM lib, so the minimal shape is declared locally).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppAction({ children }: Readonly<PropsWithChildren>) {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  /* SPEC §8.6 iOS clause — Safari fires no beforeinstallprompt; show the
     Share → Add to Home Screen instructions dialog instead. */
  const [iosFallback, setIosFallback] = useState(false);

  useEffect(() => {
    const isIos =
      "standalone" in navigator || /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    /* SPEC §8.6 iOS clause — setState deferred one frame: sync setState in an
       effect is a lint error (react-hooks/set-state-in-effect). */
    const timer = isIos && !isStandalone
      ? window.setTimeout(() => setIosFallback(true), 0)
      : undefined;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      // SPEC §8.6 — iOS: no native prompt exists, show instructions dialog.
      (
        document.getElementById(INSTALL_HINT_MODAL_ID) as
          | HTMLDialogElement
          | null
      )?.show();
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  // SPEC §8.6 installability gate — Chromium: no event → no button.
  // iOS + not standalone → keep button, tap opens instructions dialog.
  if (!installPrompt && !iosFallback) return null;

  return (
    <MenuActionButton ariaLabel="Install App" onClick={handleInstall}>
      {children}
    </MenuActionButton>
  );
}
