import {
  DECREMENT_LIFE,
  INCREMENT_LIFE,
} from "../../player-zone/constants/life";

export type LifeSign = typeof INCREMENT_LIFE | typeof DECREMENT_LIFE;
