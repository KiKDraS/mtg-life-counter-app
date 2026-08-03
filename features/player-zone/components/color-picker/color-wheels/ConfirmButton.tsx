"use client";

import CheckCircle from "@/shared/components/icons/CheckCirecle";
import { UI } from "@/shared/lib/constants/colors";
import { MANA_BTN_SIZE } from "../constants/mana";
import { cn } from "@/shared/lib/cn";

interface ConfirmButtonProps {
  readonly id: string;
  readonly className?: string;
}

/**
 * §6.5 / §8.5.1 — Centered CheckCircle ✓. Closes the dialog by DOM id with
 * NO dispatch (colors already applied live on every toggle). Inline Material-
 * style check_circle SVG keeps it asset-free.
 *
 * @see DESIGN.md §6.5, SPEC.md §8.5.1
 */
export function ConfirmButton({ id, className }: Readonly<ConfirmButtonProps>) {
  const handleClick = () => {
    (document.getElementById(id) as HTMLDialogElement | null)?.close();
  };

  return (
    <button
      type="button"
      aria-label="Confirm color"
      className={cn("cursor-pointer", className)}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={handleClick}
    >
      <CheckCircle className={MANA_BTN_SIZE} fill={UI.iconLight} />
    </button>
  );
}
