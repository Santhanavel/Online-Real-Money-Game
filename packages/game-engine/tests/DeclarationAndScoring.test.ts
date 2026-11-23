import { describe, expect, it } from 'vitest';
import { Card } from '@rummy/shared-types';
import { DeclarationValidator } from '../src/engine/DeclarationValidator';
import { ScoringEngine } from '../src/engine/ScoringEngine';

describe('DeclarationValidator and ScoringEngine', () => {
  const wildCard5: Card = {
    cardId: 'd0-DIAMONDS-5',
    suit: 'DIAMONDS',
    rank: '5',
    deckIndex: 0,
    isPrintedJoker: false,
  };

  // Pure sequence: 2H, 3H, 4H (3 cards)
  const pureSeq: Card[] = [
    { cardId: 'c1', suit: 'HEARTS', rank: '2', deckIndex: 0, isPrintedJoker: false },
    { cardId: 'c2', suit: 'HEARTS', rank: '3', deckIndex: 0, isPrintedJoker: false },
    { cardId: 'c3', suit: 'HEARTS', rank: '4', deckIndex: 0, isPrintedJoker: false },
  ];

  // Impure sequence: 8S, 5D (wild), 10S, JS (4 cards)
  const impureSeq: Card[] = [
    { cardId: 'c4', suit: 'SPADES', rank: '8', deckIndex: 0, isPrintedJoker: false },
    { cardId: 'c5', suit: 'DIAMONDS', rank: '5', deckIndex: 0, isPrintedJoker: false }, // wild joker substituting 9S
    { cardId: 'c6', suit: 'SPADES', rank: '10', deckIndex: 0, isPrintedJoker: false },
    { cardId: 'c7', suit: 'SPADES', rank: 'J', deckIndex: 0, isPrintedJoker: false },
  ];

  // Set 1: KC, KD, KS (3 cards)
  const set1: Card[] = [
    { cardId: 'c8', suit: 'CLUBS', rank: 'K', deckIndex: 0, isPrintedJoker: false },
    { cardId: 'c9', suit: 'DIAMONDS', rank: 'K', deckIndex: 0, isPrintedJoker: false },
    { cardId: 'c10', suit: 'SPADES', rank: 'K', deckIndex: 0, isPrintedJoker: false },
  ];

  // Set 2: 7H, 7C, PJ (3 cards)
  const set2: Card[] = [
    { cardId: 'c11', suit: 'HEARTS', rank: '7', deckIndex: 0, isPrintedJoker: false },
    { cardId: 'c12', suit: 'CLUBS', rank: '7', deckIndex: 0, isPrintedJoker: false },
    { cardId: 'c13', suit: 'NONE', rank: 'JOKER', deckIndex: 0, isPrintedJoker: true },
  ];

  it('validates a complete, authentic 13-card Indian Rummy winning hand', () => {
    const groups = [
      { cards: pureSeq },
      { cards: impureSeq },
      { cards: set1 },
      { cards: set2 },
    ];

    const result = DeclarationValidator.validateDeclaration(groups, wildCard5);
    expect(result.isValid).toBe(true);
    expect(result.hasPureSequence).toBe(true);
    expect(result.hasSecondSequence).toBe(true);
    expect(result.penaltyPoints).toBe(0);

    const score = ScoringEngine.calculateHandScore(groups, wildCard5, true);
    expect(score.penaltyPoints).toBe(0);
  });

  it('rejects a declaration lacking a Pure Sequence (even if it has impure sequences & sets)', () => {
    // Replace pureSeq with an impure one
    const impureSeqInstead: Card[] = [
      { cardId: 'c1', suit: 'HEARTS', rank: '2', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c2_joker', suit: 'NONE', rank: 'JOKER', deckIndex: 0, isPrintedJoker: true },
      { cardId: 'c3', suit: 'HEARTS', rank: '4', deckIndex: 0, isPrintedJoker: false },
    ];

    const groups = [
      { cards: impureSeqInstead },
      { cards: impureSeq },
      { cards: set1 },
      { cards: set2 },
    ];

    const result = DeclarationValidator.validateDeclaration(groups, wildCard5);
    expect(result.isValid).toBe(false);
    expect(result.hasPureSequence).toBe(false);
    expect(result.reason).toContain('Pure Sequence');

    // Score without pure sequence should count all cards up to 80 cap
    const score = ScoringEngine.calculateHandScore(groups, wildCard5, false);
    expect(score.penaltyPoints).toBeGreaterThan(0);
    expect(score.hasPureSequence).toBe(false);
  });

  it('rejects a declaration with only 1 sequence (lacks second sequence)', () => {
    // 1 pure sequence + 3 sets = 13 cards (invalid declaration)
    const set3: Card[] = [
      { cardId: 'c4', suit: 'CLUBS', rank: '9', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c5', suit: 'HEARTS', rank: '9', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c6', suit: 'SPADES', rank: '9', deckIndex: 0, isPrintedJoker: false },
      { cardId: 'c7', suit: 'DIAMONDS', rank: '9', deckIndex: 0, isPrintedJoker: false },
    ];

    const groups = [
      { cards: pureSeq }, // 3 cards
      { cards: set3 },    // 4 cards
      { cards: set1 },    // 3 cards
      { cards: set2 },    // 3 cards
    ];

    const result = DeclarationValidator.validateDeclaration(groups, wildCard5);
    expect(result.isValid).toBe(false);
    expect(result.hasPureSequence).toBe(true);
    expect(result.hasSecondSequence).toBe(false);
    expect(result.reason).toContain('two sequences');

    // In scoring: only pureSeq is exempted, all other cards (sets 1, 2, 3) are penalized
    const score = ScoringEngine.calculateHandScore(groups, wildCard5, false);
    expect(score.hasPureSequence).toBe(true);
    expect(score.hasSecondSequence).toBe(false);
    expect(score.exemptCardIds.size).toBe(3); // only pureSeq cards
  });
});
