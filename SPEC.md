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
- Stable identity for cross-references (commander damage tracking, future AI
  context).

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

| Gesture              | Behavior                                                             |
| -------------------- | -------------------------------------------------------------------- |
| Tap unselected color | Single-color? Replace. Multi-color? Add. Dispatch immediately.       |
| Tap selected color   | Single-color? No-op. Multi-color? Remove. Dispatch immediately.         |
| Tap Colorless        | Dispatch `setColor(["c"])`. Close immediately.                       |
| Tap ✓ (CheckCircle)  | Close. No dispatch — colors already applied.                         |
| Escape / backdrop    | Close. No dispatch — colors already applied.                         |

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

## 9. Roadmap

| Feature                         | Phase |
| ------------------------------- | ----- |
| Guild color combos (10 2-color) | 2     |
| AI Judge voice input            | 2     |
| Card art BGs from Scryfall      | 2     |
| Offline AI rules engine         | 3     |
