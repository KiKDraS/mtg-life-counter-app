/* DESIGN §6.4.1 — one-tap suggestion chips above the AI Judge input. */

export const SUGGESTION_KIND = {
  JudgePlay: "judge-play",
  CardLegality: "card-legality",
  CombatMath: "combat-math",
} as const;
export type SuggestionKind =
  (typeof SUGGESTION_KIND)[keyof typeof SUGGESTION_KIND];

export interface SuggestionChip {
  readonly kind: SuggestionKind;
  /** Short chip text (DESIGN §6.4.1 table). */
  readonly label: string;
  /** Full prompt — a11y label for screen readers (§6.4.1). */
  readonly ariaLabel: string;
  /** Prompt sent on tap. JudgePlay appends serialized game context. */
  readonly prompt: string;
}

export const SUGGESTION_CHIPS: readonly SuggestionChip[] = [
  {
    kind: SUGGESTION_KIND.JudgePlay,
    label: "Judge this play",
    ariaLabel: "Judge this play: <current game state>",
    prompt: "Judge this play",
  },
  {
    kind: SUGGESTION_KIND.CardLegality,
    label: "Card legality",
    ariaLabel: "Is <card> legal in Commander?",
    prompt: "Is <card> legal in Commander?",
  },
  {
    kind: SUGGESTION_KIND.CombatMath,
    label: "Combat math",
    ariaLabel: "Explain combat damage here.",
    prompt: "Explain combat damage here.",
  },
];
