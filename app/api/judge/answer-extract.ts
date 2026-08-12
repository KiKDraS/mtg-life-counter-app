/**
 * Incremental, escape-aware JSON `answer` extractor (SPEC §9.5).
 *
 * Model output is one JSON object `{answer, citations}`. Only the `answer`
 * string is streamed to the client as token events. This state machine pulls
 * the answer's characters out of the raw JSON as chunks arrive, so the client
 * never sees braces/keys/citations. Chunks may split anywhere, including
 * inside a key, an escape sequence, or a `\uXXXX` code point — the machine
 * waits for more input rather than emitting a wrong char.
 *
 * Fallback: if no `answer` value has opened after `FALLBACK_CHUNKS` chunks or
 * `FALLBACK_CHARS` chars of model output (e.g. the model ignored the JSON
 * schema), `shouldFallback()` reports raw mode and `flushRaw()` returns the
 * un-emitted prefix so the caller streams raw text (SPEC §9.5 degraded path).
 *
 * Pure module — no Node APIs, browser-portable.
 */

/** Machine states (exported for tests): idle → open-quote → capture → done. */
export type AnswerExtractorState = "idle" | "open-quote" | "capture" | "done";

/**
 * Fallback thresholds — raw mode when no answer value opened yet.
 * `FALLBACK_CHUNKS` must cover the JSON preamble (`{"answer": "` = 13 chars;
 * models stream 1-char deltas) plus margin — 24 chunks catches schema
 * violations fast while never firing before the answer quote opens.
 */
export const FALLBACK_CHUNKS = 24;
export const FALLBACK_CHARS = 512;

/** Escape → real char map for the escapes that matter in answer text. */
const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  "\\": "\\",
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
};

/**
 * Streaming JSON answer extractor (SPEC §9.5). Feed raw model chunks via
 * {@link push}; it returns the answer characters captured by that chunk.
 * Use {@link shouldFallback} + {@link flushRaw} for the degraded raw path.
 */
export class AnswerExtractor {
  private buffer = "";
  private state: AnswerExtractorState = "idle";
  /** Answer value opened (opening quote consumed) — fallback disabled. */
  private found = false;
  /** Buffer position consumed by the machine. */
  private readPos = 0;
  /** Buffer chars already returned to the caller (extracted or raw). */
  private emitted = 0;
  private totalChars = 0;
  private chunks = 0;

  /**
   * Feed one raw model chunk. Returns the answer characters newly captured
   * ("" when the answer has not opened yet, or after it closed).
   */
  push(chunk: string): string {
    if (this.state === "done") return "";
    this.buffer += chunk;
    this.totalChars += chunk.length;
    this.chunks += 1;
    if (this.state === "idle") this.scanForKey();
    if (this.state === "open-quote") this.openValue();
    if (this.state === "capture") return this.readValue();
    return "";
  }

  /** True when no answer value opened and the fallback thresholds are hit. */
  shouldFallback(): boolean {
    return !this.found && (this.chunks >= FALLBACK_CHUNKS || this.totalChars >= FALLBACK_CHARS);
  }

  /** All un-emitted raw input (fallback prefix + current chunk remnants). */
  flushRaw(): string {
    const raw = this.buffer.slice(this.emitted);
    this.emitted = this.buffer.length;
    return raw;
  }

  /** Skip until `"answer"` followed by `:`. Re-scans on every push; the
   *  preamble is tiny (≤ fallback cap), so O(n²) is a non-issue. */
  private scanForKey(): void {
    while (this.state === "idle") {
      const i = this.buffer.indexOf('"answer"', this.readPos);
      if (i === -1) return; // key incomplete or not here yet — wait
      const rest = this.buffer.slice(i + 8);
      const m = rest.match(/^\s*:/);
      if (!m) {
        this.readPos = i + 1; // `"answer"` not followed by `:` — skip past it
        continue;
      }
      this.readPos = i + 8 + m[0].length;
      this.state = "open-quote";
    }
  }

  /** After `"answer":` — expect the opening quote of the string value. */
  private openValue(): void {
    const rest = this.buffer.slice(this.readPos);
    const ws = /^\s*/.exec(rest)?.[0] ?? "";
    const c = this.buffer[this.readPos + ws.length];
    if (c === '"') {
      this.readPos += ws.length + 1;
      this.found = true;
      this.state = "capture";
    } else if (c !== undefined) {
      // Value is not a string — malformed. Resume key scan at buffer end.
      this.readPos = this.buffer.length;
      this.state = "idle";
    }
    // else: only whitespace so far — wait for the quote.
  }

  /** Read the string value: unescape, return captured chars. */
  private readValue(): string {
    let out = "";
    while (this.readPos < this.buffer.length) {
      const c = this.buffer[this.readPos];
      if (c === '"') {
        this.readPos += 1;
        this.state = "done";
        break;
      }
      if (c === "\\") {
        if (this.readPos + 1 >= this.buffer.length) break; // wait for escape char
        const e = this.buffer[this.readPos + 1];
        if (e === "u") {
          if (this.readPos + 5 >= this.buffer.length) break; // wait for 4 hex digits
          const hex = this.buffer.slice(this.readPos + 2, this.readPos + 6);
          out += String.fromCharCode(parseInt(hex, 16));
          this.readPos += 6;
        } else {
          out += ESCAPES[e] ?? e;
          this.readPos += 2;
        }
        continue;
      }
      out += c;
      this.readPos += 1;
    }
    this.emitted += out.length;
    return out;
  }
}
