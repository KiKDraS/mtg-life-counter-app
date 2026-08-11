"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Splits inline text on `**bold**` markers into <strong> nodes. Unmatched
 * markers (e.g. mid-stream partials) pass through as plain text.
 */
function renderInline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index}>{part}</strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

/**
 * Rule reference regex — space form only (`CR 405.1`, `rule 405.2a`,
 * `regla 405.1`), any case. Bare numbers like "(405.1)" or glossary
 * entries like "100.2c" without a prefix are left alone.
 * ponytail: no space-less "CR405.1" form; add when model emits it.
 */
const RULE_REF_RE = /\b(?:CR|rule|regla)\s+(\d{3}\.\d+[a-z]?)\b/gi;

/**
 * @description
 * Extracts all rule references from a text segment: strips each occurrence
 * (including adjacent parentheses, e.g. "(CR 405.1)") and normalizes the
 * prefix to `CR <num>`. Incomplete mid-stream refs ("CR 405.") match
 * nothing and pass through literal — the paragraph re-renders when the ref
 * completes.
 *
 * @param text The raw segment text.
 * @returns The cleaned text plus normalized `CR <num>` refs in order.
 */
function extractRuleRefs(text: string): { readonly text: string; readonly refs: string[] } {
  const refs: string[] = [];
  let cleaned = "";
  let last = 0;
  for (const match of text.matchAll(RULE_REF_RE)) {
    const index = match.index;
    const length = match[0].length;
    const withParens =
      text[index - 1] === "(" && text[index + length] === ")";
    const start = withParens ? index - 1 : index;
    const end = withParens ? index + length + 1 : index + length;
    cleaned += text.slice(last, start);
    refs.push(`CR ${match[1]}`);
    last = end;
  }
  cleaned += text.slice(last);
  if (refs.length > 0) {
    // Collapse gaps left by stripped refs ("zone  and") and fix " ." → ".".
    cleaned = cleaned.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1");
  }
  return { text: cleaned, refs };
}

/**
 * @description
 * Renders a text segment: bold processing on the ref-stripped text, then
 * rule refs appended as a ` - <i>CR <num></i>` suffix, comma-joined for
 * multiple refs (DESIGN §6.4.2). Italic, `#FAF8F5` 75% opacity — less
 * solid than body text, still high contrast on MANA.b.
 *
 * @param text The raw segment text.
 * @returns Inline React nodes: bold spans + optional italic ref suffix.
 */
function renderSegment(text: string): ReactNode[] {
  const { text: cleaned, refs } = extractRuleRefs(text);
  const nodes = renderInline(cleaned);
  if (refs.length > 0) {
    nodes.push(" - ");
    refs.forEach((ref, index) => {
      if (index > 0) nodes.push(", ");
      nodes.push(
        <i key={`ref-${index}`} className="text-ui-textLight/75">
          {ref}
        </i>,
      );
    });
  }
  return nodes;
}

/** "ul" | "ol" when the line starts with a list marker; null otherwise. */
function lineListKind(line: string): "ul" | "ol" | null {
  if (line.startsWith("- ") || line.startsWith("• ")) return "ul";
  if (/^\d+\.\s/.test(line)) return "ol";
  return null;
}

/** Strips the list prefix ("- ", "• " or "1. ") from one line. */
const stripListPrefix = (line: string, kind: "ul" | "ol"): string =>
  kind === "ul" ? line.slice(2) : line.replace(/^\d+\.\s/, "");

type Segment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "ul" | "ol"; readonly items: readonly string[] };

/**
 * Splits one block into alternating text runs and list runs. A list run is any
 * run of consecutive same-kind list lines (`- ` / `• ` / `1. `) — no blank
 * line required, so free-tier "wall of text" answers still get lists.
 * Single newlines inside a text run collapse to spaces.
 *
 * "Intro\n- a\n- b\nOutro" → text("Intro"), ul(["a", "b"]), text("Outro").
 */
function splitBlock(block: string): Segment[] {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const segments: Segment[] = [];
  let index = 0;
  while (index < lines.length) {
    const kind = lineListKind(lines[index]);
    if (kind) {
      const items: string[] = [];
      while (index < lines.length && lineListKind(lines[index]) === kind) {
        items.push(stripListPrefix(lines[index], kind));
        index++;
      }
      segments.push({ kind, items });
    } else {
      const text: string[] = [];
      while (index < lines.length && !lineListKind(lines[index])) {
        text.push(lines[index]);
        index++;
      }
      segments.push({ kind: "text", text: text.join(" ") });
    }
  }
  return segments;
}

/**
 * Splits a long single-block answer into sentence-boundary paragraphs,
 * ~2 sentences per <p> (≤240 chars). The negative lookahead after the
 * sentence-ending punctuation refuses to split when the next token starts
 * with a digit, so rule ids like "CR 405.1a" stay intact.
 */
function paragraphize(text: string): string[] {
  const sentences = text.split(
    /(?<=[.!?])\s+(?![0-9])(?=[A-Z¿¡«])/,
  );
  const paragraphs: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > 240) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

/** Plain-text length with markdown markers stripped (for the fallback). */
const plainLength = (content: string): number =>
  content.replace(/\*\*/g, "").length;

interface MarkdownTextProps {
  /** Model answer text with the DESIGN §6.4 markdown subset. */
  readonly content: string;
}

/**
 * @description
 * Minimal markdown-subset renderer for AI Judge answers (DESIGN §6.4.2).
 * Block level: splits on `\n\n`; within each block, runs of consecutive
 * `- `/`• ` lines → <ul> and `1. ` runs → <ol> (no blank line required),
 * everything else → <p> (single newlines collapse to spaces). When the whole
 * answer is one long text block (no lists, no blank-line separation,
 * >300 chars) it falls back to sentence-boundary paragraphs (~2 sentences,
 * ≤240 chars, rule-id guard keeps "CR 405.1a" unsplit).
 * Inline: `**text**` → <strong>; rule refs (`CR|rule|regla <num>`) →
 * stripped from the text and appended at paragraph end as a
 * ` - <i>CR <num></i>` suffix (comma-joined, DESIGN §6.4.2). Escapes via
 * React text nodes — no dangerouslySetInnerHTML.
 *
 * @param content The raw answer string from the model.
 * @returns Paragraph/list React nodes with bold spans and italic refs.
 *
 * @see DESIGN.md §6.4.2
 */
export function MarkdownText({ content }: Readonly<MarkdownTextProps>) {
  const hasBlankSeparator = /\n{2,}/.test(content);
  const nodes: ReactNode[] = [];
  let hasList = false;

  content.split(/\n{2,}/).forEach((block) => {
    splitBlock(block).forEach((segment) => {
      const key = nodes.length;
      if (segment.kind === "text") {
        nodes.push(
          <p key={key} className="my-1 first:mt-0 last:mb-0">
            {renderSegment(segment.text)}
          </p>,
        );
      } else {
        hasList = true;
        const List = segment.kind;
        nodes.push(
          <List key={key} className="my-1 list-inside space-y-0.5 first:mt-0 last:mb-0">
            {segment.items.map((item, index) => (
              <li key={index}>{renderSegment(item)}</li>
            ))}
          </List>,
        );
      }
    });
  });

  if (!hasBlankSeparator && !hasList && plainLength(content) > 300) {
    return (
      <Fragment>
        {paragraphize(content.replace(/\s+/g, " ")).map((paragraph, index) => (
          <p key={index} className="my-1 first:mt-0 last:mb-0">
            {renderSegment(paragraph)}
          </p>
        ))}
      </Fragment>
    );
  }

  return <Fragment>{nodes}</Fragment>;
}
