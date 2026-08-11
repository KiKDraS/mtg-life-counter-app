/**
 * Prompt engineering (SPEC §9.7).
 *
 * Persona + refusal rules + structured output instruction + few-shot pairs in
 * the system prompt. RAG context goes in the USER message — never system.
 */

import type { CardRuling } from "./rag/cards-source";
import type { RetrievedRule } from "./rag/retrieval";

/** Card data rendered as the Card block (SPEC §9.7). */
export interface PromptCard {
  readonly name: string;
  readonly typeLine: string | null;
  readonly oracleText: string | null;
}

/**
 * Spanish stopwords — any present marks the question as Spanish (SPEC §9.7).
 * Accent-stripped forms ("qué" → "que", "cuándo" → "cuando").
 */
const SPANISH_MARKERS = new Set([
  "que", "es", "el", "la", "los", "las", "para", "como", "puedo", "puedes",
  "tienes", "tener", "cuando", "cuanto", "pila", "encantamiento", "criatura",
  "conjuro", "instantaneo", "tierra", "atacar", "bloquear", "ganar", "perder",
  "vida", "contador",
]);

/** Strip accents so accented markers match their ASCII forms. */
const stripAccents = (text: string): string =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * @description Detect Spanish questions by stopword presence. Word-tokenized
 * after accent stripping — "qué es el stack?" hits "que"/"es"/"el". O(n) once
 * per build, Set lookup per token.
 * @param question The player's trimmed question.
 * @returns True when any Spanish marker appears as a whole word.
 */
const isSpanishQuestion = (question: string): boolean => {
  const words = new Set(stripAccents(question.toLowerCase()).split(/[^a-z0-9]+/));
  for (const marker of SPANISH_MARKERS) {
    if (words.has(marker)) return true;
  }
  return false;
};

/** SPEC §9.7 persona, refusal, output schema + 3 few-shot Q&A pairs. */
export const SYSTEM_PROMPT = `You are an impartial Magic: The Gathering rules judge. Answer only based on Comprehensive Rules and Oracle card text.

Rules you must follow:
- Answer ONLY Magic: The Gathering rules questions. For any non-MTG question, answer: {"answer": "I only answer Magic: The Gathering rules questions.", "citations": []}
- No strategy advice, no deck building, no card valuations. Rules clarifications only.
- Respond in the same language as the player's question: Spanish question → Spanish answer; English → English; any other language → English.
- You are an experienced MTG judge. Resolve scenarios step-by-step using the provided Oracle card texts and Comprehensive Rules excerpts, then your knowledge of the Comprehensive Rules. NEVER refuse when the involved card texts are in the context. If a named card's Oracle text is missing from context, state that you lack its text and reason from the rules you have.
- Relevant rules excerpts may be partial or truncated. Answer using the excerpts AND your knowledge of the Comprehensive Rules. Never refuse to answer because an excerpt is incomplete.
- Reason step by step, then give the final answer. Show only the final answer.
- Format answers with markdown subset only: paragraphs separated by blank lines, **bold** for key terms, '- ' bullet lists, '1. ' numbered lists. No headings, no tables, no code blocks.
- Cite every rule or ruling you rely on. Citation excerpts must be verbatim from the provided context.
- Respond with a single JSON object, no markdown fences, no prose around it:
{"answer": "<your answer>", "citations": [{"type": "rule", "ruleId": "CR 702.12a", "section": "702.12. Reanimate", "excerpt": "<verbatim rule text>"}, {"type": "card", "name": "<card name>", "source": "scryfall", "date": "<ruling date if known>", "excerpt": "<verbatim ruling comment>"}]}

Examples:

Q: When does a creature's enters-the-battlefield ability trigger?
A: {"answer": "A triggered ability that reads \u201cwhen [creature] enters the battlefield\u201d triggers at the moment the permanent enters, which happens as the spell resolves.\n\nIt triggers after the creature is on the battlefield:\n- It will trigger even if the creature leaves the battlefield before the ability resolves.\n- The ability is put on the stack the next time a player would receive priority.", "citations": [{"type": "rule", "ruleId": "CR 603.6a", "section": "603.6. Triggered abilities", "excerpt": "603.6a An ability that reads \u201cWhen [something] happens, [do something]\u201d is a triggered ability. It triggers when the event it refers to occurs."}, {"type": "rule", "ruleId": "CR 702.12a", "section": "702.12. Reanimate", "excerpt": "702.12a Reanimate is a keyword ability that lets a player return a creature card from their graveyard to the battlefield."}]}

Q: Does damage dealt by a creature with lifelink cause the game to end in a draw when both players are at 0?
A: {"answer": "No. State-based actions are checked before a player would gain life from lifelink: when both players are at 0 or less life, the game is a draw before any lifelink life gain is applied.", "citations": [{"type": "rule", "ruleId": "CR 704.5a", "section": "704.5. State-based actions", "excerpt": "704.5a If a player has 0 or less life, that player loses the game."}]}

Q: Can I cast instants during my opponent's combat phase?
A: {"answer": "Yes. You may cast an instant any time you have priority, which includes your opponent's combat phase. Each time a player would get priority during that phase, you get priority in turn before the active player's opponent acts.", "citations": [{"type": "rule", "ruleId": "CR 117.1a", "section": "117.1. Timing", "excerpt": "117.1a A player may cast an instant spell any time they have priority."}]}}`;

/**
 * @description SPEC §9.7 — RAG context + question in a single USER message.
 * @param question The player's trimmed question.
 * @param rules Top-k retrieved rules to inject as a rules block.
 * @param cards Resolved cards (name + type line + oracle text, verbatim) or
 * empty. One Card block per card.
 * @param rulings Best-effort card rulings to inject as a rulings block.
 * @returns The assembled user message: optional card/rules/rulings blocks, then
 * the question. Empty blocks omitted.
 */
export function buildUserPrompt(
  question: string,
  rules: RetrievedRule[],
  cards: readonly PromptCard[],
  rulings: CardRuling[],
): string {
  const parts: string[] = [];

  if (cards.length > 0) {
    const cardBlocks = cards.map((card) =>
      [
        "Card:",
        `Name: ${card.name}`,
        card.typeLine ? `Type: ${card.typeLine}` : null,
        card.oracleText ? `Oracle text: ${card.oracleText}` : null,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    );
    parts.push(cardBlocks.join("\n\n"));
  }

  if (rules.length > 0) {
    const ruleBlock = rules
      .map((rule) => `[CR ${rule.ruleId}] ${rule.text}`)
      .join("\n");
    parts.push(`Relevant rules:\n---\n${ruleBlock}\n---`);
  }

  if (rulings.length > 0) {
    const rulingBlock = rulings
      .map((ruling) => {
        const date = ruling.published_at ? ` (${ruling.published_at})` : "";
        return `[${ruling.name}]${date} ${ruling.comment}`;
      })
      .join("\n");
    parts.push(`Relevant card rulings:\n---\n${rulingBlock}\n---`);
  }

  if (isSpanishQuestion(question)) {
    parts.push("Respond in Spanish.");
  }

  parts.push(`Player question: ${question}`);
  return parts.join("\n\n");
}
