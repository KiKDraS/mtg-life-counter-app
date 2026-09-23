/**
 * Semantic retrieval orchestration — route-layer IO (SPEC §9.4).
 *
 * Question embedding via the OpenRouter embeddings API (SDK instance from
 * config.ts); corpus vectors from the committed embeddings bundle
 * (rag/embeddings-bundle.json, built by `pnpm embed:refresh`). Degradation
 * path: every failure returns null — the caller falls back to lexical
 * retrieval. Never throws, never logs key or question.
 */

import { env, EMBEDDING_OK, openRouter } from "./config";
import {
  embeddingsMatchRules,
  normalizeVector,
  retrieveSemantic,
} from "@/features/ai-judge/lib/rag/embeddings";
import type { EmbeddingsArtifact } from "@/features/ai-judge/lib/rag/embeddings";
import type { RetrievedRule } from "@/features/ai-judge/lib/rag/retrieval";
import type { RulesArtifact } from "@/features/ai-judge/lib/rag/rules-source";
import embeddingsBundleJson from "@/features/ai-judge/lib/rag/embeddings-bundle.json";

/** Fixed embedding dimensions — must match scripts/embed-rules.mjs (1024). */
const EMBED_DIMENSIONS = 1024;

/** Question embedding timeout — exceed → null → lexical fallback. */
const EMBED_TIMEOUT_MS = 10_000;

// Placeholder bundle: `{"version":"","hash":"","model":"","dimensions":0,
// "vectors":[]}` until `pnpm embed:refresh` runs. Static import must resolve
// at build; the empty artifact fails the staleness guards below and cleanly
// falls back to lexical at runtime.

/** Decode a base64 float32-LE vector from the committed bundle. */
function decodeVector(base64: string): Float32Array {
  const bytes = Buffer.from(base64, "base64");
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

/** Decoded bundle — built once (~14MB decode), reused across requests. */
let decoded: EmbeddingsArtifact | null | undefined;

function loadEmbeddings(): EmbeddingsArtifact | null {
  if (decoded !== undefined) return decoded;
  decoded = {
    version: embeddingsBundleJson.version,
    hash: embeddingsBundleJson.hash,
    model: embeddingsBundleJson.model,
    dimensions: embeddingsBundleJson.dimensions,
    vectors: (embeddingsBundleJson.vectors as [string, string][]).map(([ruleId, base64]) => ({
      ruleId,
      embedding: decodeVector(base64),
    })),
  };
  return decoded;
}

/** Wrong-dim vectors → every cosine 0 → arbitrary top-5. Degrade, never guess. */
const wrongDimensions = (embeddings: EmbeddingsArtifact | null): boolean => {
  if (embeddings === null) return true;
  const firstVector = embeddings.vectors[0];
  return (
    embeddings.dimensions !== EMBED_DIMENSIONS ||
    (firstVector !== undefined && firstVector.embedding.length !== EMBED_DIMENSIONS)
  );
};

/**
 * @description Embed the question via the OpenRouter SDK. Non-2xx, timeout,
 * or parse failure → null (never throws — degradation path). Never logs key
 * or question.
 * @param question The player's trimmed question.
 * @returns Unit question embedding, or null.
 */
export async function embedQuestion(question: string): Promise<Float32Array | null> {
  try {
    const result = await openRouter.embeddings.generate(
      {
        requestBody: {
          model: env.embeddingModel,
          input: question,
          dimensions: EMBED_DIMENSIONS,
        },
      },
      { timeoutMs: EMBED_TIMEOUT_MS },
    );
    if (typeof result === "string") return null; // unexpected body shape
    const first = result.data[0];
    if (!first || typeof first.embedding === "string") return null;
    if (first.embedding.length !== EMBED_DIMENSIONS) return null; // model ignored `dimensions`
    return normalizeVector(first.embedding);
  } catch {
    return null; // degradation — caller falls back to lexical
  }
}

/**
 * @description Semantic retrieval orchestration (SPEC §9.4): enabled only
 * when the embedding model env is set + well-formed, the committed bundle was
 * built with that model, and the bundle version+hash match the rules
 * artifact. Any guard or failure → null (caller falls back to lexical).
 * Never throws.
 * @param question The player's trimmed question.
 * @param rules Rules artifact to retrieve against.
 * @returns Top-k semantic rules, or null (fall back to lexical).
 */
export async function retrieveSemanticRules(
  question: string,
  rules: RulesArtifact,
): Promise<RetrievedRule[] | null> {
  if (!EMBEDDING_OK) return null;
  if (embeddingsBundleJson.model !== env.embeddingModel) return null; // stale by definition
  try {
    const embeddings = loadEmbeddings();
    if (!embeddingsMatchRules(embeddings, rules)) return null;
    if (wrongDimensions(embeddings)) return null; // model ignored `dimensions` (e.g. 4096)
    const questionVector = await embedQuestion(question);
    if (!questionVector) return null;
    return retrieveSemantic(questionVector, embeddings, rules.rules);
  } catch {
    return null; // degradation — caller falls back to lexical
  }
}