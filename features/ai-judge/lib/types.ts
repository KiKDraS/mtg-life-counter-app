/**
 * AI Judge shared types — SPEC §9.11.
 *
 * Imported by both the client shell (`client.ts`) and the server route
 * (`app/api/judge/route.ts`). Type-only module: no runtime code.
 *
 * @see SPEC.md §9.5 (SSE events), §9.7 (citations), §9.8 (game context)
 */

import type { CounterType } from "@/features/player-zone/types/counter";

/** SPEC §9.8 — snapshot of live board state, serialized at send time. */
export interface GameContext {
  readonly format: "commander";
  readonly players: Array<{
    readonly playerId: number;
    readonly life: number;
    readonly color: string[];
    readonly counters: Array<{
      readonly id: string;
      readonly type: CounterType;
      readonly value: number;
      readonly name?: string;
    }>;
    readonly commanderDamage: Array<{
      readonly playerId: number;
      readonly value: number;
    }>;
  }>;
}

/** SPEC §9.7 — rule or card citation attached to a judge answer. */
export type Citation =
  | {
      readonly type: "rule";
      readonly ruleId: string;
      readonly section: string;
      readonly excerpt: string;
    }
  | {
      readonly type: "card";
      readonly name: string;
      readonly source: string;
      readonly date: string;
      readonly excerpt: string;
    };

/** SPEC §9.6 — token usage + cost of the served model call. */
export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cost: number;
}

/** SPEC §9.5 — POST /api/judge request body. */
export interface JudgeRequest {
  /** SPEC §9.9 — per-modal-open session id. Fresh id = fresh server history. */
  readonly sessionId: string;
  readonly question: string;
  readonly gameContext?: GameContext;
}

/** SPEC §9.5 — SSE event stream payloads. */
export type JudgeEvent =
  | { readonly type: "token"; readonly content: string }
  | {
      readonly type: "done";
      readonly citations: Citation[];
      readonly usage: Usage;
      readonly model: string;
      readonly sourcesUsed: string[];
    }
  | {
      readonly type: "error";
      readonly code:
        | "rate_limited"
        | "model_unavailable"
        | "misconfigured"
        | "timeout"
        | "bad_request";
      readonly message: string;
    };
