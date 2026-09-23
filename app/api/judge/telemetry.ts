/**
 * Fire-and-forget Axiom ingest for judge timings + usage (SPEC §9.5).
 * Never throws, never blocks (5s bounded), never logs the token. No retry.
 * Failures log status/name only — dataset name, never body/token.
 * Failure events mirror to the alert dataset (SPEC §9.5) for the Axiom
 * monitor (`| where error != ""`).
 */

import { AXIOM_OK, axiomAlertDataset, axiomDataset, axiomToken } from "./config";
import type { JudgeTimings, Usage } from "@/features/ai-judge/lib/types";
import { after } from "next/server";

/** Bound the after() fetch so it can never hold the function past 5s. */
const TELEMETRY_TIMEOUT_MS = 5_000;

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

/** POST one telemetry event to a dataset (Axiom REST "Ingest data (legacy)"). */
const ingest = (dataset: string, timing: JudgeTelemetry): void => {
  try {
    void fetch(`https://api.axiom.co/v1/datasets/${dataset}/ingest`, {
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
      signal: AbortSignal.timeout(TELEMETRY_TIMEOUT_MS),
    })
      .then((res) => {
        if (!res.ok) {
          // Status + dataset only — never token/body (SPEC §9.5).
          console.error(`[ai-judge] telemetry ingest ${res.status} (${dataset})`);
        }
      })
      .catch((err: unknown) => {
        const name = err instanceof Error ? err.name : "unknown";
        console.error(`[ai-judge] telemetry ingest failed (${dataset}): ${name}`);
      });
  } catch {
    // Sync throw (malformed dataset URL, fetch unavailable) — telemetry never
    // propagates to the route. ponytail: async rejections already handled above;
    // this guards the sync-throw path only.
  }
};

/** Send one telemetry event to Axiom when configured; no-op otherwise.
 * Failures also mirror to the alert dataset. */
export const sendTiming = (timing: JudgeTelemetry): void => {
  if (!AXIOM_OK) return;
  ingest(axiomDataset, timing);
  if (timing.error) ingest(axiomAlertDataset, timing);
};