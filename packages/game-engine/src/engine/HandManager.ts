import { Card, CardGroup } from '@rummy/shared-types';
import { DeclarationValidator } from './DeclarationValidator';
import { JokerManager } from './JokerManager';
import { SequenceValidator } from './SequenceValidator';
import { SetValidator } from './SetValidator';

export class HandManager {
  /**
   * Sorts cards primarily by suit, then by rank value.
   * Useful for the initial deal or player "Sort" button.
   */
  public static sortBySuitAndRank(cards: Card[]): Card[] {
    const suitOrder: Record<string, number> = {
      SPADES: 0,
      HEARTS: 1,
      CLUBS: 2,
      DIAMONDS: 3,
      NONE: 4,
    };

    const rankOrder: Record<string, number> = {
      A: 1,
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

    return [...cards].sort((a, b) => {
      const suitDiff = (suitOrder[a.suit] ?? 99) - (suitOrder[b.suit] ?? 99);
      if (suitDiff !== 0) return suitDiff;
      return (rankOrder[a.rank] ?? 99) - (rankOrder[b.rank] ?? 99);
    });
  }

  /**
   * Smart Grouping: organizes 13 cards into logical card groups
   * (Pure Sequences first, then Impure Sequences, then Sets, then remaining invalid).
   */
  public static autoGroupCards(cards: Card[], wildJokerCard: Card | null): CardGroup[] {
    if (!cards || cards.length === 0) return [];

    const remaining = [...cards];
    const groups: CardGroup[] = [];
    let groupId = 1;

    // Helper to find and extract Pure Sequences
    const extractPureSequences = () => {
      // Group by suit
      const bySuit: Record<string, Card[]> = {};
      for (const card of remaining) {
        if (!card.isPrintedJoker && card.rank !== 'JOKER') {
          if (!bySuit[card.suit]) bySuit[card.suit] = [];
          bySuit[card.suit].push(card);
        }
      }

      for (const suit in bySuit) {
        const suitCards = bySuit[suit];
        if (suitCards.length < 3) continue;

        // Try combinations of lengths 3, 4, 5
        const sorted = this.sortBySuitAndRank(suitCards);
        // Find consecutive sub-sequences
        const candidateSequences: Card[][] = [];
        let currentSeq: Card[] = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
          const prev = currentSeq[currentSeq.length - 1];
          const curr = sorted[i];

          const prevVal = prev.rank === 'A' ? 1 : Number(prev.rank) || (prev.rank === 'J' ? 11 : prev.rank === 'Q' ? 12 : 13);
          const currVal = curr.rank === 'A' ? 1 : Number(curr.rank) || (curr.rank === 'J' ? 11 : curr.rank === 'Q' ? 12 : 13);

          if (currVal === prevVal + 1) {
            currentSeq.push(curr);
          } else if (currVal !== prevVal) {
            if (currentSeq.length >= 3 && SequenceValidator.isPureSequence(currentSeq, wildJokerCard)) {
              candidateSequences.push([...currentSeq]);
            }
            currentSeq = [curr];
          }
        }
        if (currentSeq.length >= 3 && SequenceValidator.isPureSequence(currentSeq, wildJokerCard)) {
          candidateSequences.push([...currentSeq]);
        }

        // Also check Q-K-A with Ace high
        const hasA = sorted.some((c) => c.rank === 'A');
        const hasK = sorted.some((c) => c.rank === 'K');
        const hasQ = sorted.some((c) => c.rank === 'Q');
        if (hasA && hasK && hasQ) {
          const highSeq = [
            sorted.find((c) => c.rank === 'Q')!,
            sorted.find((c) => c.rank === 'K')!,
            sorted.find((c) => c.rank === 'A')!,
          ];
          const hasJ = sorted.find((c) => c.rank === 'J');
          if (hasJ) highSeq.unshift(hasJ);
          const has10 = sorted.find((c) => c.rank === '10');
          if (has10 && hasJ) highSeq.unshift(has10);

          if (SequenceValidator.isPureSequence(highSeq, wildJokerCard)) {
            candidateSequences.push(highSeq);
          }
        }

        for (const seq of candidateSequences) {
          // Check if all cards in seq are still in remaining
          const canExtract = seq.every((sc) =>
            remaining.some((rc) => rc.cardId === sc.cardId)
          );
          if (canExtract) {
            // Remove from remaining
            for (const sc of seq) {
              const idx = remaining.findIndex((rc) => rc.cardId === sc.cardId);
              if (idx !== -1) remaining.splice(idx, 1);
            }
            groups.push({
              id: `group-${groupId++}`,
              cards: seq,
              meldType: 'PURE_SEQUENCE',
              isValid: true,
            });
          }
        }
      }
    };

    // Helper to find and extract Sets
    const extractSets = () => {
      const byRank: Record<string, Card[]> = {};
      for (const card of remaining) {
        if (!card.isPrintedJoker && card.rank !== 'JOKER') {
          if (!byRank[card.rank]) byRank[card.rank] = [];
          byRank[card.rank].push(card);
        }
      }

      for (const rank in byRank) {
        const cardsOfRank = byRank[rank];
        // Distinct suits
        const uniqueSuitedCards: Card[] = [];
        const seenSuits = new Set<string>();
        for (const c of cardsOfRank) {
          if (!seenSuits.has(c.suit)) {
            seenSuits.add(c.suit);
            uniqueSuitedCards.push(c);
          }
        }

        if (uniqueSuitedCards.length >= 3 && uniqueSuitedCards.length <= 4) {
          if (SetValidator.isValidSet(uniqueSuitedCards, wildJokerCard)) {
            for (const sc of uniqueSuitedCards) {
              const idx = remaining.findIndex((rc) => rc.cardId === sc.cardId);
              if (idx !== -1) remaining.splice(idx, 1);
            }
            groups.push({
              id: `group-${groupId++}`,
              cards: uniqueSuitedCards,
              meldType: 'SET',
              isValid: true,
            });
          }
        }
      }
    };

    extractPureSequences();
    extractSets();

    // Any remaining cards grouped into clean, compact chunks of 3-4 cards (not one giant 10-card group)
    if (remaining.length > 0) {
      const sortedRemaining = HandManager.sortBySuitAndRank(remaining);
      while (sortedRemaining.length > 0) {
        const chunkSize = sortedRemaining.length > 4 ? (sortedRemaining.length === 5 ? 3 : 4) : sortedRemaining.length;
        const chunk = sortedRemaining.splice(0, chunkSize);
        groups.push({
          id: `group-${groupId++}`,
          cards: chunk,
          meldType: 'INVALID',
          isValid: false,
        });
      }
    }

    // Refresh meld types on all groups
    return groups.map((g) => {
      const evalRes = DeclarationValidator.evaluateGroup(g.cards, wildJokerCard);
      return {
        ...g,
        meldType: evalRes.meldType,
        isValid: evalRes.isValid,
      };
    });
  }

