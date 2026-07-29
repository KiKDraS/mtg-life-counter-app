"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { UI } from "@/shared/lib/constants/colors";
import {
  usePlayerStateContext,
  setLife,
} from "@/features/player-zone/state/player-state-context";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

const BASE_BTN_CLASS = cn(
  "flex h-14 items-center justify-center rounded-lg font-bold text-2xl",
  "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
);

const DIGIT_BTN_CLASS = cn(BASE_BTN_CLASS, "hover:bg-white/10");

const CONFIRM_BTN_CLASS = cn(
  BASE_BTN_CLASS,
  "bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:hover:bg-white/20",
);

interface NumpadInputProps {
  readonly dialogId: string;
}

/** Convenience accessor for the native dialog element */
const getDialog = (id: string) =>
  document.getElementById(id) as HTMLDialogElement | null;

/**
 * @description
 * Client leaf for the life-numpad digit entry.
 *
 * Context & Architecture:
 * - Uses a declarative unified array for digits to keep JSX DRY.
 * - Auto-clears internal state when the native `<dialog>` fires its "close" event.
 * - Guards against accidental "empty" confirmations that would set life to 0.
 */
export function NumpadInput({ dialogId }: NumpadInputProps) {
  const { dispatch } = usePlayerStateContext();
  const [value, setValue] = useState("");

  /* Sync React state with native DOM dialog lifecycle */
  useEffect(() => {
    const dialog = getDialog(dialogId);
    if (!dialog) return;

    const handleClose = () => setValue("");
    dialog.addEventListener("close", handleClose);

    return () => dialog.removeEventListener("close", handleClose);
  }, [dialogId]);

  /*
   * Declarative state updaters.
   */
  const appendDigit = useCallback((digit: number) => {
    setValue((prev) => (prev + digit).slice(0, 4));
  }, []);

  const removeDigit = useCallback(() => {
    setValue((prev) => prev.slice(0, -1));
  }, []);

  /*
   * Action Handlers
   */
  const handleConfirm = useCallback(() => {
    if (!value) return;

    dispatch(setLife(Number(value)));
    getDialog(dialogId)?.close();
  }, [value, dispatch, dialogId]);

  const handleCancel = useCallback(() => {
    getDialog(dialogId)?.close();
  }, [dialogId]);

  return (
    <div>
      {/* 1. Display Area */}
      <div className="flex flex-1 items-center justify-center">
        <output
          aria-live="polite"
          className="text-display font-black tabular-nums opacity-70"
        >
          {value || "\u2014"}
        </output>
      </div>

      {/* 2. Keypad Grid */}
      <div className="mx-auto grid w-64 grid-cols-3 gap-3 pb-2">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            aria-label={String(d)}
            onClick={() => appendDigit(d)}
            className={DIGIT_BTN_CLASS}
          >
            {d}
          </button>
        ))}

        <button
          type="button"
          aria-label="Backspace"
          onClick={removeDigit}
          className={cn(DIGIT_BTN_CLASS, "text-xl")}
        >
          ⌫
        </button>

        <button
          type="button"
          aria-label="Confirm"
          onClick={handleConfirm}
          disabled={!value}
          className={CONFIRM_BTN_CLASS}
        >
          ✓
        </button>
      </div>

      {/* 3. Footer / Close */}
      <div className="flex justify-center">
        <button
          type="button"
          aria-label="Cancel"
          onClick={handleCancel}
          className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ color: UI.textLight }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
