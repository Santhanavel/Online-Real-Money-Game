import { Card, Rank, Suit } from '@rummy/shared-types';

export const SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];

export const RANKS: Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

export const RANK_VALUE_MAP: Record<Rank, number> = {
  A: 10,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q: 10,
  K: 10,
  JOKER: 0,
};

export const RANK_ORDER_MAP: Record<Rank, number> = {
  A: 1, // Can also be 14 in Q-K-A
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  JOKER: 99,
};

export class DeckManager {
  private deckCount: number;
  private printedJokersPerDeck: number;

  constructor(deckCount: number = 2, printedJokersPerDeck: number = 2) {
    this.deckCount = deckCount;
    this.printedJokersPerDeck = printedJokersPerDeck;
  }

  public createDeck(): Card[] {
    const cards: Card[] = [];

    for (let d = 0; d < this.deckCount; d++) {
      // 52 standard cards
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          cards.push({
            cardId: `d${d}-${suit}-${rank}`,
            suit,
            rank,
            deckIndex: d,
            isPrintedJoker: false,
          });
        }
      }

      // Printed jokers
      for (let j = 0; j < this.printedJokersPerDeck; j++) {
        cards.push({
          cardId: `d${d}-NONE-PJ${j + 1}`,
          suit: 'NONE',
          rank: 'JOKER',
          deckIndex: d,
          isPrintedJoker: true,
        });
      }
    }

    return cards;
  }

  public static getCardPoints(card: Card, wildJokerCard?: Card): number {
    if (card.isPrintedJoker) return 0;
    if (wildJokerCard && JokerManager.isWildJoker(card, wildJokerCard)) return 0;
    return RANK_VALUE_MAP[card.rank] ?? 0;
  }
}

import { JokerManager } from './JokerManager';