  /**
   * Sort by Suit Mode: Partitions hand into distinct groups by suit,
   * arranged in standard order (Hearts -> Diamonds -> Clubs -> Spades -> Jokers),
   * sorted in ascending rank within each suit.
   */
  public static sortBySuitGroups(cards: Card[], wildJokerCard?: Card | null): CardGroup[] {
    if (!cards || cards.length === 0) return [];

    const suitOrder = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES', 'NONE'];
    const rankOrder: Record<string, number> = {
      A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, JOKER: 99,
    };

    const groupedMap: Record<string, Card[]> = {};
    for (const s of suitOrder) groupedMap[s] = [];

    for (const card of cards) {
      if (card.isPrintedJoker || card.suit === 'NONE') {
        groupedMap['NONE'].push(card);
      } else {
        if (!groupedMap[card.suit]) groupedMap[card.suit] = [];
        groupedMap[card.suit].push(card);
      }
    }

    const result: CardGroup[] = [];
    let groupId = 1;

    for (const s of suitOrder) {
      const list = groupedMap[s];
      if (list && list.length > 0) {
        list.sort((a, b) => (rankOrder[a.rank] ?? 99) - (rankOrder[b.rank] ?? 99));
        const evalRes = DeclarationValidator.evaluateGroup(list, wildJokerCard ?? null);
        result.push({
          id: `group-suit-${groupId++}`,
          cards: list,
          meldType: evalRes.meldType,
          isValid: evalRes.isValid,
        });
      }
    }

    return result;
  }

