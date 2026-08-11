# SPEC.md — Application Logic Contract

**Status:** Active Contract — All agents MUST comply

> Scope: application behavior, data model, persistence, player identity rules.
> For visual/interaction design see DESIGN.md. For agent workflow see AGENTS.md.

---

## 1. RSC Rules

- **RSC default:** app/ + layouts/grids = RSC.
- **Client leaf only:** 'use client' on leaf interactive nodes only.
  Root/grid/page client banned.
- **IndexedDB SSR sync**: SSR renders §3 defaults. Client hydrator loads
  IndexedDB post-mount. No render blocking.
- **Client ban:** No node/server libs, no async components, no 'use server'
  inside 'use client'.

---

## 2. Player Identity

- No names — color + position only identifier (matches DESIGN.md §1.3).
- `playerId: number` = array index in `playerStates[]` (0 = Player 1).
- Stable identity for cross-references (commander damage tracking, AI Judge
  context §9).

---

## 3. Default State (First Load)

When app launches with no saved IndexDB state:

| Key              | Value   | Notes                                      |
| ---------------- | ------- | ------------------------------------------ |
| Players          | 2       | Layout per DESIGN.md §4.1                  |
| Player colors    | R (Red) | Per DESIGN.md §2.1                         |
| Life             | 40      | Commander default                          |
| Counters         | 0       | All four: poison, energy, experience, time |
| Commander damage | 0       | Per commander per player                   |

---

## 4. Persistence (IndexedDB)

Two stores — separate initial values from live state.

### 4.1 Store 1: `game-init` — Initial Values

| Field      | Type                                            | Notes            |
| ---------- | ----------------------------------------------- | ---------------- |
| Key        | `"init"`                                        | Singleton record |
| Schema     | `GameInit` (§5)                                 |                  |
| Written on | Player count, initial life, player color change |                  |
| Read on    | App start → bootstrap settings                  |                  |

### 4.2 Store 2: `game-state` — Current State

| Field      | Type                                         | Notes            |
| ---------- | -------------------------------------------- | ---------------- |
| Key        | `"state"`                                    | Singleton record |
| Schema     | `GameStateRecord` (§5)                       |                  |
| Written on | Every life, counter, commander damage change |                  |
| Read on    | App start → restore live values              |                  |

### 4.3 Load Priority

1. Read `game-init` → if found, bootstrap settings.
2. Read `game-state` → if found, restore live values.
3. Neither found → use §3 defaults.

### 4.4 SSR Sync

- SSR renders §3 defaults exclusively.
- Client hydrator reads both stores post-mount via effect.
- No render blocking — defaults active until hydration.
- Device-local. No accounts. No cloud sync.

---

## 5. Data Model

```typescript
import type { PlayerId } from "@/features/player-zone/types/player";
import type { ManaColor } from "@/shared/lib/constants/colors";

// Store 1 — persisted initial values (written by setup actions)
interface GameInit {
  players: number; // 2-6
  initialLife: number; // 20|30|40|60|custom
  playerColors: Record<PlayerId, ManaColor[]>; // multi-select (§6.5)
}

// Store 2 — persisted current per-player values
interface GameStateRecord {
  playerStates: PlayerState[];
}

interface CommanderDamage {
  playerId: PlayerId; // commander owner's identity
  value: number;
}

interface Counter {
  id: string;
  type: "poison" | "energy" | "experience" | "time" | "custom";
  value: number;
  name?: string;
}

interface PlayerState {
  playerId: PlayerId;
  life: number;
  color: ManaColor[]; // multi-select (§6.5)
  counters: Counter[];
  commanderDamage: CommanderDamage[];
}
```

**Invariants:**

- `commanderDamage` array length ALWAYS equals current player count. Never
  empty. Reset sets all values to 0.
- `counters` array NEVER empty. Reset sets defaults
  (poison/energy/experience/time) to 0. Custom counters cleared on reset.

---

## 6. Commander Damage Rules

- Track damage from EVERY commander in play (own + opponents).
- `CommanderDamage.playerId` = commander owner's identity.
- ≥21 damage from any single commander → lethal.
- Each damage point also −1 life: `adjustCommanderDamage(+3)` → life −3.

---

## 7. Custom Counters

- Added via [+] on Counters overlay → Custom Counter Name modal (DESIGN.md
  §6.6).
- Display: rounded pill `#CAC5C0`, `iconDark` first-letter silhouette (DESIGN.md
  §7.4).
- Persisted in `counters[]` with `type: "custom"`, `name` set.

---

## 8. Menu Actions

### 8.1 Common Reset Behavior

⟳ Restart, ⚙️ Set Initial Life, and 👥 Player Selector all trigger a common
reset:

- Every player life = `game-init.initialLife`
- Every player counters = `DEFAULT_COUNTERS` (poison 0, energy 0, experience 0,
  time 0)
