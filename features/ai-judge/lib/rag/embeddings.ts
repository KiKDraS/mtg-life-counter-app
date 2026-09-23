/**
 * Semantic rule retrieval — pure TS (SPEC §9.4).
 *
 * No Node APIs, no fetch, no fs. Browser-portable unchanged (offline seam
 * §9.11). Corpus vectors are UNIT vectors (normalized at build time by
 * scripts/embed-rules.mjs) — cosine similarity = plain dot product.
 */

import type { RulesArtifact } from "./rules-source";
import type { RetrievedRule } from "./retrieval";
import { TOP_K } from "./retrieval";

/** Versioned embedding artifact — keyed by rules version+hash (§9.3, §9.4). */
export interface EmbeddingsArtifact {
  /** = rules-bundle version ("effective as of …"). */
  readonly version: string;
  /** = rules-bundle hash — staleness key (§9.3). */
  readonly hash: string;
  /** Embedding model slug that produced the vectors. */
  readonly model: string;
  readonly dimensions: number;
  readonly vectors: ReadonlyArray<{
    readonly ruleId: string;
    readonly embedding: Float32Array;
  }>;
}

/**
 * @description Dot product of two unit vectors (cosine similarity — vectors
 * are normalized at build time). Mismatched lengths → 0, never throws.
 * @param a Unit vector.
 * @param b Unit vector.
 * @returns Cosine similarity in [-1, 1]; 0 on length mismatch.
 */
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * @description Unit-normalize a vector. Zero vector stays zeros — never NaN.
 * Used by scripts/embed-rules.mjs (mirrored there — plain .mjs) and tests.
 * @param v Raw embedding vector (number[] or Float32Array).
 * @returns Unit vector copy.
 */
export function normalizeVector(v: number[] | Float32Array): Float32Array {
  const out = Float32Array.from(v);
  let sum = 0;
  for (let i = 0; i < out.length; i++) sum += out[i] * out[i];
  const norm = Math.sqrt(sum);
  if (norm === 0) return out;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/**
 * @description True iff the embeddings artifact matches the rules artifact —
 * same version + hash (staleness key §9.3). Model match is checked by the
 * caller at config level (bundle.model vs env).
 * @param embeddings Embeddings artifact, or null.
 * @param rules Rules artifact, or null.
 * @returns True when both non-null and version+hash equal.
 */
export function embeddingsMatchRules(
  embeddings: EmbeddingsArtifact | null,
  rules: RulesArtifact | null,
): embeddings is EmbeddingsArtifact {
  if (embeddings === null || rules === null) return false;
  return embeddings.version === rules.version && embeddings.hash === rules.hash;
}

/**
 * @description Dot-product retrieval: top-k rules by cosine similarity, desc.
 * O(n) scoring pass over all vectors + sort. Rule text comes from the rules
 * artifact — a ruleId missing there is skipped (stale-ish data, never
 * fabricated). Ties broken by rule-id order.
 * @param questionVector Unit question embedding.
 * @param embeddings Embeddings artifact (unit vectors).
 * @param rules Rules artifact map (ruleId → text).
 * @param topK Max results (default {@link TOP_K}).
 * @returns Top-k retrieved rules, score desc.
 */
export function retrieveSemantic(
  questionVector: Float32Array,
  embeddings: EmbeddingsArtifact,
  rules: ReadonlyMap<string, string>,
  topK: number = TOP_K,
): RetrievedRule[] {
  const scored: RetrievedRule[] = [];
  for (const { ruleId, embedding } of embeddings.vectors) {
    const text = rules.get(ruleId);
    if (text === undefined) continue;
    scored.push({ ruleId, text, score: cosine(questionVector, embedding) });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0),
  );
  return scored.slice(0, topK);
}