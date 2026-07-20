import type { SVGAttributes } from "react";
import type { ManaColor } from "@/lib/constants/colors";
import WhiteMana from "./mana/WhiteMana";
import BlueMana from "./mana/BlueMana";
import BlackMana from "./mana/BlackMana";
import RedMana from "./mana/RedMana";
import GreenMana from "./mana/GreenMana";
import ColorlessMana from "./mana/ColorlessMana";

type ManaSelectorProps = {
  color: ManaColor;
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const MANA_ICONS: Record<ManaColor, typeof WhiteMana> = {
  w: WhiteMana,
  u: BlueMana,
  b: BlackMana,
  r: RedMana,
  g: GreenMana,
  c: ColorlessMana,
};

function ManaSelector({ color, ...props }: ManaSelectorProps) {
  const Icon = MANA_ICONS[color];
  return <Icon {...props} />;
}

export default ManaSelector;
