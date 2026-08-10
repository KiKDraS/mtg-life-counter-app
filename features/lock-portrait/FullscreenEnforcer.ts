"use client";

import { useEffect, useRef } from "react";

/**
 * @description
 * Invisible component to enforce fullscreen and portrait orientation lock on mobile devices.
 *
 * Context & Architecture:
 * - Listens for the first user interaction to bypass
 *   browser auto-play/fullscreen security policies.
 * - Safely checks for API availability (iOS Safari lacks orientation.lock).
 * - Self-cleans its listener after the first successful execution.
 */
export function FullscreenEnforcer() {
  const isLockedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone;

    if (isStandalone) {
      return;
    }

    const fullScreenModeOff = !document.fullscreenElement;

    const handleFullscreenChange = () => {
      if (fullScreenModeOff) {
        isLockedRef.current = false;
      }
    };

    const enforceImmersiveMode = async () => {
      if (isLockedRef.current && document.fullscreenElement) return;

      // Screen fully painted by the Browser. Entering fullscreen mode
      try {
        if (fullScreenModeOff) {
          await document.documentElement.requestFullscreen();
        }
      } catch (error) {
        console.warn(
          "Fullscreen mode failed. The browser might be blocking it.",
          error,
        );
        return;
      }

      // Block portrait orientation on fullscreen mode
      try {
        if ("orientation" in screen && "lock" in screen.orientation) {
          // TS lib lacks ScreenOrientation.lock typing; cast covers it.
          const so = screen.orientation as ScreenOrientation & {
            lock: (o: "portrait") => Promise<void>;
          };
          await so.lock("portrait");
        }

        isLockedRef.current = true;
      } catch (error) {
        console.warn(
          "Orientation lock failed. The browser might be blocking it.",
          error,
        );
      }
    };

    window.addEventListener("pointerdown", enforceImmersiveMode);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("pointerdown", enforceImmersiveMode);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return null;
}
