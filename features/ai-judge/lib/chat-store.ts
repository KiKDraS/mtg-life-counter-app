import {
  idbDelete,
  idbGet,
  idbGetAllKeys,
  idbPut,
  STORE_CHAT,
  type ChatEntry,
} from "@/features/persistence/idb";

/* §9.9 — chat history survives modal close + page reload, keyed per game
   version (features/game-shell GameState.version). */
const CHAT_KEY_PREFIX = "chat-v" as const;
/** Newest N game versions kept in the store; older entries pruned. */
const CHAT_KEEP = 5 as const;

function chatKey(version: number): `chat-v${number}` {
  return `${CHAT_KEY_PREFIX}${version}`;
}

function parseChatVersion(key: string): number | null {
  if (!key.startsWith(CHAT_KEY_PREFIX)) return null;
  const version = Number(key.slice(CHAT_KEY_PREFIX.length));
  return Number.isInteger(version) ? version : null;
}

/**
 * @description Loads the persisted chat for a game version. Resolves `null`
 *   when absent or when IndexedDB is unavailable (blocked/private mode).
 * @param version — game version counter (bumped on restart/setup changes,
 *   not on color change).
 * @returns the persisted {@link ChatEntry}, or `null`.
 * @see SPEC.md §9.9 — history contract (rewritten by orchestrator)
 */
export async function loadChat(version: number): Promise<ChatEntry | null> {
  try {
    return (await idbGet<ChatEntry>(STORE_CHAT, chatKey(version))) ?? null;
  } catch {
    return null; // IDB blocked/private mode → start empty, app stays usable.
  }
}

/**
 * @description Persists a chat entry under `chat-v${version}`. Best-effort:
 *   silent no-op when IndexedDB is unavailable.
 * @param entry — full chat snapshot (version + session + messages).
 * @returns void.
 */
export async function saveChat(entry: ChatEntry): Promise<void> {
  try {
    await idbPut(STORE_CHAT, chatKey(entry.version), entry);
  } catch {
    /* blocked/private IDB — persistence is best-effort. */
  }
}

/**
 * @description Deletes chat entries beyond the `keep` newest game versions.
 *   Best-effort: silent no-op when IndexedDB is unavailable. Call after save.
 * @param keep — number of newest versions to retain (default 5).
 * @returns void.
 */
export async function pruneChats(keep: number = CHAT_KEEP): Promise<void> {
  try {
    const keys = await idbGetAllKeys(STORE_CHAT);
    const staleVersions = keys
      .map((key) => parseChatVersion(key))
      .filter((version): version is number => version !== null)
      .sort((a, b) => b - a)
      .slice(keep);

    await Promise.all(
      staleVersions.map((version) => idbDelete(STORE_CHAT, chatKey(version))),
    );
  } catch {
    /* blocked/private IDB — pruning is best-effort. */
  }
}
