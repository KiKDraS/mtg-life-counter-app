import type { Metadata } from "next";
import { PlayerZone } from "@/components/game/player-zone";
import ManaSelector from "@/components/ui/icons/ManaSelector";
import GuildSelector from "@/components/ui/icons/GuildSelector";
import ClanSelector from "@/components/ui/icons/ClanSelector";
import ShardSelector from "@/components/ui/icons/ShardSelector";
import CounterSelector from "@/components/ui/icons/CounterSelector";

export const metadata: Metadata = {
  title: "MTG Life Counter",
  description:
    "Magic: The Gathering life counter — track life totals for Commander and other formats",
};

export default function Home() {
  return (
    <main className="flex h-dvh flex-col">
      <div className="flex-1">
        <PlayerZone
          playerNumber={1}
          color="u"
          rotation={180}
          initialLife={40}
        />
      </div>
      <div className="flex gap-1">
        <CounterSelector counter="energy" />
      </div>
      <div className="flex-1">
        <PlayerZone playerNumber={2} color="r" initialLife={40} />
      </div>
    </main>
  );
}
