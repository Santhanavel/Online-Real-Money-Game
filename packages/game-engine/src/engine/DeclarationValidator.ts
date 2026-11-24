import { Card, CardGroup, MeldType } from '@rummy/shared-types';
import { SequenceValidator } from './SequenceValidator';
import { SetValidator } from './SetValidator';

export interface GroupEvaluation {
  meldType: MeldType;
  isValid: boolean;
  cards: Card[];
  points: number;
}

export interface DeclarationResult {
  isValid: boolean;
  hasPureSequence: boolean;
  hasSecondSequence: boolean;
  groupEvaluations: GroupEvaluation[];
  penaltyPoints: number;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
  missingRequirements?: string[];
  invalidGroupIndices?: number[];
  invalidCardIds?: string[];
}

export class DeclarationValidator {
  /**
   * Evaluates a single card group
   */
  public static evaluateGroup(
    cards: Card[],
    wildJokerCard: Card | null
  ): { meldType: MeldType; isValid: boolean } {
    if (!cards || cards.length < 3) {
      return { meldType: 'INVALID', isValid: false };
    }

    if (SequenceValidator.isPureSequence(cards, wildJokerCard)) {
      return { meldType: 'PURE_SEQUENCE', isValid: true };
    }

    if (SequenceValidator.isImpureSequence(cards, wildJokerCard)) {
      return { meldType: 'IMPURE_SEQUENCE', isValid: true };
    }

    if (SetValidator.isValidSet(cards, wildJokerCard)) {
      return { meldType: 'SET', isValid: true };
    }

    return { meldType: 'INVALID', isValid: false };
  }

  /**
   * Validates a declared 13-card hand submitted by a player as groups.
   */
  public static validateDeclaration(
    groups: CardGroup[] | { cards: Card[] }[],
    wildJokerCard: Card | null
  ): DeclarationResult {
    const totalCards = groups.reduce((acc, g) => acc + g.cards.length, 0);

    // Collect all cardIds to ensure no duplicates and exact 13 cards
    const allCardIds = new Set<string>();
    let hasDuplicate = false;
    for (const g of groups) {
      for (const c of g.cards) {
        if (allCardIds.has(c.cardId)) {
          hasDuplicate = true;
        }
        allCardIds.add(c.cardId);
      }
    }

    if (hasDuplicate) {
      return {
        isValid: false,
        hasPureSequence: false,
        hasSecondSequence: false,
        groupEvaluations: [],
        penaltyPoints: 80,
        reason: 'Duplicate cards detected in declaration',
      };
    }

    if (totalCards !== 13) {
      return {
        isValid: false,
        hasPureSequence: false,
        hasSecondSequence: false,
        groupEvaluations: [],
        penaltyPoints: 80,
        reason: `Declaration requires exactly 13 cards, received ${totalCards}`,
      };
    }

    const evaluations: GroupEvaluation[] = groups.map((g) => {
      const res = this.evaluateGroup(g.cards, wildJokerCard);
      return {
        meldType: res.meldType,
        isValid: res.isValid,
        cards: g.cards,
        points: 0, // calculated in scoring engine
      };
    });

    let pureSequenceCount = 0;
    let impureSequenceCount = 0;
    let setCount = 0;
    let invalidCount = 0;

    for (const ev of evaluations) {
      if (ev.meldType === 'PURE_SEQUENCE') {
        pureSequenceCount++;
      } else if (ev.meldType === 'IMPURE_SEQUENCE') {
        impureSequenceCount++;
      } else if (ev.meldType === 'SET') {
        setCount++;
      } else {
        invalidCount++;
      }
    }

    const totalSequences = pureSequenceCount + impureSequenceCount;
    const hasPureSequence = pureSequenceCount >= 1;
    const hasSecondSequence = totalSequences >= 2;
    const allGroupsValid = invalidCount === 0;

    const missingRequirements: string[] = [];
    if (!hasPureSequence) {
      missingRequirements.push('At least one Pure Sequence (3+ consecutive cards of same suit, no Joker) is required');
    }
    if (!hasSecondSequence) {
      missingRequirements.push('At least two sequences are required (one Pure and at least one other Pure or Impure Sequence)');
    }

    const invalidGroupIndices: number[] = [];
    const invalidCardIds: string[] = [];
    evaluations.forEach((ev, idx) => {
      if (!ev.isValid) {
        invalidGroupIndices.push(idx);
        for (const c of ev.cards) {
          invalidCardIds.push(c.cardId);
        }
      }
    });

    if (invalidGroupIndices.length > 0) {
      missingRequirements.push(`${invalidGroupIndices.length} group(s) are invalid (cannot form valid sequences or sets)`);
    }

    const isValid = hasPureSequence && hasSecondSequence && allGroupsValid;

    let reason: string | undefined;
    let errorCode: string | undefined;
    if (!hasPureSequence) {
      reason = 'At least one Pure Sequence is required';
      errorCode = 'MISSING_PURE_SEQUENCE';
    } else if (!hasSecondSequence) {
      reason = 'At least two sequences are required (one pure, one second pure/impure)';
      errorCode = 'MISSING_SECOND_SEQUENCE';
    } else if (!allGroupsValid) {
      reason = 'All cards must be arranged in valid sequences or sets with no invalid groups';
      errorCode = 'INVALID_GROUP';
    }

    return {
      isValid,
      hasPureSequence,
      hasSecondSequence,
      groupEvaluations: evaluations,
      penaltyPoints: isValid ? 0 : 80,
      reason,
      errorCode,
      errorMessage: reason,
      missingRequirements,
      invalidGroupIndices,
      invalidCardIds,
    };
  }
}
