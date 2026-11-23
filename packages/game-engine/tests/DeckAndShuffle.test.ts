import { describe, expect, it } from 'vitest';
import { DeckManager } from '../src/engine/DeckManager';
import { ShuffleManager } from '../src/engine/ShuffleManager';

describe('DeckManager and ShuffleManager', () => {
  it('should create 2 decks with 52 standard cards each and 2 printed jokers per deck (108 cards total)', () => {
    const deckMgr = new DeckManager(2, 2);
    const deck = deckMgr.createDeck();

    expect(deck.length).toBe(108);

    // Ensure all cardIds are strictly unique
    const idSet = new Set(deck.map((c) => c.cardId));
    expect(idSet.size).toBe(108);

    // Printed jokers count
    const printedJokers = deck.filter((c) => c.isPrintedJoker);
    expect(printedJokers.length).toBe(4);

    // Suit counts: each standard suit appears 13 * 2 = 26 times
    const hearts = deck.filter((c) => c.suit === 'HEARTS');
    expect(hearts.length).toBe(26);

    const spades = deck.filter((c) => c.suit === 'SPADES');
    expect(spades.length).toBe(26);
  });

  it('should cryptographically shuffle deck without losing or adding cards', () => {
    const deckMgr = new DeckManager(2, 2);
    const originalDeck = deckMgr.createDeck();

    const { shuffled, audit } = ShuffleManager.shuffle(originalDeck);

    expect(shuffled.length).toBe(originalDeck.length);
    expect(audit.cardCount).toBe(108);
    expect(audit.seedHash).toBeDefined();
    expect(audit.initialCardIdsHash).toBeDefined();
    expect(audit.finalCardIdsHash).toBeDefined();

    // Verify all original card IDs exist in shuffled
    const originalIds = new Set(originalDeck.map((c) => c.cardId));
    const shuffledIds = new Set(shuffled.map((c) => c.cardId));

    expect(shuffledIds.size).toBe(108);
    expect([...shuffledIds].every((id) => originalIds.has(id))).toBe(true);

    // Order should be different from original with overwhelming probability
    const isDifferentOrder = shuffled.some((c, idx) => c.cardId !== originalDeck[idx].cardId);
    expect(isDifferentOrder).toBe(true);
  });
});
