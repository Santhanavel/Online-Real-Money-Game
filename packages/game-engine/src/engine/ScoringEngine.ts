import { Card, CardGroup } from '@rummy/shared-types';
import { DeckManager } from './DeckManager';
import { DeclarationValidator, GroupEvaluation } from './DeclarationValidator';
import { JokerManager } from './JokerManager';

export interface HandScoringResult {
  penaltyPoints: number;
  hasPureSequence: boolean;
  hasSecondSequence: boolean;
  exemptCardIds: Set<string>;
  countedCardIds: Set<string>;
  notes: string;
}

export class ScoringEngine {
  public static readonly MAX_SCORE_CAP = 80;
  public static readonly FIRST_DROP_PENALTY = 20;
  public static readonly MIDDLE_DROP_PENALTY = 40;
  public static readonly WRONG_SHOW_PENALTY = 80;
  public static readonly TIMEOUT_DROP_PENALTY = 80;

  /**
   * Calculates the point value of a single card.
   */
  public static getCardPoints(card: Card, wildJokerCard?: Card | null): number {
    return DeckManager.getCardPoints(card, wildJokerCard ?? undefined);
  }

  /**
   * Calculates the penalty points for an evaluated hand with explicit groups.
   */
  public static calculateHandScore(
    groups: CardGroup[] | { cards: Card[] }[],
    wildJokerCard: Card | null,
    isWinner: boolean = false
  ): HandScoringResult {
    if (isWinner) {
      return {
        penaltyPoints: 0,
        hasPureSequence: true,
        hasSecondSequence: true,
        exemptCardIds: new Set(),
        countedCardIds: new Set(),
        notes: 'Winner - 0 penalty points',
      };
    }

    const evaluations: GroupEvaluation[] = groups.map((g) => {
      const res = DeclarationValidator.evaluateGroup(g.cards, wildJokerCard);
      return {
        meldType: res.meldType,
        isValid: res.isValid,
        cards: g.cards,
        points: 0,
      };
    });

    // Check sequences
    const pureSequences = evaluations.filter((e) => e.meldType === 'PURE_SEQUENCE');
    const impureSequences = evaluations.filter((e) => e.meldType === 'IMPURE_SEQUENCE');
    const validSets = evaluations.filter((e) => e.meldType === 'SET');
    const invalidGroups = evaluations.filter((e) => e.meldType === 'INVALID');

    const hasPure = pureSequences.length >= 1;
    const totalSequences = pureSequences.length + impureSequences.length;
    const hasSecond = totalSequences >= 2;

    const exemptCardIds = new Set<string>();
    const countedCardIds = new Set<string>();

    let uncalibratedPenalty = 0;
    let notes = '';

    if (!hasPure) {
      // Rule 1: No pure sequence -> ALL cards in hand count towards penalty!
      notes = 'No Pure Sequence. All cards counted.';
      for (const g of groups) {
        for (const c of g.cards) {
          countedCardIds.add(c.cardId);
          uncalibratedPenalty += this.getCardPoints(c, wildJokerCard);
        }
      }
    } else if (hasPure && !hasSecond) {
      // Rule 2: Has 1 Pure sequence, but NO second sequence.
      // Cards in the FIRST pure sequence are exempt (0 points).
      // All other cards (even if in a set or another invalid group) are counted!
      notes = 'One Pure Sequence, no second sequence. Only primary pure sequence exempted.';
      const primaryPure = pureSequences[0];
      for (const c of primaryPure.cards) {
        exemptCardIds.add(c.cardId);
      }

      // If there are other pure sequences or groups, they are counted
      for (let i = 1; i < pureSequences.length; i++) {
        for (const c of pureSequences[i].cards) {
          countedCardIds.add(c.cardId);
          uncalibratedPenalty += this.getCardPoints(c, wildJokerCard);
        }
      }
      for (const g of [...impureSequences, ...validSets, ...invalidGroups]) {
        for (const c of g.cards) {
          countedCardIds.add(c.cardId);
          uncalibratedPenalty += this.getCardPoints(c, wildJokerCard);
        }
      }
    } else {
      // Rule 3: Has pure sequence AND at least a second sequence.
      // All valid sequences (pure & impure) and valid sets are exempt!
      // Only invalid groups and ungrouped cards are counted.
      notes = 'Valid primary & secondary sequences. Only invalid cards counted.';
      for (const g of [...pureSequences, ...impureSequences, ...validSets]) {
        for (const c of g.cards) {
          exemptCardIds.add(c.cardId);
        }
      }
      for (const g of invalidGroups) {
        for (const c of g.cards) {
          countedCardIds.add(c.cardId);
          uncalibratedPenalty += this.getCardPoints(c, wildJokerCard);
        }
      }
    }

    const finalPenalty = Math.min(uncalibratedPenalty, this.MAX_SCORE_CAP);

    return {
      penaltyPoints: finalPenalty,
      hasPureSequence: hasPure,
      hasSecondSequence: hasSecond,
      exemptCardIds,
      countedCardIds,
      notes,
    };
  }
}