- Every player commanderDamage rebuilt:
  `Array.from({length: playerCount}, (_, i) => ({playerId: i, value: 0}))`
- Player colors UNCHANGED. `game-init.playerColors` UNCHANGED.
- Custom counters (user-added) cleared.

### 8.2 ⟳ Restart Life

| Property      | Value                                       |
| ------------- | ------------------------------------------- |
| Trigger       | Tap ⟳ in spellbook belt                     |
| Modal         | No — instant                                |
| Action        | §8.1 common reset using current `game-init` |
| Updates init? | No — reads only                             |
| Persist       | Write `game-state`                          |

### 8.3 ⚙️ Set Initial Life

| Property      | Value                                           |
| ------------- | ----------------------------------------------- |
| Trigger       | Tap ⚙️ in spellbook belt                        |
| Modal         | Yes — DESIGN.md §6.2 (2-col grid)               |
| Action        | 1. Set `game-init.initialLife` = selected value |
|               | 2. §8.1 common reset with new initialLife       |
| Updates init? | Yes — `initialLife`                             |
| Persist       | Write `game-init` + `game-state`                |

Edge cases:

- Custom numpad: any positive integer. No upper bound validation.
- Same value as current: still performs reset.

### 8.4 👥 Player Selector

| Property      | Value                                   |
| ------------- | --------------------------------------- |
| Trigger       | Tap 👥 in spellbook belt                |
| Modal         | Yes — DESIGN.md §6.3 (SVG layout cells) |
| Updates init? | Yes — `players`                         |
| Persist       | Write `game-init` + `game-state`        |

#### 8.4.1 Count UP (e.g. 2→4)

1. Existing players: §8.1 common reset with new player count.
2. New players appended with:
   - `playerId` = next index
   - `life` = `game-init.initialLife`
   - `color` = `DEFAULT_PLAYER_COLOR`
   - `counters` = `DEFAULT_COUNTERS`
   - `commanderDamage` = one entry per player (all 0)
3. `game-init.players` = new count
4. `game-init.playerColors` extended with `DEFAULT_PLAYER_COLOR` for each new
   player.

#### 8.4.2 Count DOWN (e.g. 4→2)

1. Existing players: §8.1 common reset with new player count.
2. Last N player states removed from array + `game-init.playerColors`.
3. `game-init.players` = new count.

#### 8.4.3 Edge Cases

| Scenario                           | Behavior                                        |
| ---------------------------------- | ----------------------------------------------- |
| Same count selected                | Still performs reset                            |
| Custom counters on removed players | Lost — no recovery                              |
| Removed player's commander damage  | All remaining players' CD rebuilt for new count |

### 8.5 Color Selection

| Property          | Value                                     |
| ----------------- | ----------------------------------------- |
| Trigger           | Gear icon on player zone — DESIGN.md §6.5 |
| Updates init?     | Yes — `playerColors[playerId]`            |
| Resets game?      | No — color only                           |
| Persists restart? | Yes                                       |

#### 8.5.1 Selection Behavior

WYSIWYG multi-select. Dispatch on every toggle. Zone preview = live state.

| Gesture              | Behavior                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Tap unselected color | Current = default `["r"]` (§3) or single colorless `["c"]`? Replace → `[color]`. Otherwise add → `[...cur, color]`. Dispatch immediately. |
| Tap selected color   | Single-color (length 1)? No-op. Multi-color? Remove → filter out. Dispatch immediately.                                                   |
| Tap Colorless        | Dispatch `setColor(["c"])`. Close immediately.                                                                                            |
| Tap ✓ (CheckCircle)  | Close. No dispatch — colors already applied.                                                                                              |
| Escape / backdrop    | Close. No dispatch — colors already applied.                                                                                              |

**Zone preview:** Real-time. Background reads `PlayerState.color` directly.

**Gradient:** Equal hard stops per selected color, to-bottom-right linear
gradient.

| Selected                  | CSS background                                               |
| ------------------------- | ------------------------------------------------------------ |
| `["w"]`                   | `w(0%,100%)` — solid white                                   |
| `["w","u"]`               | `w(0%,50%), u(50%,100%)`                                     |
| `["w","u","b"]`           | `w(0%,33.3%), u(33.3%,66.6%), b(66.6%,100%)`                 |
| `["w","u","b", "r"]`      | `w(0%,25%), u(25%,50%), b(50%,75%), r(75%, 100%)`            |
| `["w","u","b", "r", "g"]` | `w(0%,20%), u(20%,40%), b(40%,60%), r(60%,80%), g(80%,100%)` |

---

## 9. AI Judge

### 9.1 Scope

- Server-side only. Rules adjudication + card lookup during gameplay.
- Refuses non-MTG questions. No strategy advice — rules clarifications only.
- No accounts. Session-only. No persistence of chats.

