import { describe, expect, it } from 'vitest';
import { Card } from '@rummy/shared-types';
import { SequenceValidator } from '../src/engine/SequenceValidator';

describe('SequenceValidator', () => {
  const wildJoker7: Card = {
    cardId: 'd0-SPADES-7',
    suit: 'SPADES',
    rank: '7',
    deckIndex: 0,
    isPrintedJoker: false,
  };

  it('validates a standard Pure Sequence (4H-5H-6H)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '4', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'HEARTS', rank: '5', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'HEARTS', rank: '6', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SequenceValidator.isPureSequence(cards, wildJoker7)).toBe(true);
    const val = SequenceValidator.validate(cards, wildJoker7);
    expect(val.isValid).toBe(true);
    expect(val.isPure).toBe(true);
  });

  it('validates Ace low Pure Sequence (AH-2H-3H)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: 'A', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'HEARTS', rank: '2', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'HEARTS', rank: '3', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SequenceValidator.isPureSequence(cards, wildJoker7)).toBe(true);
  });

  it('validates Ace high Pure Sequence (10H-JH-QH-KH-AH)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '10', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'HEARTS', rank: 'J', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'HEARTS', rank: 'Q', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c4', suit: 'HEARTS', rank: 'K', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c5', suit: 'HEARTS', rank: 'A', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SequenceValidator.isPureSequence(cards, wildJoker7)).toBe(true);
  });

  it('strictly rejects wrap-around sequences (KH-AH-2H)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: 'K', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'HEARTS', rank: 'A', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'HEARTS', rank: '2', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SequenceValidator.isPureSequence(cards, wildJoker7)).toBe(false);
    expect(SequenceValidator.isImpureSequence(cards, wildJoker7)).toBe(false);
  });

  it('strictly rejects sequence with duplicate cards (5H-5H-6H)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '5', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'HEARTS', rank: '5', deckIndex: 1, isPrintedJoker: false },
      { cardId: 'c3', suit: 'HEARTS', rank: '6', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SequenceValidator.isPureSequence(cards, wildJoker7)).toBe(false);
  });

  it('validates Impure Sequence with Printed Joker (4H-PJ-6H)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '4', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'NONE', rank: 'JOKER', deckIndex: 0, isPrintedJoker: true },
      { cardId: 'c3', suit: 'HEARTS', rank: '6', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SequenceValidator.isPureSequence(cards, wildJoker7)).toBe(false);
    expect(SequenceValidator.isImpureSequence(cards, wildJoker7)).toBe(true);
    const val = SequenceValidator.validate(cards, wildJoker7);
    expect(val.isValid).toBe(true);
    expect(val.isPure).toBe(false);
  });

  it('validates Impure Sequence with Wild Joker of different suit (4H-7S-6H where 7 is wild)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '4', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'SPADES', rank: '7', deckIndex: 0, isPrintedJoker: false }, // wild joker
      { cardId: 'c3', suit: 'HEARTS', rank: '6', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SequenceValidator.isPureSequence(cards, wildJoker7)).toBe(false);
    expect(SequenceValidator.isImpureSequence(cards, wildJoker7)).toBe(true);
  });

  it('recognizes a wild card used naturally in its own suit as Pure Sequence (6S-7S-8S where 7 is wild)', () => {
    const cards: Card[] = [
      { cardId: 'c1', suit: 'SPADES', rank: '6', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2', suit: 'SPADES', rank: '7', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c3', suit: 'SPADES', rank: '8', deckIndex: 0, isPrintedJoker: false },
    ];

    expect(SequenceValidator.isPureSequence(cards, wildJoker7)).toBe(true);
  });
});
