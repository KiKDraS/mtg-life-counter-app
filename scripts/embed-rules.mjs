#!/usr/bin/env node
// Embed the committed rules bundle into embeddings-bundle.json (SPEC §9.4).
// One-time cost per CR version: ~3459 rules, batched 64/request.
// Mirror of rag/embeddings.ts normalizeVector + embed.ts EMBED_DIMENSIONS — keep in sync.
// Usage: OPEN_ROUTER_API_KEY=... OPEN_ROUTER_EMBEDDING_MODEL=... node scripts/embed-rules.mjs
// Exit: 0 ok/unchanged, 1 failure. Writes only when version+hash+model changed.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const RULES_BUNDLE_PATH = fileURLToPath(
  new URL("../features/ai-judge/lib/rag/rules-bundle.json", import.meta.url),
);
const OUTPUT_PATH = fileURLToPath(
  new URL("../features/ai-judge/lib/rag/embeddings-bundle.json", import.meta.url),
);
const EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const BATCH_SIZE = 64;
const DIMENSIONS = 1024; // openai/text-embedding-3-small; fixed — must match embed.ts
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 2_000, 4_000];

/** Unit-normalize — mirrors normalizeVector in rag/embeddings.ts. */
function normalizeVector(values) {
  const out = new Float32Array(values);
  let sum = 0;
  for (let i = 0; i < out.length; i++) sum += out[i] * out[i];
  const norm = Math.sqrt(sum);
  if (norm === 0) return out; // zero vector stays zeros — never NaN
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/**
 * Embed one batch. 429/5xx → retry 1s/2s/4s (max 3). Other 4xx (incl. a
 * model rejecting `dimensions`) fail loudly — never retried without it: the
 * bundle must record exact dims.
 */
async function embedBatch(texts, apiKey, model) {
  let lastError = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt - 1]));
    try {
      const res = await fetch(EMBEDDINGS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: texts, dimensions: DIMENSIONS }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) {
        throw new Error(
          `embeddings API returned ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
      }
      lastError = new Error(`embeddings API returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

try {
  const bundle = JSON.parse(await readFile(RULES_BUNDLE_PATH, "utf8"));
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  const model = (process.env.OPEN_ROUTER_EMBEDDING_MODEL ?? "").trim();
  if (!apiKey) throw new Error("OPEN_ROUTER_API_KEY not set");
  if (!model) throw new Error("OPEN_ROUTER_EMBEDDING_MODEL not set (e.g. openai/text-embedding-3-small)");

  let existing = null;
  try {
    existing = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
  } catch {
    /* first run — no bundle yet */
  }

  if (
    existing &&
    existing.version === bundle.version &&
    existing.hash === bundle.hash &&
    existing.model === model &&
    existing.dimensions === DIMENSIONS
  ) {
    console.log("unchanged");
    process.exit(0);
  }

  const texts = bundle.rules.map(([, text]) => text);
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const data = await embedBatch(batch, apiKey, model);
    // Match by index, preserve rule order.
    const byIndex = new Map(data.data.map((d) => [d.index, d.embedding]));
    for (let j = 0; j < batch.length; j++) {
      const embedding = byIndex.get(j);
      if (embedding === undefined) {
        throw new Error(`batch ${i / BATCH_SIZE}: missing embedding at index ${j}`);
      }
      if (typeof embedding === "string") {
        throw new Error(`batch ${i / BATCH_SIZE}: base64 embedding — expected float array`);
      }
      const ruleId = bundle.rules[i + j][0];
      vectors.push([ruleId, Buffer.from(normalizeVector(embedding).buffer).toString("base64")]);
    }
    console.log(`embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length}`);
  }

  const output = {
    version: bundle.version,
    hash: bundle.hash,
    model,
    dimensions: DIMENSIONS,
    vectors,
  };
  await writeFile(OUTPUT_PATH, JSON.stringify(output) + "\n");
  console.log(
    `${existing?.version ?? "(none)"} -> ${bundle.version} (${vectors.length} vectors)`,
  );
} catch (err) {
  console.error(`embed:refresh failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}