### 9.2 Environment Config (server-only)

| Var                           | Role                 | Required | Unset behavior                |
| ----------------------------- | -------------------- | -------- | ----------------------------- |
| `OPEN_ROUTER_API_KEY`         | OpenRouter SDK auth  | yes      | route 503 `misconfigured`     |
| `OPEN_ROUTER_MODEL`           | primary judge model  | yes      | route 503 `misconfigured`     |
| `OPEN_ROUTER_FALLBACK_MODEL`  | fallback judge model | no       | no fallback — primary only    |
| `OPEN_ROUTER_EMBEDDING_MODEL` | semantic retrieval   | no       | lexical retrieval only (§9.4) |

- Validated at route module load. Model format `vendor/model` — else 503
  `misconfigured`.
- **No hardcoded model names in code.** Model set via env only.
- Server-only env. Never client, never `NEXT_PUBLIC_*`, never in repo, never
  logged.

### 9.3 Data Sources → Versioned Artifacts

All external data becomes a **versioned artifact** `{version, hash, data}`.
Caches keyed by version, never by TTL guesswork. Offline stage consumes same
artifacts (§9.11).

#### 9.3.1 Scryfall (cards + rulings)

| Operation | Endpoint                         | Cache            |
| --------- | -------------------------------- | ---------------- |
| Card      | `GET /cards/named?fuzzy={query}` | LRU 500, TTL 24h |
| Rulings   | `GET /cards/{id}/rulings`        | TTL 7d           |

- Canonical card schema = **raw Scryfall card JSON**. Never reshaped.
- Card name extraction: quoted names in question, else fuzzy match on question
  tokens. No match → card path skipped, answer on rules only.
- 404 `not_found` / `ambiguous` → card path skipped, no error.
- ETag / `If-None-Match` → 304 honored, cache refreshed.
- Rate: 10 req/s queue. 429 → backoff 1s / 2s / 4s, max 3 retries → skip path.
- Timeout 5s → card path skipped. Answer proceeds with rules only.
- Rulings shape: `{data: [{source, published_at, comment}]}`.

#### 9.3.2 mtg.wtf (Comprehensive Rules)

- Single fetch: `https://mtg.wtf/help/rules`. Full CR doc, one page.
- Parse (pure fn): HTML → text. Split rules on `^(\d{3})\.(\d+)([a-z])?\.?\s`,
  sections on `^(\d{3})\.\s`. Output: `Map<ruleId, text>`.
- Artifact `version` = rules date stamp from page ("effective as of …").
- Memory cache. Refetch on version change. 24h TTL fallback.
- Fetch fail → **degraded mode**: answer from card rulings only. `done` event
  includes `sourcesUsed: ["scryfall"]`.

### 9.4 Retrieval

Pure TS only — no Node APIs, no `fs`, no `fetch`. Browser-portable unchanged
(offline seam §9.11).

- **Lexical (default):** ruleId regex match (e.g. `702.12` in question) + token
  overlap scoring. top-k = 5.
- **Semantic (opt-in):** `OPENROUTER_EMBEDDING_MODEL` set → embed rules corpus,
  cosine similarity. top-k = 5. Embedding artifact file-cached, keyed by rules
  version. Rebuild only on version change.
- Retrieved rules injected into prompt (§9.7). Both paths share context format.

### 9.5 API Route `/api/judge`

| Property   | Value                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Method     | `POST`                                                                                               |
| Body       | `{question: string, gameContext?: GameContext}`                                                      |
| Validation | `question` string, trimmed, 1–500 chars. Else 400 `bad_request`                                      |
| Response   | SSE — `text/event-stream`, `Cache-Control: no-cache`                                                 |
| Rate limit | 10 req/min/IP, in-memory sliding window. Exceed → 429 `rate_limited`                                 |
| Timeouts   | first token 30s; total 120s → `timeout`                                                              |
| Abort      | `AbortController` tied to `request.signal`. Client disconnect → cancel OpenRouter stream immediately |

SSE events:

```json
{ "type": "token", "content": "When" }
{ "type": "done", "citations": [...], "usage": { "inputTokens": 1200, "outputTokens": 300, "cost": 0.0015 }, "model": "anthropic/claude-sonnet-4", "sourcesUsed": ["mtg.wtf", "scryfall"] }
{ "type": "error", "code": "rate_limited", "message": "The AI Judge is busy. Please wait a moment." }
```

Error codes: `rate_limited`, `model_unavailable`, `misconfigured`, `timeout`,
`bad_request`.

### 9.6 Multi-Model Routing

- Primary = `OPENROUTER_MODEL`. Fallback = `OPENROUTER_FALLBACK_MODEL`.
- Fallback on: HTTP 5xx, timeout, provider error, `model_unavailable`.
- **No fallback on 4xx** (incl. 429) — same failure recurs.
- Both fail → error event `model_unavailable`.
- `done.model` = model actually served. Usage + cost logged per request.

