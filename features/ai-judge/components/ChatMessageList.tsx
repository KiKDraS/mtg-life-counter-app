"use client";

import { Fragment, useEffect, useRef } from "react";
import type {
  ChatMessage,
  JudgeErrorEvent,
} from "@/features/ai-judge/hooks/use-judge-chat";
import { MarkdownText } from "@/features/ai-judge/components/MarkdownText";

interface ChatMessageListProps {
  readonly messages: ChatMessage[];
  readonly streamText: string;
  readonly isStreaming: boolean;
  readonly errorBubble: JudgeErrorEvent | null;
}

/**
 * @description
 * AI Judge bubble list (DESIGN §6.4). System bubbles left (MANA.b
 * `#666565` / `#FAF8F5`), user bubbles right (MANA.c `#CAC5C0` / `#1A1A1A`),
 * max-width 75%, squared corner on the aligned side. Renders the streaming
 * system bubble with a 3-dot typing indicator while no token arrived, and
 * the error bubble (SPEC §9.10). Auto-scrolls to the newest message.
 *
 * @see DESIGN.md §6.4
 * @see SPEC.md §9.10
 */
export function ChatMessageList({
  messages,
  streamText,
  isStreaming,
  errorBubble,
}: Readonly<ChatMessageListProps>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to newest message on every change. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText, errorBubble, isStreaming]);

  return (
    <div
      ref={scrollRef}
      className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 scrollbar-none"
    >
      {messages.map((message, index) => (
        <Fragment key={index}>
          <div
            className={
              message.role === "user"
                ? "max-w-[75%] self-end rounded-lg rounded-tr-none bg-mana-c px-3 py-2 text-sm whitespace-pre-wrap text-ui-textDark"
                : "max-w-[75%] self-start rounded-lg rounded-tl-none bg-mana-b px-3 py-2 text-sm text-ui-textLight"
            }
          >
            {message.role === "user" ? (
              message.content
            ) : (
              /* DESIGN §6.4 — answer text: markdown subset renderer. */
              <MarkdownText content={message.content} />
            )}
          </div>
        </Fragment>
      ))}

      {/* Streaming system bubble — typing dots until first token. */}
      {isStreaming && (
        <div className="max-w-[75%] self-start rounded-lg rounded-tl-none bg-mana-b px-3 py-2">
          {streamText ? (
            <p className="text-sm whitespace-pre-wrap text-ui-textLight">
              {streamText}
            </p>
          ) : (
            <span
              aria-label="AI Judge is typing"
              className="flex gap-1 text-ui-textLight"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-ui-textLight/70" />
              <span className="size-1.5 animate-pulse rounded-full bg-ui-textLight/70 [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-ui-textLight/70 [animation-delay:300ms]" />
            </span>
          )}
        </div>
      )}

      {/* Error bubble (SPEC §9.10). */}
      {errorBubble && (
        <div className="max-w-[75%] self-start rounded-lg rounded-tl-none bg-mana-b px-3 py-2 text-sm text-ui-textLight">
          {errorBubble.message}
        </div>
      )}
    </div>
  );
}
