import type { SVGAttributes } from "react";
import type { Guild } from "@/shared/lib/constants/guilds";
import AzoriusSymbol from "./guilds/AzoriusSymbol";
import BorosSymbol from "./guilds/BorosSymbol";
import DimirSymbol from "./guilds/DimirSymbol";
import GolgariSymbol from "./guilds/GolgariSymbol";
import GruulSymbol from "./guilds/GruulSymbol";
import IzzetSymbol from "./guilds/IzzetSymbol";
import OrzhovSymbol from "./guilds/OrzhovSymbol";
import RakdosSymbol from "./guilds/RakdosSymbol";
import SelesnyaSymbol from "./guilds/SelesnyaSymbol";
import SimicSymbol from "./guilds/SimicSymbol";

type GuildSelectorProps = {
  guild: Guild;
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const GUILD_ICONS: Record<Guild, React.ElementType> = {
  azorius: AzoriusSymbol,
  boros: BorosSymbol,
  dimir: DimirSymbol,
  golgari: GolgariSymbol,
  gruul: GruulSymbol,
  izzet: IzzetSymbol,
  orzhov: OrzhovSymbol,
  rakdos: RakdosSymbol,
  selesnya: SelesnyaSymbol,
  simic: SimicSymbol,
};

function GuildSelector({ guild, ...props }: GuildSelectorProps) {
  const Icon = GUILD_ICONS[guild];
  return <Icon {...props} />;
}

export default GuildSelector;
