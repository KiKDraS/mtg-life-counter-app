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

## 4. Persistence (IndexDB)

- **Save:** Every state change (life, counters, commander damage, players,
  colors) → persist.
- **Load:** Read IndexDB:
  - Found → restore saved state.
  - Not found → use §2 defaults.
- **Storage:** Single record. Device-local. No accounts. No cloud sync.

---

## 5. Data Model

```typescript
import type { PlayerId, PlayerColor } from "@/features/player-zone/types/player";

interface CommanderDamage {
  playerId: PlayerId;  // commander owner's identity
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
  color: PlayerColor;
  counters: Counter[];
  commanderDamage: CommanderDamage[];
}

interface GameState {
  players: number;
  playerStates: PlayerState[];
  playerColors: Record<PlayerId, PlayerColor>;
}
```

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

## 8. Roadmap

| Feature                         | Phase |
| ------------------------------- | ----- |
| Guild color combos (10 2-color) | 2     |
| AI Judge voice input            | 2     |
| Card art BGs from Scryfall      | 2     |
| Offline AI rules engine         | 3     |
