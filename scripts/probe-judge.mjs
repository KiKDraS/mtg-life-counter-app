#!/usr/bin/env node
// External latency probe for POST /api/judge (SPEC §9.5). No deps, Node 20+ fetch.
// Usage: node scripts/probe-judge.mjs <URL> [iterations]
//   URL: base like https://your-app.vercel.app (or env JUDGE_PROD_URL); /api/judge appended.
// Battery fixed so results compare across runs. Exit 0 unless every iteration fails.

const QUESTIONS = [
  "Si tengo a Lier, Disciple of the Drowned. Puedo usar Sublime Epiphany y elegir Counter target spell?",
  "Can I cast instants during my opponent's combat phase?",
  "Does Lier, Disciple of the Drowned let me cast Sublime Epiphany from my graveyard?",
];

const base = process.argv[2] ?? process.env.JUDGE_PROD_URL;
if (!base) {
  console.error("Usage: node scripts/probe-judge.mjs <URL> [iterations]");
  console.error("  or set JUDGE_PROD_URL");
  process.exit(1);
}
const endpoint = base.replace(/\/+$/, "").replace(/\/api\/judge$/, "") + "/api/judge";
const runs = Number(process.argv[3] ?? 5);
const ITER_TIMEOUT_MS = 90_000;

const pct = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))] ?? 0;
const stats = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return { min: s[0] ?? 0, median: pct(s, 0.5), p95: pct(s, 0.95) };
};

/** One probe iteration → { timings, outputTokens, model } or { error }. */
async function oneIteration(question, i) {
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ sessionId: `probe-${Date.now()}-${i}`, question }),
      signal: AbortSignal.timeout(ITER_TIMEOUT_MS),
    });
  } catch (err) {
    return { error: `network: ${err.message}` };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  }

  let buf = "";
  let firstTokenMs = null;
  let done = null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + ITER_TIMEOUT_MS;
  try {
    while (true) {
      const { done: eof, value } = await reader.read();
      if (eof) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          let event;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (event.type === "token" && firstTokenMs === null)
            firstTokenMs = performance.now() - t0;
          if (event.type === "error") return { error: `judge error: ${event.code}` };
          if (event.type === "done") done = event;
        }
      }
      if (done) break;
      if (Date.now() > deadline) return { error: "timeout: no done event" };
    }
  } catch (err) {
    return { error: `stream: ${err.message}` };
  }
  if (!done) return { error: "stream ended without done" };

  // Server timings preferred; client-side fallback when absent.
  const clientTotalMs = Math.round(performance.now() - t0);
  return {
    timings: done.timings ?? {
      contextMs: null,
      firstTokenMs: firstTokenMs !== null ? Math.round(firstTokenMs) : null,
      firstCharMs: firstTokenMs !== null ? Math.round(firstTokenMs) : null,
      totalMs: clientTotalMs,
    },
    outputTokens: done.usage?.outputTokens ?? null,
    model: done.model ?? null,
  };
}

let anySuccess = false;
for (const [qi, question] of QUESTIONS.entries()) {
  const results = [];
  for (let i = 0; i < runs; i++) results.push(await oneIteration(question, i));
  const ok = results.filter((r) => !r.error);
  if (ok.length > 0) anySuccess = true;

  console.log(`\nQ${qi + 1}: ${question}`);
  console.log(`  ${ok.length}/${runs} ok`);
  for (const r of results) if (r.error) console.log(`  FAIL: ${r.error}`);

  const field = (name) => stats(ok.map((r) => r.timings[name]).filter((v) => v !== null && v !== undefined));
  for (const name of ["contextMs", "firstTokenMs", "firstCharMs", "totalMs"]) {
    const s = field(name);
    console.log(`  ${name.padEnd(12)} min ${s.min}  median ${s.median}  p95 ${s.p95}`);
  }
  const out = stats(ok.map((r) => r.outputTokens).filter((v) => v !== null && v !== undefined));
  console.log(`  outputTokens min ${out.min}  median ${out.median}  p95 ${out.p95}`);
  const models = [...new Set(ok.map((r) => r.model).filter(Boolean))];
  if (models.length) console.log(`  model: ${models.join(", ")}`);
}

process.exit(anySuccess ? 0 : 1);