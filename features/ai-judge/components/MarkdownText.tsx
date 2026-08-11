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

/** List flavor when every non-empty line matches; null → paragraph. */
function listKind(
  lines: readonly string[],
): "ul" | "ol" | null {
  if (lines.every((line) => line.startsWith("- "))) return "ul";
  if (lines.every((line) => /^\d+\.\s/.test(line))) return "ol";
  return null;
}

/** Strips the list prefix ("- " or "1. ") from one line. */
const stripListPrefix = (line: string, kind: "ul" | "ol"): string =>
  kind === "ul" ? line.slice(2) : line.replace(/^\d+\.\s/, "");

/**
 * One `\n\n` block → <ul>/<ol> when all lines are same-kind list items,
 * else a <p> with single newlines collapsed to spaces.
 */
function renderBlock(block: string, key: number): ReactNode | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  const kind = listKind(lines);
  if (kind) {
    const List = kind;
    return (
      <List key={key} className="my-1 list-inside space-y-0.5 first:mt-0 last:mb-0">
        {lines.map((line, index) => (
          <li key={index}>{renderInline(stripListPrefix(line, kind))}</li>
        ))}
      </List>
    );
  }

  return (
    <p key={key} className="my-1 first:mt-0 last:mb-0">
      {renderInline(lines.join(" "))}
    </p>
  );
}

interface MarkdownTextProps {
  /** Model answer text with the DESIGN §6.4 markdown subset. */
  readonly content: string;
}

/**
 * @description
 * Minimal markdown-subset renderer for AI Judge answers (DESIGN §6.4).
 * Block level: splits on `\n\n` — all-`- ` blocks → <ul>, all-`1. ` blocks
 * → <ol>, everything else → <p> (single newlines collapse to spaces).
 * Inline: `**text**` → <strong>. Escapes via React text nodes — no
 * dangerouslySetInnerHTML.
 *
 * @param content The raw answer string from the model.
 * @returns Paragraph/list React nodes with bold spans.
 *
 * @see DESIGN.md §6.4
 */
export function MarkdownText({ content }: Readonly<MarkdownTextProps>) {
  const blocks = content
    .split(/\n{2,}/)
    .map(renderBlock)
    .filter((node): node is ReactNode => node !== null);
  return <Fragment>{blocks}</Fragment>;
}
