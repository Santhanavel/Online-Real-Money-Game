import React from 'react';
import { Card } from '@rummy/shared-types';
import { CardBack } from '../svgs/CardBack';
import { FaceArtwork } from '../svgs/FaceArtwork';
import { SuitIcon } from '../svgs/SuitIcons';

export interface PlayingCardProps {
  card: Card;
  isWildJoker?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  isFaceDown?: boolean;
  isDragging?: boolean;
  isNewlyPicked?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
  customBadge?: string;
}

const SIZE_STYLES: Record<'sm' | 'md' | 'lg' | 'xl', {
  width: number;
  height: number;
  rankFontSize: number;
  suitIconSize: number;
  centerPipSize: number;
}> = {
  sm: { width: 54, height: 76, rankFontSize: 15, suitIconSize: 13, centerPipSize: 24 },
  md: { width: 72, height: 102, rankFontSize: 19, suitIconSize: 16, centerPipSize: 34 },
  lg: { width: 90, height: 126, rankFontSize: 23, suitIconSize: 19, centerPipSize: 42 },
  xl: { width: 110, height: 154, rankFontSize: 28, suitIconSize: 23, centerPipSize: 52 },
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  isWildJoker = false,
  isSelected = false,
  isDisabled = false,
  isFaceDown = false,
  isDragging = false,
  isNewlyPicked = false,
  size = 'md',
  onClick,
  className = '',
  customBadge,
}) => {
  const dims = SIZE_STYLES[size];
  const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS';
  const textColor = isRed ? '#DC2626' : '#0F172A';
  const isFaceCard = ['J', 'Q', 'K'].includes(card.rank) || card.rank === 'JOKER' || card.isPrintedJoker;

  if (isFaceDown) {
    return (
      <div
        onClick={onClick}
        style={{
          width: `${dims.width}px`,
          height: `${dims.height}px`,
          cursor: onClick ? 'pointer' : 'default',
        }}
        className={`relative select-none transition-transform duration-150 ease-out shadow-lg rounded-xl overflow-hidden border border-amber-500/30 ${className}`}
      >
        <CardBack width={dims.width} height={dims.height} />
      </div>
    );
  }

  return (
    <div
      onClick={!isDisabled ? onClick : undefined}
      style={{
        width: `${dims.width}px`,
        height: `${dims.height}px`,
        cursor: isDisabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
        transform: isSelected ? 'translateY(-10px)' : isNewlyPicked ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isSelected
          ? '0 6px 14px rgba(245, 158, 11, 0.45), 0 0 0 2px #F59E0B'
          : isNewlyPicked
          ? '0 4px 12px rgba(56, 189, 248, 0.4), 0 0 0 2px #38BDF8'
          : '0 2px 6px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)',
        opacity: isDisabled ? 0.4 : isDragging ? 0.7 : 1,
      }}
      className={`relative select-none bg-white rounded-xl transition-all duration-200 ease-out border border-slate-300/80 overflow-hidden ${
        isNewlyPicked ? 'animate-pulse' : ''
      } ${className}`}
    >
      {/* Subtle card sheen */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-transparent to-black/[0.03] pointer-events-none" />

      {/* Top Left Corner Index Pip (Crucial for stacked card readability!) */}
      <div
        className="absolute top-1 left-1.5 flex flex-col items-center leading-none z-10"
        style={{ color: textColor }}
      >
        <div className="flex items-center gap-0.5">
          <span
            className="font-black tracking-tight"
            style={{ fontSize: `${dims.rankFontSize}px`, lineHeight: 1 }}
          >
            {card.isPrintedJoker ? 'JK' : card.rank}
          </span>
          {/* Mini Joker Star for Wild Card Stack Visibility */}
          {isWildJoker && (
            <span
              className="text-amber-500 font-bold leading-none"
              style={{ fontSize: `${Math.max(10, dims.rankFontSize - 5)}px` }}
              title="Wild Joker"
            >
              ★
            </span>
          )}
        </div>
        {!card.isPrintedJoker && card.suit !== 'NONE' && (
          <div className="mt-0.5">
            <SuitIcon suit={card.suit} size={dims.suitIconSize} />
          </div>
        )}
      </div>

      {/* Center Artwork or Pip */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-2.5">
        {isFaceCard ? (
          <div className="w-full h-full max-w-[75%] max-h-[75%] flex items-center justify-center">
            <FaceArtwork rank={card.rank} suit={card.suit} />
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <SuitIcon suit={card.suit} size={dims.centerPipSize} />
          </div>
        )}
      </div>

      {/* Bottom Right Corner Pip (Inverted for realistic card symmetry) */}
      <div
        className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180 z-10"
        style={{ color: textColor }}
      >
        <span
          className="font-black tracking-tight"
          style={{ fontSize: `${dims.rankFontSize}px`, lineHeight: 1 }}
        >
          {card.isPrintedJoker ? 'JK' : card.rank}
        </span>
        {!card.isPrintedJoker && card.suit !== 'NONE' && (
          <div className="mt-0.5">
            <SuitIcon suit={card.suit} size={dims.suitIconSize} />
          </div>
        )}
      </div>

      {/* Printed Joker Bottom Ribbon */}
      {card.isPrintedJoker && (
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
            color: '#FFFFFF',
            fontSize: size === 'sm' ? '8px' : '9px',
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: '9999px',
            letterSpacing: '0.05em',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            zIndex: 20,
          }}
        >
          JOKER
        </div>
      )}

      {/* Custom badge if passed */}
      {customBadge && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            backgroundColor: '#1E293B',
            color: '#FFFFFF',
            fontSize: '8px',
            fontWeight: 700,
            padding: '1px 4px',
            borderRadius: '4px',
            zIndex: 20,
          }}
        >
          {customBadge}
        </div>
      )}
    </div>
  );
};
