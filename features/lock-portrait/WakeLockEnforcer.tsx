"use client";

import { useEffect, useRef } from "react";

/**
 * @description
 * Invisible component that keeps the screen awake during play via the Wake Lock API.
 *
 * Context & Architecture:
 * - Requested on first user gesture (pointerdown) — matches FullscreenEnforcer.
 * - Reacquired on visibilitychange → visible: the API auto-releases when hidden.
 * - Fails silently: unsupported browsers or rejected requests never block gameplay.
 */
export function WakeLockEnforcer() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const mountedRef = useRef(true);
  /* Failed request → stop retrying on pointerdown (rejected every tap, spam);
     re-allowed on visibilitychange → visible. */
  const failedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    if (!("wakeLock" in navigator)) {
      return;
    }

    const requestLock = async () => {
      if (failedRef.current) return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        sentinelRef.current = sentinel;
        // System-initiated release (battery saver, power policy) → reacquire.
        // Guards: unmount (mountedRef) + hidden-tab releases fired by releaseLock().
        sentinel.addEventListener("release", () => {
          if (mountedRef.current && document.visibilityState === "visible") {
            void requestLock();
          }
        });
      } catch {
        // Fails silently per design intent — rejected requests never block gameplay.
        failedRef.current = true;
      }
    };

    const releaseLock = () => {
      try {
        void sentinelRef.current?.release().catch(() => {});
      } catch {
        // Silent per design intent.
      }
      sentinelRef.current = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        failedRef.current = false;
        void requestLock();
      } else {
        releaseLock();
      }
    };

    window.addEventListener("pointerdown", requestLock);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("pointerdown", requestLock);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseLock();
    };
  }, []);

  return null;
}