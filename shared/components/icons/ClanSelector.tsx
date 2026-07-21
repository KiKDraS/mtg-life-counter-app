import type { SVGAttributes } from "react";
import type { Clan } from "@/shared/lib/constants/clans";
import AbzanSymbol from "./clans/AbzanSymbol";
import JeskaiSymbol from "./clans/JeskaiSymbol";
import SultaiSymbol from "./clans/SultaiSymbol";
import MarduSymbol from "./clans/MarduSymbol";
import TemurSymbol from "./clans/TemurSymbol";

type ClanSelectorProps = {
  clan: Clan;
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const CLAN_ICONS: Record<Clan, React.ElementType> = {
  abzan: AbzanSymbol,
  jeskai: JeskaiSymbol,
  sultai: SultaiSymbol,
  mardu: MarduSymbol,
  temur: TemurSymbol,
};

function ClanSelector({ clan, ...props }: ClanSelectorProps) {
  const Icon = CLAN_ICONS[clan];
  return <Icon {...props} />;
}

export default ClanSelector;
