export type DropClassification = 'FIRST' | 'MIDDLE' | 'TIMEOUT';

export interface DropResult {
  dropType: DropClassification;
  penaltyPoints: number;
}

export class DropManager {
  public static readonly FIRST_DROP_PENALTY = 20;
  public static readonly MIDDLE_DROP_PENALTY = 40;
  public static readonly TIMEOUT_DROP_PENALTY = 80;

  /**
   * Evaluates the drop type and penalty based on whether the player has taken actions.
   * @param turnsPlayed Count of completed turns or draws by this player in current deal.
   * @param hasDrawnInCurrentTurn Whether player drew a card in the current turn before dropping.
   * @param isTimeout Whether this drop was caused by exceeding timeout limit.
   */
  public static evaluateDrop(
    turnsPlayed: number,
    hasDrawnInCurrentTurn: boolean,
    isTimeout: boolean = false
  ): DropResult {
    if (isTimeout) {
      return {
        dropType: 'TIMEOUT',
        penaltyPoints: this.TIMEOUT_DROP_PENALTY,
      };
    }

    // If the player has played 0 turns and hasn't drawn in this turn, it's a FIRST drop.
    if (turnsPlayed === 0 && !hasDrawnInCurrentTurn) {
      return {
        dropType: 'FIRST',
        penaltyPoints: this.FIRST_DROP_PENALTY,
      };
    }

    // Otherwise, it is a MIDDLE drop.
    return {
      dropType: 'MIDDLE',
      penaltyPoints: this.MIDDLE_DROP_PENALTY,
    };
  }
}