  /**
   * Sort by Rank Mode: Groups cards of identical ranks together into card groups.
   */
  public static sortByRankGroups(cards: Card[], wildJokerCard?: Card | null): CardGroup[] {
    if (!cards || cards.length === 0) return [];

    const rankOrder = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER'];
    const rankMap: Record<string, Card[]> = {};

    for (const card of cards) {
      const key = card.isPrintedJoker ? 'JOKER' : card.rank;
      if (!rankMap[key]) rankMap[key] = [];
      rankMap[key].push(card);
    }

    const result: CardGroup[] = [];
    let groupId = 1;

    for (const r of rankOrder) {
      const list = rankMap[r];
      if (list && list.length > 0) {
        const evalRes = DeclarationValidator.evaluateGroup(list, wildJokerCard ?? null);
        result.push({
          id: `group-rank-${groupId++}`,
          cards: list,
          meldType: evalRes.meldType,
          isValid: evalRes.isValid,
        });
      }
    }

    return result;
  }

  /**
   * Moves a card between groups or creates a new group.
   */
  public static moveCard(
    groups: CardGroup[],
    cardId: string,
    targetGroupId: string,
    targetIndex?: number,
    wildJokerCard?: Card | null
  ): CardGroup[] {
    let movedCard: Card | null = null;

    // Remove card from source group
    const cleanedGroups = groups
      .map((g) => {
        const found = g.cards.find((c) => c.cardId === cardId);
        if (found) movedCard = found;
        return {
          ...g,
          cards: g.cards.filter((c) => c.cardId !== cardId),
        };
      })
      .filter((g) => g.cards.length > 0);

    if (!movedCard) return groups;

    if (targetGroupId === 'NEW_GROUP') {
      cleanedGroups.push({
        id: `group-${Date.now()}`,
        cards: [movedCard],
        meldType: 'INVALID',
        isValid: false,
      });
    } else {
      const target = cleanedGroups.find((g) => g.id === targetGroupId);
      if (target) {
        if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= target.cards.length) {
          target.cards.splice(targetIndex, 0, movedCard);
        } else {
          target.cards.push(movedCard);
        }
      } else {
        cleanedGroups.push({
          id: targetGroupId,
          cards: [movedCard],
          meldType: 'INVALID',
          isValid: false,
        });
      }
    }

    // Re-evaluate meld status
    return cleanedGroups.map((g) => {
      const evalRes = DeclarationValidator.evaluateGroup(g.cards, wildJokerCard ?? null);
      return {
        ...g,
        meldType: evalRes.meldType,
        isValid: evalRes.isValid,
      };
    });
  }

  /**
   * Ungroups specified cards or dissolves groups:
   * Extracts selected cards into an "Ungrouped" group, leaving remaining cards in their groups.
   */
  public static ungroupCards(
    groups: CardGroup[],
    cardIdsToUngroup: Set<string>,
    wildJokerCard?: Card | null
  ): CardGroup[] {
    const unassigned: Card[] = [];
    const preservedGroups: CardGroup[] = [];

    for (const g of groups) {
      const keeping = g.cards.filter((c) => !cardIdsToUngroup.has(c.cardId));
      const extracted = g.cards.filter((c) => cardIdsToUngroup.has(c.cardId));
      unassigned.push(...extracted);

      if (keeping.length > 0) {
        preservedGroups.push({
          ...g,
          cards: keeping,
        });
      }
    }

    if (unassigned.length > 0) {
      const existingUngrouped = preservedGroups.find((g) => g.id.includes('ungrouped'));
      if (existingUngrouped) {
        existingUngrouped.cards.push(...unassigned);
      } else {
        preservedGroups.push({
          id: `group-ungrouped-${Date.now()}`,
          cards: unassigned,
          meldType: 'INVALID',
          isValid: false,
        });
      }
    }

    return preservedGroups.map((g) => {
      const evalRes = DeclarationValidator.evaluateGroup(g.cards, wildJokerCard ?? null);
      return {
        ...g,
        meldType: evalRes.meldType,
        isValid: evalRes.isValid,
      };
    });
  }
}
