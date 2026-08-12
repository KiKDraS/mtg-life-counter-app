"use client";

import { cn } from "@/shared/lib/cn";
import type { ManaColor } from "@/shared/lib/constants/colors";
import { ManaActionButton } from "../ManaActionButton";
import { ColorlessButton } from "./ColorlessButton";
import ManaSelector from "@/shared/components/icons/ManaSelector";
import { MANA_BTN_SIZE } from "@/features/player-zone/constants/color";

/**
 * §6.5 — Circular wheel order, clockwise from top:
 * Colorless (C) → White (W) → Blue (U) → Black (B) → Red (R) → Green (G).
 * 6 positions at 60° apart; `i * 60` rotates each button off the top anchor.
 */
const WHEEL_ORDER: ManaColor[] = ["c", "w", "u", "b", "r", "g"];

const manaWheelBtnClass = cn(
  "absolute rounded-full",
  "transition-transform",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white cursor-pointer",
);

export const ManaWheel = ({ id }: { readonly id: string }) => {
  return (
    <>
      {WHEEL_ORDER.map((color, i) => {
        const angle = i * 60;
        const positionStyle: React.CSSProperties = {
          left: "50%",
          top: "50%",
          transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(max(-6.5rem, -27cqmin)) rotate(-${angle}deg)`,
        };
        const icon = <ManaSelector color={color} className={MANA_BTN_SIZE} />;
        // ponytail: Colorless is single-tap-apply-and-close, the rest toggle.
        return color === "c" ? (
          <ColorlessButton
            key={color}
            dialogId={id}
            className={manaWheelBtnClass}
            style={positionStyle}
          >
            {icon}
          </ColorlessButton>
        ) : (
          <ManaActionButton
            key={color}
            color={color}
            dialogId={id}
            className={manaWheelBtnClass}
            style={positionStyle}
          >
            {icon}
          </ManaActionButton>
        );
      })}
    </>
  );
};
