import type { Metadata } from "next";
import { PlayerProvider } from "@/features/life-counter/state/player-state-context";
import { PlayerZone } from "@/features/life-counter/components/PlayerZone";
import { SpellbookMenu } from "@/features/spellbook/components/SpellbookMenu";

export const metadata: Metadata = {
  title: "MTG Life Counter",
  description:
    "Magic: The Gathering life counter — track life totals for Commander and other formats",
};

export default function Home() {
  const players = [
    {
      opponentColor: "r" as const,
      rotation: 180 as const,
    },
    {
      opponentColor: "u" as const,
      rotation: 0 as const,
    },
  ];

  const mid = Math.ceil(players.length / 2);
  const topPlayers = players.slice(0, mid);
  const bottomPlayers = players.slice(mid);

  return (
    <main className="flex h-dvh flex-col">
      {/* Top player zones */}
      {topPlayers.map((player, i) => {
        const playerId = i as 0 | 1 | 2 | 3 | 4 | 5;

        return (
          <div className="flex-1" key={playerId}>
            <PlayerProvider>
              <PlayerZone
                playerId={playerId}
                opponentColor={player.opponentColor}
                rotation={player.rotation}
              />
            </PlayerProvider>
          </div>
        );
      })}

      {/* §5 — Spellbook belt divider */}
      <SpellbookMenu />

      {/* Bottom player zones */}
      {bottomPlayers.map((player, i) => {
        const playerId = (mid + i) as 0 | 1 | 2 | 3 | 4 | 5;

        return (
          <div className="flex-1" key={playerId}>
            <PlayerProvider>
              <PlayerZone
                playerId={playerId}
                opponentColor={player.opponentColor}
                rotation={player.rotation}
              />
            </PlayerProvider>
          </div>
        );
      })}
    </main>
  );
}
