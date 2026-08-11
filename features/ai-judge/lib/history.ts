/**
 * In-memory session history (SPEC §9.9).
 *
 * Pure message building — the store itself lives in the route. Never written
 * to disk / IndexedDB / localStorage. FIFO prune to a 24k token budget:
 * keep system prompt + last N turns that fit.
 */

export interface JudgeTurn {
  readonly user: string;
  readonly assistant: string;
}

export interface JudgeHistory {
  readonly system: string;
  readonly turns: JudgeTurn[];
}

export const MAX_HISTORY_TOKENS = 24_000;

/** SPEC §9.9 — token estimate: ceil(chars / 4). O(1). */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

/**
 * @description Build the SDK messages array: system prompt first (never
 * pruned), then the newest turns that fit the budget, oldest first (FIFO),
 * final message = the current user turn with the RAG context already applied
 * (SPEC §9.7 — context lives in the user message).
 * @param history Session history (system prompt + turns).
 * @param question The current question.
 * @param contextText RAG context text appended as the final user message.
 * @returns Message array: system, kept turns, final context user message.
 */
export function buildMessages(
  history: JudgeHistory,
  question: string,
  contextText: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: history.system },
  ];

  let budget = MAX_HISTORY_TOKENS - estimateTokens(history.system) - estimateTokens(contextText);
  const kept: JudgeTurn[] = [];

  for (let i = history.turns.length - 1; i >= 0; i--) {
    const turn = history.turns[i];
    const cost = estimateTokens(turn.user) + estimateTokens(turn.assistant);
    if (cost > budget) break;
    kept.unshift(turn);
    budget -= cost;
  }

  for (const turn of kept) {
    messages.push({ role: "user", content: turn.user }, { role: "assistant", content: turn.assistant });
  }
  messages.push({ role: "user", content: contextText });
  return messages;
}
