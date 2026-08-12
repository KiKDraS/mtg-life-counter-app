"use client";

import { useEffect } from "react";

// ponytail: register once, fail silently. SW failure must never break the app.
export default function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
