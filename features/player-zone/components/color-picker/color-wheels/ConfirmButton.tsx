"use client";

import { UI } from "@/shared/lib/constants/colors";

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
      className={className}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={handleClick}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="w-[18cqmin] h-[18cqmin] min-w-8 min-h-8 max-w-18 max-h-18"
      >
        <circle cx="12" cy="12" r="11" fill={UI.iconLight} />
        <path
          fill={UI.belt}
          d="M10.2 16.2 6 12l1.4-1.4 2.8 2.8 6-6L17.6 8.8z"
        />
      </svg>
    </button>
  );
}