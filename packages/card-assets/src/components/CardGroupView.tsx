import React from 'react';
import { Card, CardGroup, MeldType } from '@rummy/shared-types';
import { PlayingCard } from './PlayingCard';

export interface CardGroupViewProps {
  group: CardGroup;
  selectedCardIds: Set<string>;
  wildJokerCard?: Card | null;
  newlyPickedCardId?: string | null;
  onCardClick?: (card: Card) => void;
  onCardDragStart?: (e: React.DragEvent, card: Card, groupId: string) => void;
  onCardDragOver?: (e: React.DragEvent) => void;
  onCardDrop?: (e: React.DragEvent, targetGroupId: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  points?: number;
}

export const CardGroupView: React.FC<CardGroupViewProps> = ({
  group,
  selectedCardIds,
  wildJokerCard,
  newlyPickedCardId,
  onCardClick,
  onCardDragStart,
  onCardDragOver,
  onCardDrop,
  size = 'md',
  className = '',
  points = 0,
}) => {
  const getBadgeStyle = (meldType?: MeldType) => {
    switch (meldType) {
      case 'PURE_SEQUENCE':
        return {
          bg: '#059669', // Emerald
          text: '#ECFDF5',
          label: '✓ Pure Seq',
          border: '1px solid #34D399',
          boxGlow: '0 0 12px rgba(16, 185, 129, 0.35)',
        };
      case 'IMPURE_SEQUENCE':
        return {
          bg: '#2563EB', // Blue
          text: '#EFF6FF',
          label: '✓ Impure Seq',
          border: '1px solid #60A5FA',
          boxGlow: '0 0 12px rgba(59, 130, 246, 0.35)',
        };
      case 'SET':
        return {
          bg: '#D97706', // Amber
          text: '#FFFBEB',
          label: '✓ Valid Set',
          border: '1px solid #FBBF24',
          boxGlow: '0 0 12px rgba(245, 158, 11, 0.35)',
        };
      case 'INVALID':
      default:
        return {
          bg: '#334155', // Slate
          text: '#F8FAFC',
          label: points > 0 ? `Invalid (${points} pts)` : 'Invalid Group',
          border: '1px solid #64748B',
          boxGlow: 'none',
        };
    }
  };

  const badge = getBadgeStyle(group.meldType);
  // Balanced overlap so Rank & Suit on left margin remain completely visible!
  const cardOverlap = size === 'sm' ? -22 : size === 'md' ? -30 : -38;

  return (
    <div
      onDragOver={onCardDragOver}
      onDrop={(e) => onCardDrop && onCardDrop(e, group.id)}
      style={{
        boxShadow: badge.boxGlow,
        border: badge.border,
      }}
      className={`inline-flex flex-col items-center p-2 rounded-2xl bg-black/50 backdrop-blur-md transition-all duration-200 select-none ${className}`}
    >
      {/* Group Meld Status Tag */}
      <div
        style={{
          backgroundColor: badge.bg,
          color: badge.text,
          fontSize: '11px',
          fontWeight: 800,
          padding: '2px 10px',
          borderRadius: '9999px',
          marginBottom: '6px',
          letterSpacing: '0.03em',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}
        className="flex items-center gap-1 shadow-md"
      >
        <span>{badge.label}</span>
      </div>

      {/* Cards Row (RummyCulture style overlapping cascade) */}
      <div className="flex items-center px-1 py-1">
        {group.cards.map((card, idx) => {
          const isSelected = selectedCardIds.has(card.cardId);
          const isNewlyPicked = newlyPickedCardId === card.cardId;
          const isWild =
            wildJokerCard !== null &&
            wildJokerCard !== undefined &&
            !card.isPrintedJoker &&
            (wildJokerCard.isPrintedJoker ? card.rank === 'A' : card.rank === wildJokerCard.rank);

          return (
            <div
              key={card.cardId}
              draggable
              onDragStart={(e) => onCardDragStart && onCardDragStart(e, card, group.id)}
              style={{
                marginLeft: idx === 0 ? 0 : `${cardOverlap}px`,
                zIndex: isSelected ? 30 : isNewlyPicked ? 25 : idx + 1,
              }}
              className="transition-transform duration-150 ease-out cursor-pointer hover:z-20"
            >
              <PlayingCard
                card={card}
                isWildJoker={isWild}
                isSelected={isSelected}
                isNewlyPicked={isNewlyPicked}
                size={size}
                onClick={() => onCardClick && onCardClick(card)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
