"use client";

import { useCallback, useRef } from "react";
import { DialogShell } from "@/shared/components/DialogShell";
import { UI } from "@/shared/lib/constants/colors";

interface CustomCounterModalProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onSubmit: (name: string) => void;
}

/**
 * @description
 * Modal dialog for naming a custom counter.
 *
 * Triggered by the [+] button in the Counters overlay (§7.4).
 * Wraps DialogShell with the lighter backdrop (`bg-black/35`) per DESIGN.md §6.6.
 *
 * @see DESIGN.md §6.6 — Modal: Custom Counter Name
 */
export function CustomCounterModal({
  dialogRef,
  onSubmit,
}: CustomCounterModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    onSubmit(value);
    input.value = ""; // reset for next use
    dialogRef.current?.close();
  }, [onSubmit, dialogRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <DialogShell
      dialogRef={dialogRef}
      ariaLabelledBy="custom-counter-title"
      className="bg-black/35"
    >
      <div className="flex h-full flex-col items-center justify-center px-4">
        <div
          className="w-full max-w-sm rounded-lg p-6"
          style={{ backgroundColor: UI.overlay }}
        >
          <h2
            id="custom-counter-title"
            className="mb-4 text-center text-heading font-bold"
            style={{ color: UI.textLight }}
          >
            Custom Counter
          </h2>

          {/* §6.6 — Input: auto-focused, maxLength=35, warm white text */}
          <input
            ref={inputRef}
            type="text"
            maxLength={35}
            autoFocus
            placeholder="Counter"
            onKeyDown={handleKeyDown}
            className="mb-4 w-full rounded border-0 bg-white/10 px-3 py-2 text-body font-medium placeholder:text-white/50 focus:outline-none"
            style={{ color: UI.textLight }}
          />

          {/* §6.6 — Confirm button, borderless per §4.2 */}
          <button
            type="button"
            onClick={submit}
            className="w-full border-0 text-body font-medium"
            style={{ color: UI.textLight }}
          >
            + Add
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
