import { describe, expect, it } from 'vitest';
import { Card } from '@rummy/shared-types';
import { JokerManager } from '../src/engine/JokerManager';

describe('JokerManager', () => {
  it('identifies wild jokers based on cut card', () => {
    const cutCard: Card = {
      cardId: 'd0-SPADES-7',
      suit: 'SPADES',
      rank: '7',
      deckIndex: 0,
      isPrintedJoker: false,
    };

    const wildCard: Card = {
      cardId: 'd1-HEARTS-7',
      suit: 'HEARTS',
      rank: '7',
      deckIndex: 1,
      isPrintedJoker: false,
    };

    const regularCard: Card = {
      cardId: 'd0-HEARTS-8',
      suit: 'HEARTS',
      rank: '8',
      deckIndex: 0,
      isPrintedJoker: false,
    };

    expect(JokerManager.isWildJoker(wildCard, cutCard)).toBe(true);
    expect(JokerManager.isJoker(wildCard, cutCard)).toBe(true);
    expect(JokerManager.isWildJoker(regularCard, cutCard)).toBe(false);
    expect(JokerManager.isJoker(regularCard, cutCard)).toBe(false);
  });

  it('handles cut card being a Printed Joker by turning Aces into wild jokers', () => {
    const cutCard: Card = {
      cardId: 'd0-NONE-PJ1',
      suit: 'NONE',
      rank: 'JOKER',
      deckIndex: 0,
      isPrintedJoker: true,
    };

    const aceCard: Card = {
      cardId: 'd0-CLUBS-A',
      suit: 'CLUBS',
      rank: 'A',
      deckIndex: 0,
      isPrintedJoker: false,
    };

    const kingCard: Card = {
      cardId: 'd0-CLUBS-K',
      suit: 'CLUBS',
      rank: 'K',
      deckIndex: 0,
      isPrintedJoker: false,
    };

    expect(JokerManager.getEffectiveWildRank(cutCard)).toBe('A');
    expect(JokerManager.isWildJoker(aceCard, cutCard)).toBe(true);
    expect(JokerManager.isJoker(aceCard, cutCard)).toBe(true);
    expect(JokerManager.isWildJoker(kingCard, cutCard)).toBe(false);
  });
});
