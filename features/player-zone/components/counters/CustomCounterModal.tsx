"use client";

import { useCallback, useRef } from "react";
import { DialogShell } from "@/shared/components/DialogShell";
import { UI } from "@/shared/lib/constants/colors";
import {
  usePlayerStateContext,
  addCounter,
} from "@/features/player-zone/state/player-state-context";

interface CustomCounterModalProps {
  readonly id: string;
}

/** Smallest unique suffix for custom counter ids. */
let customIdSeq = 0;

/**
 * §6.6 Modal for naming a custom counter.
 *
 * Reads context directly — no onSubmit callback needed.
 * Closes natively via DOM ID on the parent dialog.
 *
 * @see DESIGN.md §6.6
 */
export function CustomCounterModal({ id }: CustomCounterModalProps) {
  const { dispatch } = usePlayerStateContext();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    const seqId = `custom-${++customIdSeq}`;
    dispatch(addCounter(seqId, value));
    input.value = "";
    (document.getElementById(id) as HTMLDialogElement | null)?.close();
  }, [dispatch, id]);

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
      id={id}
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

          <input
            ref={inputRef}
            type="text"
            maxLength={35}
            autoFocus
            placeholder="Counter"
            aria-label="Counter name"
            onKeyDown={handleKeyDown}
            className="mb-4 w-full rounded border-0 bg-white/10 px-3 py-2 text-body font-medium placeholder:text-white/50 focus:outline-none"
            style={{ color: UI.textLight }}
          />

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
