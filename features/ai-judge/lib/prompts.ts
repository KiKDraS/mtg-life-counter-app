/**
 * Prompt engineering (SPEC §9.7).
 *
 * Persona + refusal rules + structured output instruction + few-shot pairs in
 * the system prompt. RAG context goes in the USER message — never system.
 * Injected rule excerpts clipped to 1500 chars; answer-side citations
 * unaffected (verbatim lookup).
 */

import type { CardRuling } from "./rag/cards-source";
import type { RetrievedRule } from "./rag/retrieval";

/** Prompt-side rule excerpt cap (SPEC §9.7) — citations still verbatim. */
const PROMPT_RULE_MAX = 1500;
/** Clip to ~1500 chars at a word boundary, append "…" when clipped. */
const clipPromptRule = (text: string): string => {
  if (text.length <= PROMPT_RULE_MAX) return text;
  const clipped = text.slice(0, PROMPT_RULE_MAX).replace(/\s+\S*$/, "");
  return `${clipped}…`;
};

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

/** SPEC §9.7 persona, refusal, output contract + 3 few-shot Q&A pairs. */
export const SYSTEM_PROMPT = `You are an impartial MTG rules judge. Answer only from Comprehensive Rules and Oracle card text.

Rules:
- MTG questions only. Non-MTG → answer: I only answer Magic: The Gathering rules questions.
- No strategy, no deck building, no valuations. Rules only.
- Same language as question: Spanish → Spanish; English → English; other → English.
- Resolve step-by-step from provided Oracle text + CR excerpts + your CR knowledge. NEVER refuse when involved card texts are in context. Missing named-card Oracle text → say so, reason from rules you have.
- Excerpts partial/truncated → answer anyway.
- No reasoning. Final answer only.
- Concise. Shortest complete answer. 2–6 short sentences or short list. Don't restate question. Don't quote card text back.
- Never empty citation placeholders ([] or ()). Cite only via citation id list after <<<CITATIONS>>>.
- Cite every rule or ruling you rely on. Cite rule ids exactly as shown in context ([CR 702.34a] → "702.34a"); card names exactly as shown.
- Answer in plain text (markdown subset only: paragraphs separated by blank lines, **bold**, '- ' bullets, '1. ' numbered lists; no headings/tables/code blocks). Do NOT wrap the answer in JSON. After the answer, output a line with exactly <<<CITATIONS>>> then a single JSON object with compact citation ids: {"citations":[{"type":"rule","ruleId":"702.34a"},{"type":"card","name":"Lier, Disciple of the Drowned"}]}

Examples:

Q: When does a creature's enters-the-battlefield ability trigger?
A: A triggered ability that reads "when [creature] enters the battlefield" triggers when the permanent enters, after it is on the battlefield.
<<<CITATIONS>>>
{"citations":[{"type":"rule","ruleId":"603.6a"}]}

Q: Does damage dealt by a creature with lifelink cause the game to end in a draw when both players are at 0?
A: No. State-based actions are checked before a player would gain life from lifelink: when both players are at 0 or less life, the game is a draw before any lifelink life gain is applied.
<<<CITATIONS>>>
{"citations":[{"type":"rule","ruleId":"704.5a"}]}

Q: Can I cast instants during my opponent's combat phase?
A: Yes. You may cast an instant anytime you have priority, including during your opponent's combat phase.
<<<CITATIONS>>>
{"citations":[{"type":"rule","ruleId":"117.1a"}]}`;

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
        "CARD:",
        `NAME: ${card.name}`,
        card.typeLine ? `TYPE: ${card.typeLine}` : null,
        card.oracleText ? `ORACLE: ${card.oracleText}` : null,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    );
    parts.push(cardBlocks.join("\n\n"));
  }

  if (rules.length > 0) {
    const ruleBlock = rules
      .map((rule) => `[CR ${rule.ruleId}] ${clipPromptRule(rule.text)}`)
      .join("\n");
    parts.push(`RULES:\n${ruleBlock}`);
  }

  if (rulings.length > 0) {
    const rulingBlock = rulings
      .map((ruling) => {
        const date = ruling.published_at ? ` (${ruling.published_at})` : "";
        return `[${ruling.name}]${date} ${ruling.comment}`;
      })
      .join("\n");
    parts.push(`RULINGS:\n${rulingBlock}`);
  }

  if (isSpanishQuestion(question)) {
    parts.push("Answer Spanish.");
  }

  parts.push(`Q: ${question}`);
  return parts.join("\n\n");
}
