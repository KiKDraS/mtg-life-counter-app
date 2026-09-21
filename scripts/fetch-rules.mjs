#!/usr/bin/env node
// Fetch + parse MTG Comprehensive Rules into the committed bundle (SPEC §9.3.2).
// mirror of rules-source.ts parseRulesHtml — keep in sync.
// Usage: node scripts/fetch-rules.mjs [--file <path>]  (--file reads local HTML, no network)
// Exit: 0 ok/unchanged, 1 failure. Writes bundle only when the hash changed.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BUNDLE_PATH = fileURLToPath(
  new URL("../features/ai-judge/lib/rag/rules-bundle.json", import.meta.url),
);
const RULES_URL = "https://mtg.wtf/help/rules";
const FETCH_TIMEOUT_MS = 10_000;

const ENTITIES = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** FNV-1a 32-bit → 8-char hex. Mirrors hashText in rules-source.ts. */
function hashText(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Strip scripts/styles/tags, decode entities. Mirrors stripHtml. */
function stripHtml(html) {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withBreaks = noScript.replace(/<\/(p|div|h[1-6]|li|section|article)>/gi, "\n");
  const noTags = withBreaks.replace(/<[^>]+>/g, " ");
  return noTags.replace(/&[a-z]+;|&#\d+;/g, (entity) => ENTITIES[entity] ?? entity);
}

const RULE_RE = /^(\d{3})\.(\d+)([a-z])?\.?(?:\s|$)/;
const SECTION_RE = /^(\d{3})\.(?:\s|$)/;

/** Extract "effective as of" date stamp. Mirrors extractVersion. */
function extractVersion(text) {
  const match = text.slice(0, 2000).match(/effective as of\s+([^<(\n]+)/i);
  return match ? `effective as of ${match[1].trim()}` : "unknown";
}

/**
 * Mirror of parseRulesHtml — same split regexes, glossary cut, entity decode,
 * FNV-1a hash. Output [ruleId, text] pairs (JSON Maps don't stringify).
 */
function parseRules(html) {
  const glossaryAt = html.search(/<h[1-6][^>]*id="section-glossary"/);
  const text = stripHtml(glossaryAt === -1 ? html : html.slice(0, glossaryAt));
  const rules = [];
  let currentId = null;
  let currentText = [];

  const flush = () => {
    if (currentId !== null && currentText.length > 0) {
      rules.push([currentId, currentText.join(" ").replace(/\s+/g, " ").trim()]);
    }
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const rule = line.match(RULE_RE);
    if (rule) {
      flush();
      currentId = `${rule[1]}.${rule[2]}${rule[3] ?? ""}`;
      currentText = [line];
      continue;
    }
    const section = line.match(SECTION_RE);
    if (section) {
      flush();
      currentId = section[1];
      currentText = [line];
      continue;
    }
    currentText.push(line);
  }
  flush();

  return { version: extractVersion(text), hash: hashText(text), rules };
}

async function loadHtml() {
  const fileArg = process.argv.indexOf("--file");
  if (fileArg !== -1 && process.argv[fileArg + 1]) {
    return readFile(process.argv[fileArg + 1], "utf8");
  }
  const res = await fetch(RULES_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`mtg.wtf returned ${res.status}`);
  return res.text();
}

try {
  const bundle = parseRules(await loadHtml());

  // Version stamp missing (site layout change) → abort. Never merge a bundle
  // whose rules version we can't name.
  if (bundle.version === "unknown") {
    throw new Error("rules version stamp not found — aborting refresh");
  }

  let existing = null;
  try {
    existing = JSON.parse(await readFile(BUNDLE_PATH, "utf8"));
  } catch {
    /* first run — no bundle yet */
  }

  if (existing && existing.hash === bundle.hash) {
    console.log("unchanged");
    process.exit(0);
  }

  await writeFile(BUNDLE_PATH, JSON.stringify(bundle) + "\n");
  console.log(`${existing?.version ?? "(none)"} -> ${bundle.version} (${bundle.rules.length} rules)`);
} catch (err) {
  console.error(`rules:refresh failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}