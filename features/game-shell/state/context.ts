"use client";

import { createContext } from "react";
import type { GameContextValue } from "./types";

/* ── Context ── */
export const GameContext = createContext<GameContextValue | null>(null);
