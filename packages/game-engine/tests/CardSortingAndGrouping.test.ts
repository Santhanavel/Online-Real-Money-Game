import { describe, expect, it } from 'vitest';
import { Card } from '@rummy/shared-types';
import { HandManager } from '../src/engine/HandManager';
import { DeclarationValidator } from '../src/engine/DeclarationValidator';

describe('HandManager - Sorting, Grouping and Manual Arrangement', () => {
  const c = (cardId: string, suit: any, rank: any, isPrintedJoker = false): Card => ({
    cardId,
    suit,
    rank,
    deckIndex: 0,
    isPrintedJoker,
  });

  const wildCard = c('d0-SPADES-7', 'SPADES', '7');

  it('correctly partitions cards into distinct suit groups in standard order', () => {
    const hand: Card[] = [
      c('c1', 'CLUBS', '9'),
      c('h1', 'HEARTS', 'A'),
      c('d1', 'DIAMONDS', 'K'),
      c('s1', 'SPADES', '2'),
      c('h2', 'HEARTS', '3'),
      c('c2', 'CLUBS', '8'),
      c('j1', 'NONE', 'JOKER', true),
    ];

    const groups = HandManager.sortBySuitGroups(hand, wildCard);

    // Should create groups for HEARTS, DIAMONDS, CLUBS, SPADES, and JOKER
    expect(groups.length).toBeGreaterThanOrEqual(4);

    const heartsGroup = groups.find((g) => g.cards.some((cd) => cd.suit === 'HEARTS'));
    expect(heartsGroup).toBeDefined();
    expect(heartsGroup!.cards.map((cd) => cd.rank)).toEqual(['A', '3']);

    const clubsGroup = groups.find((g) => g.cards.some((cd) => cd.suit === 'CLUBS'));
    expect(clubsGroup).toBeDefined();
    expect(clubsGroup!.cards.map((cd) => cd.rank)).toEqual(['8', '9']);
  });

  it('correctly groups cards of identical rank together in rank sort mode', () => {
    const hand: Card[] = [
      c('h7', 'HEARTS', '7'),
      c('c7', 'CLUBS', '7'),
      c('d7', 'DIAMONDS', '7'),
      c('hK', 'HEARTS', 'K'),
      c('sK', 'SPADES', 'K'),
    ];

    const groups = HandManager.sortByRankGroups(hand, null);

    const sevensGroup = groups.find((g) => g.cards.every((cd) => cd.rank === '7'));
    expect(sevensGroup).toBeDefined();
    expect(sevensGroup!.cards.length).toBe(3);
    expect(sevensGroup!.meldType).toBe('SET');
    expect(sevensGroup!.isValid).toBe(true);

    const kingsGroup = groups.find((g) => g.cards.every((cd) => cd.rank === 'K'));
    expect(kingsGroup).toBeDefined();
    expect(kingsGroup!.cards.length).toBe(2);
  });

  it('supports moving cards between groups (manual drag-and-drop)', () => {
    const group1 = {
      id: 'grp-1',
      cards: [
        c('h2', 'HEARTS', '2'),
        c('h3', 'HEARTS', '3'),
        c('h4', 'HEARTS', '4'),
        c('sK', 'SPADES', 'K'), // Stray card
      ],
    };

    const group2 = {
      id: 'grp-2',
      cards: [
        c('cK', 'CLUBS', 'K'),
        c('dK', 'DIAMONDS', 'K'),
      ],
    };

    // Move 'sK' from group1 into group2
    const updated = HandManager.moveCard([group1, group2], 'sK', 'grp-2', undefined, wildCard);

    const g1 = updated.find((g) => g.id === 'grp-1')!;
    const g2 = updated.find((g) => g.id === 'grp-2')!;

    expect(g1.cards.map((cd) => cd.cardId)).toEqual(['h2', 'h3', 'h4']);
    expect(g1.meldType).toBe('PURE_SEQUENCE');
    expect(g1.isValid).toBe(true);

    expect(g2.cards.map((cd) => cd.cardId)).toEqual(['cK', 'dK', 'sK']);
    expect(g2.meldType).toBe('SET');
    expect(g2.isValid).toBe(true);
  });

  it('supports moving card into a brand new group', () => {
    const group1 = {
      id: 'grp-1',
      cards: [c('h2', 'HEARTS', '2'), c('h3', 'HEARTS', '3')],
    };

    const updated = HandManager.moveCard([group1], 'h3', 'NEW_GROUP', undefined, null);
    expect(updated.length).toBe(2);
    expect(updated[0].cards.length).toBe(1);
    expect(updated[1].cards.length).toBe(1);
  });
});
