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
  // ponytail: dev-only bypass — http: (localhost/LAN IP) shows icon without a
  // prompt so the UI can be tested off-device; click no-ops. SPEC §8.6 dev exception.
  const [isHttpOrigin, setIsHttpOrigin] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only check; no re-render cascade possible
    setIsHttpOrigin(window.location.protocol === "http:");

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
  // Dev exception (§8.6): http: origin shows icon even without a prompt.
  if (!installPrompt && !isHttpOrigin) return null;

  return (
    <MenuActionButton ariaLabel="Install App" onClick={handleInstall}>
      {children}
    </MenuActionButton>
  );
}
