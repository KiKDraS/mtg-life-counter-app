/**
 * Env config + OpenRouter client for the AI Judge (SPEC §9.2).
 *
 * Validated once at module load: missing/malformed `OPEN_ROUTER_API_KEY` or
 * `OPEN_ROUTER_MODEL` → `ENV_OK` false → route answers 503 `misconfigured`.
 * Model format `vendor/model`. Server-only env, never logged.
 * Optional `OPEN_ROUTER_EMBEDDING_MODEL` gates semantic retrieval (§9.4) —
 * separate from the chat-completion model list; unset → lexical only.
 */

import { OpenRouter } from "@openrouter/sdk";

/** `vendor/model` format per SPEC §9.2. */
const MODEL_FORMAT_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:\/-]*$/i;

/**
 * Zero data retention filter (SPEC §9.2). Any value except the literal
 * "false" → true. "false" disables ZDR for accounts with no ZDR-compliant
 * endpoints (API error: "No endpoints found matching your data policy").
 */
export const zdrEnabled = process.env.OPEN_ROUTER_ZDR !== "false";

/** Accepted values for `OPEN_ROUTER_REASONING_EFFORT` (SPEC §9.2). */
const REASONING_EFFORTS = new Set(["none", "low", "medium", "high"]);

/** Reasoning depth for reasoning models (SPEC §9.2, §9.5). */
export type ReasoningEffort = "none" | "low" | "medium" | "high";

/**
 * Reasoning depth from env — default medium (at-least-median quality floor,
 * SPEC §9.2). Valid override: none/low/medium/high for A/B experiments.
 * Unset or invalid → "medium". Never crashes, never logged.
 */
const rawEffort = (process.env.OPEN_ROUTER_REASONING_EFFORT ?? "")
  .trim()
  .toLowerCase();
export const reasoningEffort: ReasoningEffort = REASONING_EFFORTS.has(rawEffort)
  ? (rawEffort as ReasoningEffort)
  : "medium";

/** Resolved env config. Empty strings when unset. */
export const env = {
  apiKey: process.env.OPEN_ROUTER_API_KEY ?? "",
  model: (process.env.OPEN_ROUTER_MODEL ?? "").trim(),
  fallbackModel: (process.env.OPEN_ROUTER_FALLBACK_MODEL ?? "").trim(),
  embeddingModel: (process.env.OPEN_ROUTER_EMBEDDING_MODEL ?? "").trim(),
};

/** True when the required key + model are present and well-formed. */
export const ENV_OK = env.apiKey.length > 0 && MODEL_FORMAT_RE.test(env.model);

/** Semantic retrieval enabled: embedding model set + well-formed (SPEC §9.4). */
export const EMBEDDING_OK =
  env.embeddingModel.length > 0 && MODEL_FORMAT_RE.test(env.embeddingModel);

/** Telemetry env (optional — judge works without it, SPEC §9.5). */
export const axiomToken = process.env.AXIOM_INGEST_TOKEN ?? "";
export const axiomDataset = process.env.AXIOM_DATASET?.trim() || "judge-timings";
/** Alert dataset for failure mirrors (SPEC §9.5). */
export const axiomAlertDataset = process.env.AXIOM_ALERT_DATASET?.trim() || "judge-alerts";
export const AXIOM_OK = axiomToken.length > 0;

/** Model list in preference order: primary + optional fallback (SPEC §9.6). */
export const models: readonly string[] = [
  env.model,
  ...(env.fallbackModel ? [env.fallbackModel] : []),
];

// Never constructed/used when ENV_OK is false → no fetch without a key.
export const openRouter = new OpenRouter({
  apiKey: env.apiKey,
  // Ranking metadata for OpenRouter's leaderboard (SPEC §9.2); APP_URL
  // overrides the default deploy URL when running elsewhere.
  httpReferer:
    process.env.APP_URL ?? "https://mtg-life-counter-app-alpha.vercel.app/",
  appTitle: "MTG Life Counter",
});
