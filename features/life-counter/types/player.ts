import type { ManaColor } from "@/shared/lib/constants/colors";

/* §6.5 — a player's color identity: a single mana color or the 5-color WUBRG gradient. */
export type PlayerColor = ManaColor | "wubrg";
