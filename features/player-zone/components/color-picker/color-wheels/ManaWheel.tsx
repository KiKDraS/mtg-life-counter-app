"use client";

import { cn } from "@/shared/lib/cn";
import { MANA, ManaColor } from "@/shared/lib/constants/colors";
import { ManaActionButton } from "../ManaActionButton";
import ManaSelector from "@/shared/components/icons/ManaSelector";

const MANA_KEYS = Object.keys(MANA) as ManaColor[];

const manaWheelBtnClass = cn(
  "absolute rounded-full",
  "transition-transform",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white cursor-pointer",
);

export const ManaWheel = ({ id }: { readonly id: string }) => {
  return (
    <>
      {MANA_KEYS.map((color, i) => {
        const angle = i * 60;
        return (
          <ManaActionButton
            key={color}
            color={color}
            dialogId={id}
            className={manaWheelBtnClass}
            style={{
              left: "50%",
              top: "50%",
              transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(max(-6.5rem, -32cqmin)) rotate(-${angle}deg)`,
            }}
          >
            <ManaSelector
              color={color}
              className="w-[18cqmin] h-[18cqmin] min-w-8 min-h-8 max-w-18 max-h-18"
            />
          </ManaActionButton>
        );
      })}
    </>
  );
};
