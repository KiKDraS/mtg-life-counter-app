import type { SVGAttributes } from "react";
import EnergySymbol from "./counters/EnergySymbol";
import ExperienceSymbol from "./counters/ExperienceSymbol";
import PoisonSymbol from "./counters/PoisonSymbol";
import TimeSymbol from "./counters/TimeSymbol";

export type CounterType =
  | "energy"
  | "experience"
  | "poison"
  | "time";

type CounterSelectorProps = {
  counter: CounterType;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const COUNTER_ICONS: Record<CounterType, React.ElementType> = {
  energy: EnergySymbol,
  experience: ExperienceSymbol,
  poison: PoisonSymbol,
  time: TimeSymbol,
};

function CounterSelector({ counter, ...props }: CounterSelectorProps) {
  const Icon = COUNTER_ICONS[counter];
  return <Icon {...props} />;
}

export default CounterSelector;
