import { Card, Rank, Suit } from '@rummy/shared-types';
import { JokerManager } from './JokerManager';

export interface SetValidationResult {
  isValid: boolean;
  rank?: Rank;
  reason?: string;
}

export class SetValidator {
  /**
   * Validates if a group of cards forms a valid Set.
   * Requirements:
   * - Exactly 3 or 4 cards.
   * - All natural cards must have the exact same rank.
   * - All natural cards must have distinct suits (no duplicate suits, even from different decks).
   * - Jokers (printed or wild) can substitute for missing cards.
   * - A set of 3 or 4 jokers is also valid.
   */
  public static isValidSet(cards: Card[], wildJokerCard: Card | null): boolean {
    if (!cards || cards.length < 3 || cards.length > 4) {
      return false;
    }

    const naturals: Card[] = [];
    const jokers: Card[] = [];

    for (const card of cards) {
      if (JokerManager.isJoker(card, wildJokerCard)) {
        jokers.push(card);
      } else {
        naturals.push(card);
      }
    }

    // If all cards are jokers (3 or 4 jokers), valid set
    if (naturals.length === 0) {
      return true;
    }

    // All natural cards must have the identical rank
    const targetRank = naturals[0].rank;
    if (naturals.some((c) => c.rank !== targetRank)) {
      return false;
    }

    // All natural cards must have distinct suits
    const seenSuits = new Set<Suit>();
    for (const card of naturals) {
      if (seenSuits.has(card.suit)) {
        // Duplicate suit found (e.g. two 7 of Hearts)
        return false;
      }
      seenSuits.add(card.suit);
    }

    // Number of distinct suits in standard deck is 4.
    // Total cards (naturals + jokers) is already between 3 and 4.
    // Since suits are distinct, and total length <= 4, this is a valid set.
    return true;
  }

  public static validate(cards: Card[], wildJokerCard: Card | null): SetValidationResult {
    if (!cards || cards.length < 3 || cards.length > 4) {
      return { isValid: false, reason: 'Set must contain exactly 3 or 4 cards' };
    }

    if (this.isValidSet(cards, wildJokerCard)) {
      const natural = cards.find((c) => !JokerManager.isJoker(c, wildJokerCard));
      return { isValid: true, rank: natural ? natural.rank : undefined };
    }

    return { isValid: false, reason: 'Invalid set composition' };
  }
}
