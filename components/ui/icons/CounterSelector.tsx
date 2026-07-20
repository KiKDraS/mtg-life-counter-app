import type { SVGAttributes } from "react";
import PlaneswalkerSymbol from "./counters/PlaneswalkerSymbol";
import EnergySymbol from "./counters/EnergySymbol";
import PoisonSymbol from "./counters/PoisonSymbol";
import ExperienceSymbol from "./counters/ExperienceSymbol";
import TimeSymbol from "./counters/TimeSymbol";

export type CounterType =
  | "planeswalker"
  | "energy"
  | "poison"
  | "experience"
  | "time";

type CounterSelectorProps = {
  counter: CounterType;
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const COUNTER_ICONS: Record<CounterType, React.ElementType> = {
  planeswalker: PlaneswalkerSymbol,
  energy: EnergySymbol,
  poison: PoisonSymbol,
  experience: ExperienceSymbol,
  time: TimeSymbol,
};

function CounterSelector({ counter, ...props }: CounterSelectorProps) {
  const Icon = COUNTER_ICONS[counter];
  return <Icon {...props} />;
}

export default CounterSelector;
