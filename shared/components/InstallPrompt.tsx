"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { MANA } from "@/shared/lib/constants/colors";
import { textColorFor } from "@/shared/lib/text-color-for";

/**
 * Minimal shape of the Chromium `beforeinstallprompt` event — not in the TS
 * lib DOM types. Only the members we use are declared.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const DISMISSED_KEY = "install-prompt-dismissed";

/** iOS Safari hint — the event never fires there, show Share-sheet copy. */
const IOS_HINT_COPY = "Install: Share → Add to Home Screen";

type PromptState =
  | { kind: "hidden" }
  | { kind: "iosHint" }
  | { kind: "chromium"; deferred: BeforeInstallPromptEvent };

/*
 * The install API lives outside React (browser event + sessionStorage), so the
 * banner state is an external store bridged via useSyncExternalStore. That
 * keeps the standalone gate off the server render (getServerSnapshot → hidden,
 * no hydration mismatch) and avoids sync setState-in-effect.
 */
let promptState: PromptState = { kind: "hidden" };
let deferredEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PromptState {
  return promptState;
}

const HIDDEN: PromptState = { kind: "hidden" };

function getServerSnapshot(): PromptState {
  return HIDDEN;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean(navigator.standalone))
  );
}

function isIOS(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent);
}

/**
 * @description
 * PWA install banner (§4.5). Fixed bottom-center card above the spellbook
 * belt, below native top-layer dialogs (any z-index stays under the top
 * layer). Chromium: stashes `beforeinstallprompt`, prompts on button click.
 * iOS Safari: hint copy only, no button. Never renders when already
 * standalone or after session dismiss.
 *
 * @see DESIGN.md §4.5
 * @see SPEC.md §4.7
 */
export function InstallPrompt() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Fresh mount: drop any stale deferred event from a previous mount.
    deferredEvent = null;
    promptState = HIDDEN;
    emit();

    if (isStandalone()) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS()) {
      promptState = { kind: "iosHint" };
      emit();
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      if (sessionStorage.getItem(DISMISSED_KEY)) return;
      event.preventDefault();
      deferredEvent = event as BeforeInstallPromptEvent;
      promptState = { kind: "chromium", deferred: deferredEvent };
      emit();
    };

    const onAppInstalled = () => {
      deferredEvent = null;
      promptState = HIDDEN;
      emit();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (state.kind !== "chromium") return;
    await state.deferred.prompt();
    await state.deferred.userChoice;
    promptState = HIDDEN;
    emit();
  }, [state]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    promptState = HIDDEN;
    emit();
  }, []);

  if (state.kind === "hidden") return null;

  return (
    <div
      role="region"
      aria-label="Install app"
      data-testid="install-prompt"
      className="fixed inset-x-0 bottom-4 z-[60] mx-auto w-[min(90vw,24rem)]"
    >
      <div className="relative border border-mana-g bg-[#292A2A] p-4 text-ui-textLight">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-1 top-1 flex size-11 items-center justify-center text-ui-textLight"
        >
          ✕
        </button>
        <p className="pr-8 text-body-sm">
          {state.kind === "iosHint"
            ? IOS_HINT_COPY
            : "Install MTG Life Counter"}
        </p>
        {state.kind === "chromium" && (
          <button
            type="button"
            onClick={handleInstall}
            className="mt-3 px-4 py-3 text-body font-medium"
            style={{
              backgroundColor: MANA.g,
              color: textColorFor([MANA.g]),
            }}
          >
            Install App
          </button>
        )}
      </div>
    </div>
  );
}
