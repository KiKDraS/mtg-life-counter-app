"use client";

import { type PropsWithChildren, useEffect, useState } from "react";
import { MenuActionButton } from "../MenuActionButton";

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

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  // SPEC §8.6 installability gate — no event → no button.
  // ponytail: dev-only bypass — http: (localhost or LAN IP) shows icon even
  // without a prompt so the UI can be tested off-device; click no-ops.
  if (!installPrompt && window.location.protocol !== "http:") return null;

  return (
    <MenuActionButton ariaLabel="Install App" onClick={handleInstall}>
      {children}
    </MenuActionButton>
  );
}
