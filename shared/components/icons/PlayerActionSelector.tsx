import type { SVGAttributes } from "react";
import type { PlayerAction } from "@/shared/lib/constants/actions";
import LifeSettings from "./player-actions/LifeSettings";
import SelectPlayers from "./player-actions/SelectPlayers";
import RestartGame from "./player-actions/RestartGame";
import CallJudge from "./player-actions/CallJudge";
import ColorSettings from "./player-actions/Settings";

type PlayerActionSelectorProps = {
  action: PlayerAction;
  size?: number;
  className?: string;
} & SVGAttributes<SVGSVGElement>;

const ACTION_ICONS: Record<PlayerAction, React.ElementType> = {
  lifeSettings: LifeSettings,
  selectPlayers: SelectPlayers,
  restartGame: RestartGame,
  callJudge: CallJudge,
  colorSettings: ColorSettings,
};

function PlayerActionSelector({ action, ...props }: PlayerActionSelectorProps) {
  const Icon = ACTION_ICONS[action];
  return <Icon {...props} />;
}

export default PlayerActionSelector;
