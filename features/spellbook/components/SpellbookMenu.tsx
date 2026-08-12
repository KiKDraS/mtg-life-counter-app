import Image from "next/image";
import { cn } from "@/shared/lib/cn";

import RestartGame from "@/shared/components/icons/player-actions/RestartGame";
import LifeSettings from "@/shared/components/icons/player-actions/LifeSettings";
import CallJudge from "@/shared/components/icons/player-actions/CallJudge";
import SelectPlayers from "@/shared/components/icons/player-actions/SelectPlayers";
import BrowserUpdated from "@/shared/components/icons/BrowserUpdated";
import mtgLogo from "@/features/spellbook/images/mtg-logo.png";

import { RestartGameAction } from "./menu-actions/RestartGameAction";
import { SetLifeAction } from "./menu-actions/SetLifeAction";
import { CallJudgeAction } from "./menu-actions/CallJudgeAction";
import { SelectPlayersAction } from "./menu-actions/SelectPlayersAction";
import { InitialLifeModal } from "./modals/initial-life/InitialLifeModal";
import { PlayerSelectorModal } from "./modals/player-selector/PlayerSelectorModal";
import { InstallAppAction } from "./menu-actions/InstallAppAction";
import { JudgeModal } from "@/features/ai-judge/components/JudgeModal";

const BTN_SIZE = "size-7 md:size-10 transition-all cursor-pointer";

const INITIAL_LIFE_MODAL_ID = "initial-life-modal";
const PLAYER_SELECTOR_MODAL_ID = "player-selector-modal";
const AI_JUDGE_MODAL_ID = "ai-judge-modal";

/**
 * @description
 * Structural wrapper for grouping action buttons in the belt.
 * Keeps the main menu JSX DRY and semantic. (Server Component)
 */
function ActionGroup({ children }: { readonly children: React.ReactNode }) {
  return <div className="flex items-center gap-6">{children}</div>;
}

/**
 * @description
 * §5 — Central Spellbook Menu.
 *
 * A CSS-only interactive menu built as a pure React Server Component (RSC).
 * It leverages the HTML "checkbox hack" alongside Tailwind's `peer` utility
 * to manage the open/close state natively. This architectural choice eliminates
 * the need for client-side state (`useState`), prevents re-renders, and ensures
 * the menu works immediately before JavaScript hydration.
 */
export function SpellbookMenu() {
  return (
    <div className="relative z-50 flex items-center justify-center bg-ui-belt pointer-coarse:landscape:hidden">
      {/*
       * 1. State: Hidden checkbox acts as the source of truth.
       * Tailwind's 'peer' class allows sibling elements to react to its 'checked' state.
       */}
      <input
        type="checkbox"
        id="spellbook-toggle"
        className="peer sr-only"
        aria-label="Toggle Spellbook Menu"
      />

      {/*
       * 2. Dismissal: A full-screen, hidden label that becomes active when the menu opens.
       * Clicking anywhere on it unchecks the input, handling the "click outside" behavior without JS.
       */}
      <label
        htmlFor="spellbook-toggle"
        className="fixed inset-0 z-40 hidden cursor-default peer-checked:block"
        aria-label="Close menu"
        aria-hidden="true"
      />

      {/* Rope line background element */}
      <div className="absolute inset-x-0 top-1/2 -z-10 h-1 opacity-90 -translate-y-1/2 bg-ui-iconDark" />

      {/*
       * 3. Belt Container: Expands dynamically when the peer checkbox is checked.
       * Using CSS transitions instead of JS-based animation ensures hardware-accelerated performance.
       */}
      <div
        className={cn(
          "relative z-50 flex h-0 w-0 items-center justify-center overflow-hidden opacity-0 invisible",
          "transition-all duration-300 ease-in-out motion-reduce:transition-none",
          "peer-checked:h-18 peer-checked:w-full peer-checked:opacity-100 peer-checked:visible",
        )}
      >
        <div className="flex w-full items-center justify-between px-6 max-w-130">
          <ActionGroup>
            <div className="pwa:hidden">
              <InstallAppAction>
                <BrowserUpdated className={cn(BTN_SIZE, "animate-pulse")} />
              </InstallAppAction>
            </div>

            <SetLifeAction>
              <LifeSettings className={BTN_SIZE} />
            </SetLifeAction>

            <RestartGameAction>
              <RestartGame className={BTN_SIZE} />
            </RestartGameAction>
          </ActionGroup>

          {/* Center gap reserved for the logo */}
          <div className="size-14" />

          <ActionGroup>
            <CallJudgeAction>
              <CallJudge className={BTN_SIZE} />
            </CallJudgeAction>

            <SelectPlayersAction>
              <SelectPlayers className={BTN_SIZE} />
            </SelectPlayersAction>
          </ActionGroup>
        </div>
      </div>

      {/*
       * 4. Trigger: The central logo acts as the primary label for the checkbox.
       * Clicking it naturally toggles the 'checked' state of the peer input.
       */}
      <label
        htmlFor="spellbook-toggle"
        aria-label="Open Spellbook Menu"
        className={cn(
          "absolute z-50 flex size-14 cursor-pointer items-center justify-center",
          "focus-within:ring-2 focus-within:ring-white",
        )}
      >
        <Image
          src={mtgLogo}
          alt="MTG"
          width={56}
          height={56}
          className="drop-shadow-lg"
          priority
        />
      </label>

      {/* Global modals — rendered in DOM, hidden until triggered via DOM ID */}
      <InitialLifeModal id={INITIAL_LIFE_MODAL_ID} />
      <PlayerSelectorModal id={PLAYER_SELECTOR_MODAL_ID} />
      <JudgeModal id={AI_JUDGE_MODAL_ID} />
    </div>
  );
}
