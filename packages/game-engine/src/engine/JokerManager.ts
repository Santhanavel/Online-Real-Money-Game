import { Card, Rank } from '@rummy/shared-types';

export class JokerManager {
  /**
   * Determines the effective wild rank.
   * If the cut card is a printed joker, Aces ('A') become the wild joker rank.
   */
  public static getEffectiveWildRank(wildCard: Card): Rank {
    if (wildCard.isPrintedJoker || wildCard.rank === 'JOKER') {
      return 'A';
    }
    return wildCard.rank;
  }

  /**
   * Checks if a card is a Wild Joker based on the deal's cut card.
   */
  public static isWildJoker(card: Card, wildCard: Card): boolean {
    if (card.isPrintedJoker) return false;
    const effectiveWildRank = this.getEffectiveWildRank(wildCard);
    return card.rank === effectiveWildRank;
  }

  /**
   * Checks if a card is any Joker (Printed Joker OR Wild Joker).
   */
  public static isJoker(card: Card, wildCard?: Card | null): boolean {
    if (card.isPrintedJoker || card.rank === 'JOKER') {
      return true;
    }
    if (wildCard && this.isWildJoker(card, wildCard)) {
      return true;
    }
    return false;
  }
}
