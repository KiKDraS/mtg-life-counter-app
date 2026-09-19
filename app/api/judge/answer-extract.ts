/**
 * Streaming answer/citations splitter (SPEC §9.5).
 *
 * Model output: plain-text answer, then a line `<<<CITATIONS>>>`, then a
 * compact JSON object of citation ids. The delimiter splitter emits answer
 * chars as they arrive — first visible char ≈ first model chunk; the
 * citations tail is held until `citationsJson()` at stream end.
 *
 * Pure module — no Node APIs, browser-portable.
 */

const DELIMITER = "<<<CITATIONS>>>";

/**
 * Streaming answer/citations splitter (SPEC §9.5). Feed raw model chunks via
 * {@link push}; it returns the answer chars captured by that chunk. After the
 * stream ends, {@link flush} returns any remaining answer chars (no-delimiter
 * case) and {@link citationsJson} the tail after the delimiter.
 */
export class AnswerExtractor {
  private buffer = "";
  private streamed = 0; // answer chars already returned
  private tail = ""; // citations JSON after delimiter
  private found = false;

  /** Feed one raw chunk. Returns the chars to stream to the client. */
  push(chunk: string): string {
    if (this.found) {
      this.tail += chunk;
      return "";
    }
    this.buffer += chunk;
    const idx = this.buffer.indexOf(DELIMITER);
    if (idx === -1) {
      // Hold back a possible partial delimiter prefix — emit only what can't
      // be the start of DELIMITER.
      const safe = Math.max(0, this.buffer.length - DELIMITER.length + 1);
      const emit = this.buffer.slice(this.streamed, safe);
      this.streamed = safe;
      return emit;
    }
    // Delimiter found: everything before it is the answer, everything after
    // is the citations tail. A trailing newline right before the delimiter
    // may already have been streamed (1-char deltas) — harmless either way.
    const emit = this.buffer.slice(this.streamed, idx);
    this.streamed = idx + DELIMITER.length;
    this.tail = this.buffer.slice(this.streamed);
    this.found = true;
    return emit;
  }

  /** Remaining answer chars when the stream ends without a delimiter. */
  flush(): string {
    if (this.found) return "";
    const emit = this.buffer.slice(this.streamed);
    this.streamed = this.buffer.length;
    return emit;
  }

  /** Citations JSON tail (after DELIMITER), trimmed; null when no delimiter. */
  citationsJson(): string | null {
    return this.found ? this.tail.trim() : null;
  }
  // ponytail: an answer containing the literal delimiter breaks the tail
  // parse — pathological ("<<<CITATIONS>>>" in real answer text), acceptable.
}