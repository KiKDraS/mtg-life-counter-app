"use client";

import { createContext } from "react";
import type { PlayerContextValue } from "./types";

/* ── Context ── */
export const PlayerContext = createContext<PlayerContextValue | null>(null);
