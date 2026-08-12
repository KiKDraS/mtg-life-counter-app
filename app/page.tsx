import type { Metadata } from "next";
import { GameShell } from "@/features/game-shell/GameShell";
import { SpellbookMenu } from "@/features/spellbook/components/SpellbookMenu";

export const metadata: Metadata = {
  title: "MTG Life Counter",
  description:
    "Magic: The Gathering life counter — track life totals for Commander and other formats",
};

export default function Home() {
  return (
    <main className="flex h-dvh flex-col">
      <GameShell>
        <SpellbookMenu />
      </GameShell>
    </main>
  );
}