### 9.7 Prompt & Citations

- Persona: "You are an impartial Magic: The Gathering rules judge. Answer only
  based on Comprehensive Rules and Oracle card text."
- RAG context in **user** message, never system:

```
Relevant rules:
---
[CR 702.12a] <text>
---
Player question: {question}
```

- Structured output `{answer, citations[]}`. Few-shot 2–3 Q&A pairs in system
  prompt. Reasoning hidden — final answer only.
- Citation types:
  - rule:
    `{type:"rule", ruleId:"CR 702.12a", section:"702.12. Reanimate", excerpt}`
  - card: `{type:"card", name, source:"scryfall", date, excerpt}`
- Card rulings injected into context as card citations.

### 9.8 Game Context

- `gameContext = {format:"commander", players: [{playerId, life, color[], counters[], commanderDamage[]}]}`.
- Sent only by "Judge this play" chip (§6.4.1 DESIGN.md). Serialized live state
  at send time. Optional on manual questions.

### 9.9 History

- In-memory per session. Max 24k tokens → FIFO prune oldest, keep system prompt
  - last N turns.
- Cleared on modal close. Never written to disk / IndexedDB / localStorage.

### 9.10 UI Contract

- **PWA offline stance (binding):** App = PWA. Life tracking, counters,
  commander damage, persistence (§4) all work fully offline. **AI Judge is the
  ONLY feature that degrades offline** — until local engine (§9.11). Any other
  feature degrading offline = contract violation.
- DESIGN.md §6.4 chat window, §6.4.1 suggestion chips, §6.4.0 offline fallback.
- 503 `misconfigured` → UI disabled state: "AI Judge unavailable", chips hidden.
- Token events render incremental. Typing indicator while streaming.
- Error event → error bubble with message, input re-enabled.
- **Offline fallback (until local engine §9.11):**
  - Detect: `navigator.onLine === false` OR `/api/judge` fetch network failure →
    `offline` UI state.
  - State: input disabled, chips disabled, alert row visible (DESIGN.md §6.4.0
    copy). History read-only.
  - Check: modal open + `online`/`offline` window events. No polling.
  - `online` event → state cleared, input + chips re-enable. No reload.
  - Removed when local engine lands (§9.11).

### 9.11 Offline Transition (Phase 3 — forward contract, NOT implemented now)

Seams only. No interfaces, no DI, no provider layer.

- **Delivery = PWA stack.** App is PWA (manifest + `sw.js` cache-first shell,
  versioned `mtg-life-vN`). Offline artifacts ship through existing channels:
  - **Service worker** caches artifacts (runtime cache add). SW version bump →
    stale artifact cache purged by existing activate cleanup.
  - **IndexedDB** = long-term artifact store — same pattern as §4 persistence.
    No new storage tech.
- **Data:** versioned artifacts only. Cache key = version + hash. Nothing
  assumes fresh fetch.
- **Cards:** raw Scryfall JSON schema. Offline = `default-cards.json` artifact
  cached via SW → IndexedDB, same objects, zero migration.
- **Retrieval:** pure TS (§9.4) — runs in browser unchanged.
- **Shared types:** `features/ai-judge/lib/types.ts` — request, response, SSE
  events, citations, gameContext. Route + client import same module.
- **Client call site:** `features/ai-judge/lib/client.ts` — all UI calls route
  through it. Now: POST `/api/judge` + SSE parse. Later: offline →
  `navigator.onLine` / fetch failure → swap internals to local engine, UI
  untouched.
- **Model config:** plain object built at boot. Now from env (§9.2), later from
  settings. Same schema. Offline = local engine, no OpenRouter — server models
  unreachable by definition.
- **Note:** `/api/judge` stays network-only in SW (no precache). Judge goes
  offline only when local engine exists.

### 9.12 File Map

```
app/api/judge/route.ts            # SSE route, env validation, rate limit
features/ai-judge/lib/types.ts    # shared types (§9.11)
features/ai-judge/lib/client.ts   # single client call site
features/ai-judge/lib/prompts.ts  # persona, few-shot, RAG format
features/ai-judge/lib/citations.ts# citation parse + validate + sanitize
features/ai-judge/lib/history.ts  # in-memory session history
features/ai-judge/lib/rag/        # pure TS: parse, retrieve, score
```

---

## 10. Roadmap

| Feature                                                               | Phase |
| --------------------------------------------------------------------- | ----- |
| Semantic retrieval (`OPENROUTER_EMBEDDING_MODEL`)                     | 2     |
| AI Judge voice input                                                  | 2     |
| Card art BGs from Scryfall                                            | 2     |
| Offline AI rules engine — consumes §9 artifacts + §9.4 pure retrieval | 3     |
