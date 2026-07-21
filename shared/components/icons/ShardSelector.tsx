import type { SVGAttributes } from "react";
import type { Shard } from "@/shared/lib/constants/shards";
import BantSymbol from "./shards/BantSymbol";
import EsperSymbol from "./shards/EsperSymbol";
import GrixisSymbol from "./shards/GrixisSymbol";
import JundSymbol from "./shards/JundSymbol";
import NayaSymbol from "./shards/NayaSymbol";

type ShardSelectorProps = {
  shard: Shard;
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const SHARD_ICONS: Record<Shard, React.ElementType> = {
  bant: BantSymbol,
  esper: EsperSymbol,
  grixis: GrixisSymbol,
  jund: JundSymbol,
  naya: NayaSymbol,
};

function ShardSelector({ shard, ...props }: ShardSelectorProps) {
  const Icon = SHARD_ICONS[shard];
  return <Icon {...props} />;
}

export default ShardSelector;
