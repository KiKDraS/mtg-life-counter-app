"use client";

import {
  SUGGESTION_CHIPS,
  type SuggestionKind,
} from "@/features/ai-judge/constants/suggestions";

interface SuggestionChipsProps {
  readonly disabled: boolean;
  readonly onSelect: (kind: SuggestionKind) => void;
}

/**
 * @description
 * DESIGN §6.4.1 — one-tap suggestion chips above the input. Row is a
 * horizontal scroller (scroll-snap proximity, hidden scrollbar). Each chip
 * is a pill: `#1A1A1A` BG, 40%-opacity `#FAF8F5` border at rest → 100% on
 * hover/active tap with a 0.97 press scale → 2px `#FAF8F5` focus ring.
 * Disabled (streaming/offline): 25% opacity, no pointer events.
 *
 * @param disabled — chips disabled state (§6.4.1 streaming, §6.4.0 offline).
 * @param onSelect — called with the chip kind on tap; parent builds + sends
 *   the prompt (JudgePlay serializes live state at send time, SPEC §9.8).
 *
 * @see DESIGN.md §6.4.1
 */
export function SuggestionChips({
  disabled,
  onSelect,
}: Readonly<SuggestionChipsProps>) {
  return (
    <div
      role="group"
      aria-label="Suggestions"
      className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] snap-x snap-proximity [&::-webkit-scrollbar]:hidden"
    >
      {SUGGESTION_CHIPS.map((chip) => (
        <button
          key={chip.kind}
          type="button"
          aria-label={chip.ariaLabel}
          onClick={() => onSelect(chip.kind)}
          disabled={disabled}
          className="h-11 shrink-0 cursor-pointer snap-start rounded-full border border-ui-textLight/40 bg-ui-overlay px-4 text-sm text-ui-textLight transition hover:border-ui-textLight active:scale-[0.97] active:border-ui-textLight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-textLight disabled:pointer-events-none disabled:opacity-25"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
