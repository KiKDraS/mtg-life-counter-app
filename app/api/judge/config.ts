/**
 * Env config + OpenRouter client for the AI Judge (SPEC §9.2).
 *
 * Validated once at module load: missing/malformed `OPEN_ROUTER_API_KEY` or
 * `OPEN_ROUTER_MODEL` → `ENV_OK` false → route answers 503 `misconfigured`.
 * Model format `vendor/model`. Server-only env, never logged.
 */

import { OpenRouter } from "@openrouter/sdk";

/** `vendor/model` format per SPEC §9.2. */
const MODEL_FORMAT_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:\/-]*$/i;

/** Resolved env config. Empty strings when unset. */
export const env = {
  apiKey: process.env.OPEN_ROUTER_API_KEY ?? "",
  model: (process.env.OPEN_ROUTER_MODEL ?? "").trim(),
  fallbackModel: (process.env.OPEN_ROUTER_FALLBACK_MODEL ?? "").trim(),
};

/** True when the required key + model are present and well-formed. */
export const ENV_OK = env.apiKey.length > 0 && MODEL_FORMAT_RE.test(env.model);

// Never constructed/used when ENV_OK is false → no fetch without a key.
export const openRouter = new OpenRouter({ apiKey: env.apiKey });
