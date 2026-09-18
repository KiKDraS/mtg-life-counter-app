/**
 * Fire-and-forget Axiom ingest for judge timings (SPEC §9.5).
 * Never throws, never blocks, never logs the token. No retry.
 */

import { AXIOM_OK, axiomDataset, axiomToken } from "./config";
import type { JudgeTimings } from "@/features/ai-judge/lib/types";

const AXIOM_INGEST_URL = `https://api.axiom.co/api/v1/ingest/${axiomDataset}`;

/** Send one timing event to Axiom when configured; no-op otherwise. */
export const sendTiming = (timing: JudgeTimings & { model: string }): void => {
  if (!AXIOM_OK) return;
  void fetch(AXIOM_INGEST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${axiomToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      { ...timing, _time: new Date().toISOString() },
    ]),
  }).catch(() => {});
};