/**
 * Fire-and-forget Axiom ingest for judge timings + usage (SPEC §9.5).
 * Never throws, never blocks, never logs the token. No retry.
 */

import { AXIOM_OK, axiomDataset, axiomToken } from "./config";
import type { JudgeTimings, Usage } from "@/features/ai-judge/lib/types";
import { after } from "next/server";

const AXIOM_INGEST_URL = `https://api.axiom.co/api/v1/ingest/${axiomDataset}`;

/** SPEC §9.5 — one timing/usage telemetry event. */
interface JudgeTelemetry {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cost: number;
  readonly error?: string; // error code when the request failed
  readonly timings: JudgeTimings;
}

/** SPEC §9.5 — schedule telemetry after the response flushes. Unknown → 0. */
export const scheduleTelemetry = (
  timings: JudgeTimings,
  model: string,
  usage?: Usage,
  error?: string,
): void => {
  after(() => {
    sendTiming({
      model,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      cost: usage?.cost ?? 0,
      ...(error ? { error } : {}),
      timings,
    });
  });
};

/** Send one telemetry event to Axiom when configured; no-op otherwise. */
export const sendTiming = (timing: JudgeTelemetry): void => {
  if (!AXIOM_OK) return;
  try {
    void fetch(AXIOM_INGEST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${axiomToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          ...timing.timings,
          model: timing.model,
          inputTokens: timing.inputTokens,
          outputTokens: timing.outputTokens,
          cost: timing.cost,
          ...(timing.error ? { error: timing.error } : {}),
          _time: new Date().toISOString(),
        },
      ]),
    }).catch(() => {});
  } catch {
    // Sync throw (malformed dataset URL, fetch unavailable) — telemetry never
    // propagates to the route. ponytail: async rejections already swallowed
    // by .catch; this guards the sync-throw path only.
  }
};