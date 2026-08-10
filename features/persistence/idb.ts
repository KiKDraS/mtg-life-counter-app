import type { ManaColor } from "@/shared/lib/constants/colors";
import type { PlayerId } from "@/features/player-zone/types/player";
import type { PlayerState } from "@/features/player-zone/state/player-state-context";

const DB_NAME = "mtg-life-counter";
const DB_VERSION = 1;

export const STORE_INIT = "game-init";
export const STORE_STATE = "game-state";

/* §5 — Store 1: persisted initial values (written by setup actions) */
export interface GameInit {
  players: number; // 2-6
  initialLife: number; // 20|30|40|60|custom
  playerColors: Record<PlayerId, ManaColor[]>;
}

/* §5 — Store 2: persisted current per-player values */
export interface GameStateRecord {
  playerStates: PlayerState[];
}

/* ponytail: single cached open — one connection for the app lifetime. */
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_INIT)) {
          db.createObjectStore(STORE_INIT);
        }
        if (!db.objectStoreNames.contains(STORE_STATE)) {
          db.createObjectStore(STORE_STATE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

/**
 * Reads a record by explicit string key. Resolves `undefined` when absent.
 * @param store object store name (STORE_INIT | STORE_STATE)
 * @param key explicit key — "init" | "state"
 */
export async function idbGet<T>(
  store: string,
  key: string,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Writes a record under an explicit string key (auto-increment disabled —
 * keys are always supplied).
 * @param store object store name (STORE_INIT | STORE_STATE)
 * @param key explicit key — "init" | "state"
 * @param value record to store
 */
export async function idbPut(
  store: string,
  key: string,
  value: unknown,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(store, "readwrite")
      .objectStore(store)
      .put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
