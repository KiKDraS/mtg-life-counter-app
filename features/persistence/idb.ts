import type { ManaColor } from "@/shared/lib/constants/colors";
import type { PlayerId } from "@/features/player-zone/types/player";
import type { PlayerState } from "@/features/player-zone/state/types";

// ============================================================================
// CONFIGURATION & TYPES
// ============================================================================

const DB_NAME = "mtg-life-counter";
/* v2 — added `ai-judge-chat` store. Existing stores untouched in upgrade
   (createObjectStore guarded by contains) → no data loss. */
const DB_VERSION = 2;

export const STORE_INIT = "game-init";
export const STORE_STATE = "game-state";
export const STORE_CHAT = "ai-judge-chat";

export type StoreName =
  | typeof STORE_INIT
  | typeof STORE_STATE
  | typeof STORE_CHAT;
export type StoreKey = "init" | "state" | `chat-v${number}`;

/* §5 — Store 1: persisted initial values (written by setup actions) */
export interface GameInit {
  readonly players: number; // 2-6
  readonly initialLife: number; // 20|30|40|60|custom
  readonly playerColors: Record<PlayerId, ManaColor[]>;
}

/* §5 — Store 2: persisted current per-player values */
export interface GameStateRecord {
  readonly playerStates: PlayerState[];
}

/* §9.9 — Store 3: one persisted chat bubble. Shape mirrors the in-memory
   ChatMessage in features/ai-judge/hooks/use-judge-chat.ts. */
export interface ChatMessageRecord {
  readonly role: "system" | "user";
  readonly content: string;
}

/* §9.9 — Store 3: persisted AI Judge chat, keyed `chat-v${version}`.
   Keyed by game version so a restarted game starts with fresh history. */
export interface ChatEntry {
  readonly version: number;
  readonly sessionId: string;
  readonly updatedAt: number;
  readonly messages: ChatMessageRecord[];
}

// ============================================================================
// DATABASE CONNECTION (Singleton)
// ============================================================================

/* ponytail: single cached open — one connection for the app lifetime. */
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise !== null) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_INIT))
        db.createObjectStore(STORE_INIT);
      if (!db.objectStoreNames.contains(STORE_STATE))
        db.createObjectStore(STORE_STATE);
      if (!db.objectStoreNames.contains(STORE_CHAT))
        db.createObjectStore(STORE_CHAT);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Reads a record by explicit string key. Resolves `undefined` when absent.
 */
export async function idbGet<T>(
  storeName: StoreName,
  key: StoreKey,
): Promise<T | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);

    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Writes a record under an explicit string key.
 */
export async function idbPut(
  storeName: StoreName,
  key: StoreKey,
  value: unknown,
): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");

    transaction.objectStore(storeName).put(value, key);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Reads every key in a store. Used for pruning (e.g. old chat versions).
 */
export async function idbGetAllKeys(
  storeName: StoreName,
): Promise<StoreKey[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAllKeys();

    request.onsuccess = () => resolve(request.result as StoreKey[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Deletes a record by explicit string key.
 */
export async function idbDelete(
  storeName: StoreName,
  key: StoreKey,
): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");

    transaction.objectStore(storeName).delete(key);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
