/**
 * Player action domain types.
 *
 * All 5 player-actions as a discriminated union.
 */

export type PlayerAction =
  | "lifeSettings"
  | "selectPlayers"
  | "restartGame"
  | "callJudge"
  | "colorSettings";
