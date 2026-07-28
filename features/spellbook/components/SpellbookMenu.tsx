"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { UI } from "@/shared/lib/constants/colors";
import RestartGame from "@/shared/components/icons/player-actions/RestartGame";
import LifeSettings from "@/shared/components/icons/player-actions/LifeSettings";
import CallJudge from "@/shared/components/icons/player-actions/CallJudge";
import SelectPlayers from "@/shared/components/icons/player-actions/SelectPlayers";
import mtgLogo from "@/features/spellbook/images/mtg-logo.png";

/**
 * §5 — Central Spellbook Menu.
 *
 * Collapsed: thin rope line + 56×56 M logo at screen center.
 * Expanded: black belt (~72px) with 4 action icons.
 * Tap M or outside to toggle.
 */
export function SpellbookMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open]);

  return (
    <div
      ref={menuRef}
      className="relative z-50 flex items-center justify-center"
    >
      {/* Rope line — always visible, edge-to-edge */}
      <div
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
        style={{ backgroundColor: UI.iconDark, opacity: 0.3 }}
      />

      {/* Belt — expands from center */}
      <div
        className="relative flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          backgroundColor: UI.belt,
          height: open ? 72 : 0,
          width: open ? "100%" : 0,
          opacity: open ? 1 : 0,
        }}
      >
        {/* Icons — spread when open */}
        <div className="flex w-full items-center justify-between px-6">
          {/* Left side: ⚙️ Initial Life (far), ⟳ Restart (near) */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              aria-label="Initial Life"
              className="flex size-12 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <LifeSettings size={28} />
            </button>
            <button
              type="button"
              aria-label="Restart Life"
              className="flex size-12 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <RestartGame size={28} />
            </button>
          </div>

          {/* Center: M logo placeholder (belt space) */}
          <div className="size-14" />

          {/* Right side: ⚖️ AI Judge (near), 👥 Players (far) */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              aria-label="AI Judge"
              className="flex size-12 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <CallJudge size={28} />
            </button>
            <button
              type="button"
              aria-label="Players"
              className="flex size-12 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <SelectPlayers size={28} />
            </button>
          </div>
        </div>
      </div>

      {/* M logo — always centered, sits on top of rope/belt */}
      <button
        type="button"
        aria-label="Spellbook Menu"
        className="absolute z-10 flex size-14 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        onClick={toggle}
      >
        <Image
          src={mtgLogo}
          alt="MTG"
          width={56}
          height={56}
          className="drop-shadow-lg"
          priority
        />
      </button>
    </div>
  );
}
