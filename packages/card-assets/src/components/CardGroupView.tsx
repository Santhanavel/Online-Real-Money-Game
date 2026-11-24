import React from 'react';
import { Card, CardGroup, MeldType } from '@rummy/shared-types';
import { PlayingCard } from './PlayingCard';

export interface CardGroupViewProps {
  group: CardGroup;
  selectedCardIds: Set<string>;
  wildJokerCard?: Card | null;
  newlyPickedCardId?: string | null;
  draggedCardId?: string | null;
  isDragOverTarget?: boolean;
  onCardClick?: (card: Card) => void;
  onCardDragStart?: (e: React.DragEvent, card: Card, groupId: string) => void;
  onCardDragOver?: (e: React.DragEvent, groupId: string, cardIndex?: number) => void;
  onCardDrop?: (e: React.DragEvent, targetGroupId: string, cardIndex?: number) => void;
  onCardPointerDown?: (e: React.PointerEvent, card: Card, groupId: string) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  points?: number;
}

export const CardGroupView: React.FC<CardGroupViewProps> = ({
  group,
  selectedCardIds,
  wildJokerCard,
  newlyPickedCardId,
  draggedCardId,
  isDragOverTarget = false,
  onCardClick,
  onCardDragStart,
  onCardDragOver,
  onCardDrop,
  onCardPointerDown,
  size = 'md',
  className = '',
  points = 0,
}) => {
  // RummyCulture-style compact status tags (subtle, non-dominating)
  const getBadgeConfig = (meldType?: MeldType) => {
    switch (meldType) {
      case 'PURE_SEQUENCE':
        return {
          bg: '#047857', // Emerald
          text: '#ECFDF5',
          label: 'Pure Seq',
          border: '1px solid rgba(52, 211, 153, 0.5)',
          isPure: true,
        };
      case 'IMPURE_SEQUENCE':
        return {
          bg: '#1D4ED8', // Deep Blue
          text: '#EFF6FF',
          label: 'Impure Seq',
          border: '1px solid rgba(96, 165, 250, 0.5)',
          isPure: false,
        };
      case 'SET':
        return {
          bg: '#B45309', // Warm Amber
          text: '#FFFBEB',
          label: 'Set',
          border: '1px solid rgba(251, 191, 36, 0.5)',
          isPure: false,
        };
      case 'INVALID':
      default:
        return {
          bg: 'rgba(30, 41, 59, 0.85)', // Subtle Slate
          text: '#94A3B8',
          label: points > 0 ? `${points} pts` : 'Ungrouped',
          border: '1px solid rgba(100, 116, 139, 0.3)',
          isPure: false,
        };
    }
  };

  const badge = getBadgeConfig(group.meldType);
  // Tightly matched overlap leaving ~22px left index visible for rank and suit (matches RummyCulture reference)
  const cardOverlap = size === 'sm' ? -36 : size === 'md' ? -48 : size === 'lg' ? -54 : -72;

  return (
    <div
      data-drop-zone="group"
      data-group-id={group.id}
      onDragOver={event => onCardDragOver?.(event, group.id)}
      onDrop={event => { event.preventDefault(); onCardDrop?.(event, group.id); }}
      className={`inline-flex flex-col items-center px-0.5 py-0 select-none relative ${
        isDragOverTarget ? 'ring-2 ring-amber-400/80 rounded-lg' : ''
      } ${className}`}
    >
      {/* Cards Row with controlled cascading overlap */}
      <div className="flex items-center px-0 pt-0 pb-0 touch-manipulation">
        {group.cards.map((card, idx) => {
          const isSelected = selectedCardIds.has(card.cardId);
          const isNewlyPicked = newlyPickedCardId === card.cardId;
          const isBeingDragged = draggedCardId === card.cardId;
          const isWild =
            wildJokerCard !== null &&
            wildJokerCard !== undefined &&
            !card.isPrintedJoker &&
            (wildJokerCard.isPrintedJoker ? card.rank === 'A' : card.rank === wildJokerCard.rank);

          return (
            <div
              key={card.cardId}
              data-card-index={idx}
              data-card-id={card.cardId}
              onPointerDown={(e) => onCardPointerDown && onCardPointerDown(e, card, group.id)}
              style={{
                marginLeft: idx === 0 ? 0 : `${cardOverlap}px`,
                zIndex: idx + 1,
                opacity: isBeingDragged ? 0.55 : 1,
              }}
              className="transition-transform duration-100 ease-out cursor-pointer touch-none select-none"
            >
              <PlayingCard
                card={card}
                isWildJoker={isWild}
                isSelected={isSelected}
                isNewlyPicked={isNewlyPicked}
                isDragging={isBeingDragged}
                size={size}
                onClick={onCardClick ? () => onCardClick(card) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
