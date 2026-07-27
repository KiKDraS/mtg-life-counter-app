import type { Metadata } from "next";
import { PlayerZone } from "@/features/life-counter/components/PlayerZone";
import { PlayerColor } from "@/features/life-counter/types/player";

export const metadata: Metadata = {
  title: "MTG Life Counter",
  description:
    "Magic: The Gathering life counter — track life totals for Commander and other formats",
};

export default function Home() {
  const players = [
    {
      color: "u",
      opponentColor: "r",
      initialLife: 40,
      rotation: 180,
    },
    {
      color: "r",
      opponentColor: "u",
      initialLife: 40,
      rotation: 0,
    },
  ];

  return (
    <main className="flex h-dvh flex-col">
      {players.map((player, i) => {
        const playerId = i as 0 | 1 | 2 | 3 | 4 | 5;

        return (
          <div className="flex-1" key={playerId}>
            <PlayerZone
              playerId={playerId}
              color={player.color as PlayerColor}
              opponentColor={player.opponentColor as PlayerColor}
              rotation={player.rotation as 0 | 90 | -90 | 180}
              initialLife={player.initialLife}
            />
          </div>
        );
      })}
    </main>
  );
}
