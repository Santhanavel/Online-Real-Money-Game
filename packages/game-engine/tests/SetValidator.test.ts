import { describe, expect, it } from 'vitest';
import { Card } from '@rummy/shared-types';
import { SetValidator } from '../src/engine/SetValidator';

describe('SetValidator', () => {
  const wildJoker3: Card = {
    cardId: 'd0-CLUBS-3',
    suit: 'CLUBS',
    rank: '3',
    deckIndex: 0,
    isPrintedJoker: false,
  };

  it('validates a 3-card natural set with distinct suits (7H-7D-7C)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '7', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'DIAMONDS', rank: '7', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'CLUBS', rank: '7', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SetValidator.isValidSet(cards, wildJoker3)).toBe(true);
    const val = SetValidator.validate(cards, wildJoker3);
    expect(val.isValid).toBe(true);
    expect(val.rank).toBe('7');
  });

  it('validates a 4-card natural set with all 4 distinct suits (KH-KD-KC-KS)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: 'K', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'DIAMONDS', rank: 'K', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'CLUBS', rank: 'K', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c4', suit: 'SPADES', rank: 'K', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SetValidator.isValidSet(cards, wildJoker3)).toBe(true);
  });

  it('strictly rejects duplicate suits in a set (7H-7H-7D)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '7', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'HEARTS', rank: '7', deckIndex: 1, isPrintedJoker: false }, // Duplicate suit!
      { cardId: 'c3', suit: 'DIAMONDS', rank: '7', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SetValidator.isValidSet(cards, wildJoker3)).toBe(false);
  });

  it('validates a set with a Printed Joker (8H-8D-PJ)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '8', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'DIAMONDS', rank: '8', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'NONE', rank: 'JOKER', deckIndex: 0, isPrintedJoker: true },
    ];

    expect(SetValidator.isValidSet(cards, wildJoker3)).toBe(true);
  });

  it('validates a set with a Wild Joker (9H-9D-3S where 3 is wild)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '9', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'DIAMONDS', rank: '9', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'SPADES', rank: '3', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SetValidator.isValidSet(cards, wildJoker3)).toBe(true);
  });

  it('rejects a set with 5 cards or fewer than 3 cards', () => {
    const twoCards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '9', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'DIAMONDS', rank: '9', deckIndex: 0, isPrintedJoker: false },
    ];
    expect(SetValidator.isValidSet(twoCards, wildJoker3)).toBe(false);

    const fiveCards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '9', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'DIAMONDS', rank: '9', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'CLUBS', rank: '9', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c4', suit: 'SPADES', rank: '9', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c5', suit: 'NONE', rank: 'JOKER', deckIndex: 0, isPrintedJoker: true },
    ];
    expect(SetValidator.isValidSet(fiveCards, wildJoker3)).toBe(false);
  });
});
