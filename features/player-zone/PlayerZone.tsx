import { PlayerZoneInteractive } from "./components/PlayerZoneInteractive";
import { ColorPicker } from "@/features/player-zone/components/color-picker/ColorPicker";
import { LifeNumpad } from "@/features/player-zone/components/life-numpad/LifeNumpad";
import { CommanderDamage } from "@/features/player-zone/components/commander-damage/CommanderDamage";
import { Counters } from "@/features/player-zone/components/counters/Counters";
import { usePlayerStateContext } from "./state/player-state-context";

/**
 * §4.2 Player Zone — RSC shell.
 *
 * Generates unique dialog IDs per player and renders:
 * - {@link PlayerZoneInteractive} — the interactive zone grid with swipe
 * - Modal shells — structural dialog wrappers, each renders its own client leaves
 *
 * Rotation is applied inside PlayerZoneInteractive (§4.3) so the interior
 * layout is identical for every orientation.
 *
 * @see DESIGN.md §4 — Player Zone
 */
export function PlayerZone() {
  const {
    state: { playerId },
  } = usePlayerStateContext();

  const ids = {
    colorPicker: `color-picker-${playerId}`,
    numpad: `numpad-${playerId}`,
    commanderDmg: `commander-dmg-${playerId}`,
    counters: `counters-${playerId}`,
  };

  return (
    <PlayerZoneInteractive ids={ids}>
      {/* Modal shells — passed as children so they render inside the zone div.
            RSC shells wrap client DialogShell (Donut Hole pattern). */}
      <ColorPicker id={ids.colorPicker} />
      <LifeNumpad id={ids.numpad} />
      <CommanderDamage id={ids.commanderDmg} />
      <Counters id={ids.counters} />
    </PlayerZoneInteractive>
  );
}
