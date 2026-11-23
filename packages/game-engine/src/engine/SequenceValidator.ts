import { Card, Rank, Suit } from '@rummy/shared-types';
import { JokerManager } from './JokerManager';

export interface SequenceValidationResult {
  isValid: boolean;
  isPure: boolean;
  suit?: Suit;
  reason?: string;
}

export class SequenceValidator {
  /**
   * Numeric rank value for sequence evaluation.
   * A can be 1 (low) or 14 (high).
   */
  private static getRankValue(rank: Rank, aceHigh: boolean = false): number {
    switch (rank) {
      case 'A':
        return aceHigh ? 14 : 1;
      case '2':
        return 2;
      case '3':
        return 3;
      case '4':
        return 4;
      case '5':
        return 5;
      case '6':
        return 6;
      case '7':
        return 7;
      case '8':
        return 8;
      case '9':
        return 9;
      case '10':
        return 10;
      case 'J':
        return 11;
      case 'Q':
        return 12;
      case 'K':
        return 13;
      default:
        return 0;
    }
  }

  /**
   * Validates if a group of cards forms a Pure Sequence.
   * Requirements:
   * - At least 3 cards.
   * - All cards same suit.
   * - Strictly consecutive ranks (Ace low A-2-3 or Ace high Q-K-A; no wrap-around K-A-2).
   * - No printed jokers.
   * - No wild jokers used as substitutes (a wild card used at its natural position is allowed).
   * - No duplicate cards.
   */
  public static isPureSequence(cards: Card[], wildJokerCard?: Card | null): boolean {
    if (!cards || cards.length < 3) return false;

    // Reject printed jokers
    if (cards.some((c) => c.isPrintedJoker || c.rank === 'JOKER')) {
      return false;
    }

    // All must share the same suit
    const suit = cards[0].suit;
    if (suit === 'NONE' || cards.some((c) => c.suit !== suit)) {
      return false;
    }

    // Check for duplicate ranks
    const ranks = cards.map((c) => c.rank);
    const uniqueRanks = new Set(ranks);
    if (uniqueRanks.size !== cards.length) {
      return false; // duplicates present
    }

    // Check consecutive ranks with Ace as Low (1..13)
    const valuesAceLow = cards
      .map((c) => this.getRankValue(c.rank, false))
      .sort((a, b) => a - b);

    if (this.isStrictlyConsecutive(valuesAceLow)) {
      return true;
    }

    // If contains Ace, also check with Ace as High (2..14, e.g. Q-K-A)
    if (cards.some((c) => c.rank === 'A')) {
      const valuesAceHigh = cards
        .map((c) => this.getRankValue(c.rank, true))
        .sort((a, b) => a - b);

      if (this.isStrictlyConsecutive(valuesAceHigh)) {
        return true;
      }
    }

    return false;
  }

  private static isStrictlyConsecutive(sortedValues: number[]): boolean {
    for (let i = 1; i < sortedValues.length; i++) {
      if (sortedValues[i] !== sortedValues[i - 1] + 1) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validates if a group of cards forms an Impure Sequence.
   * Requirements:
   * - At least 3 cards total.
   * - Contains at least one joker (printed or wild) acting as substitute.
   * - All natural cards must share the same suit.
   * - Natural cards must have distinct ranks.
   * - Jokers must bridge the gaps and/or extend either end to form a valid consecutive sequence.
   * - No wrap-around (e.g., K-A-2).
   */
  public static isImpureSequence(cards: Card[], wildJokerCard: Card | null): boolean {
    if (!cards || cards.length < 3) return false;

    // Separate into natural cards and jokers
    // Note: a wild card of the sequence's suit COULD be used naturally or as a joker.
    // We check both possibilities.
    const hasJokers = cards.some((c) => JokerManager.isJoker(c, wildJokerCard));
    if (!hasJokers) {
      // If there are no jokers at all, it cannot be an impure sequence
      return false;
    }

    // Try checking if it forms a sequence using jokers as wild substitutes
    return (
      this.canFormSequenceWithJokers(cards, wildJokerCard, false) ||
      (cards.some((c) => c.rank === 'A') &&
        this.canFormSequenceWithJokers(cards, wildJokerCard, true))
    );
  }

  private static canFormSequenceWithJokers(
    cards: Card[],
    wildJokerCard: Card | null,
    aceHigh: boolean
  ): boolean {
    // If all cards are jokers, min length 3 of any jokers can substitute for a sequence
    const jokers: Card[] = [];
    const naturals: Card[] = [];

    for (const card of cards) {
      if (JokerManager.isJoker(card, wildJokerCard)) {
        jokers.push(card);
      } else {
        naturals.push(card);
      }
    }

    // If no naturals (all cards are jokers, e.g. 3 printed jokers or wild jokers),
    // by standard Rummy rules 3+ jokers can represent a valid impure sequence
    if (naturals.length === 0) {
      return cards.length >= 3;
    }

    // All natural cards must have the exact same suit
    const targetSuit = naturals[0].suit;
    if (targetSuit === 'NONE' || naturals.some((c) => c.suit !== targetSuit)) {
      return false;
    }

    // Check no duplicate natural ranks
    const naturalValues = naturals
      .map((c) => this.getRankValue(c.rank, aceHigh))
      .sort((a, b) => a - b);

    for (let i = 1; i < naturalValues.length; i++) {
      if (naturalValues[i] === naturalValues[i - 1]) {
        return false; // duplicates among natural cards
      }
    }

    // Count missing gaps between min and max natural values
    const minVal = naturalValues[0];
    const maxVal = naturalValues[naturalValues.length - 1];
    const span = maxVal - minVal + 1;
    const missingInSpan = span - naturalValues.length;

    if (jokers.length < missingInSpan) {
      // Not enough jokers to fill internal gaps
      return false;
    }

    // Total sequence length when jokers are used: cards.length
    // The sequence cannot exceed 14 (A high) or fall below 1 (A low)
    // Extra jokers can go before minVal or after maxVal.
    // Check if the total cards could fit in bounds [1, 13] for aceLow or [2, 14] for aceHigh.
    const maxPossibleRange = aceHigh ? [2, 14] : [1, 13];
    // If Ace is high, low is 2 (2..14). If Ace is low, low is 1, high is 13 (1..13).

    // Can we fit cards.length consecutive numbers containing all naturalValues within maxPossibleRange?
    const length = cards.length;
    if (length > 14) return false;

    // Minimum possible start: Math.max(maxPossibleRange[0], maxVal - length + 1)
    // Maximum possible start: Math.min(minVal, maxPossibleRange[1] - length + 1)
    const startMin = Math.max(maxPossibleRange[0], maxVal - length + 1);
    const startMax = Math.min(minVal, maxPossibleRange[1] - length + 1);

    return startMin <= startMax;
  }

  /**
   * General sequence check returning detailed result
   */
  public static validate(
    cards: Card[],
    wildJokerCard: Card | null
  ): SequenceValidationResult {
    if (!cards || cards.length < 3) {
      return { isValid: false, isPure: false, reason: 'Sequence must have at least 3 cards' };
    }

    if (this.isPureSequence(cards, wildJokerCard)) {
      return { isValid: true, isPure: true, suit: cards[0].suit };
    }

    if (this.isImpureSequence(cards, wildJokerCard)) {
      const natural = cards.find((c) => !JokerManager.isJoker(c, wildJokerCard));
      return { isValid: true, isPure: false, suit: natural ? natural.suit : undefined };
    }

    return { isValid: false, isPure: false, reason: 'Invalid sequence' };
  }
}
