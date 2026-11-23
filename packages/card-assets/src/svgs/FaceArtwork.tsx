import React from 'react';
import { Rank, Suit } from '@rummy/shared-types';

interface FaceArtworkProps {
  rank: Rank;
  suit: Suit;
  className?: string;
}

export const FaceArtwork: React.FC<FaceArtworkProps> = ({ rank, suit, className = '' }) => {
  const isRed = suit === 'HEARTS' || suit === 'DIAMONDS';
  const primaryColor = isRed ? '#E11D48' : '#1E293B';
  const goldColor = '#F59E0B';

  if (rank === 'JOKER') {
    return (
      <svg viewBox="0 0 100 120" className={className} width="100%" height="100%">
        {/* Jester Hat */}
        <path d="M20 50 Q30 15 50 25 Q70 15 80 50 Z" fill="#9333EA" />
        <circle cx="20" cy="50" r="6" fill={goldColor} />
        <circle cx="50" cy="22" r="6" fill={goldColor} />
        <circle cx="80" cy="50" r="6" fill={goldColor} />
        {/* Face */}
        <circle cx="50" cy="65" r="22" fill="#FED7AA" />
        {/* Eyes & Smile */}
        <circle cx="43" cy="62" r="3" fill="#1E293B" />
        <circle cx="57" cy="62" r="3" fill="#1E293B" />
        <path d="M42 74 Q50 82 58 74" stroke="#E11D48" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Jester Collar */}
        <path d="M30 85 L40 105 L50 88 L60 105 L70 85 Z" fill={goldColor} />
      </svg>
    );
  }

  if (rank === 'K') {
    return (
      <svg viewBox="0 0 100 120" className={className} width="100%" height="100%">
        {/* King Crown */}
        <path d="M25 40 L35 22 L50 32 L65 22 L75 40 Z" fill={goldColor} stroke="#B45309" strokeWidth="2" />
        <circle cx="35" cy="20" r="3" fill="#EF4444" />
        <circle cx="50" cy="29" r="3" fill="#3B82F6" />
        <circle cx="65" cy="20" r="3" fill="#EF4444" />
        {/* Royal Beard & Face */}
        <rect x="35" y="40" width="30" height="28" rx="6" fill="#FEE2E2" />
        <path d="M34 58 Q50 82 66 58" fill={primaryColor} />
        {/* Eyes & Brow */}
        <line x1="40" y1="48" x2="46" y2="48" stroke="#1E293B" strokeWidth="2" />
        <line x1="54" y1="48" x2="60" y2="48" stroke="#1E293B" strokeWidth="2" />
        {/* Robe */}
        <path d="M20 85 Q50 65 80 85 L85 115 L15 115 Z" fill={primaryColor} opacity="0.9" />
        <path d="M45 80 L50 115 L55 80 Z" fill={goldColor} />
      </svg>
    );
  }

  if (rank === 'Q') {
    return (
      <svg viewBox="0 0 100 120" className={className} width="100%" height="100%">
        {/* Queen Tiara */}
        <path d="M30 38 Q50 18 70 38 L65 42 L35 42 Z" fill={goldColor} stroke="#B45309" strokeWidth="1.5" />
        <circle cx="50" cy="24" r="4" fill="#EC4899" />
        {/* Hair */}
        <path d="M30 42 Q20 65 32 80 Q50 50 68 80 Q80 65 70 42 Z" fill="#92400E" />
        {/* Face */}
        <circle cx="50" cy="55" r="16" fill="#FEE2E2" />
        {/* Eyes & Smile */}
        <circle cx="44" cy="53" r="2" fill="#1E293B" />
        <circle cx="56" cy="53" r="2" fill="#1E293B" />
        <path d="M46 63 Q50 67 54 63" stroke="#E11D48" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Royal Gown */}
        <path d="M22 85 Q50 72 78 85 L82 115 L18 115 Z" fill={primaryColor} opacity="0.85" />
      </svg>
    );
  }

  if (rank === 'J') {
    return (
      <svg viewBox="0 0 100 120" className={className} width="100%" height="100%">
        {/* Jack Hat */}
        <path d="M30 36 Q50 15 72 32 L68 40 L32 40 Z" fill="#3B82F6" />
        <path d="M40 22 Q48 10 52 5" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />
        {/* Face */}
        <circle cx="50" cy="56" r="16" fill="#FED7AA" />
        {/* Hair */}
        <path d="M34 44 Q30 65 35 72" stroke="#B45309" strokeWidth="4" fill="none" />
        <path d="M66 44 Q70 65 65 72" stroke="#B45309" strokeWidth="4" fill="none" />
        {/* Eyes */}
        <circle cx="44" cy="54" r="2" fill="#1E293B" />
        <circle cx="56" cy="54" r="2" fill="#1E293B" />
        {/* Coat */}
        <path d="M25 80 Q50 70 75 80 L80 115 L20 115 Z" fill={primaryColor} />
        <path d="M48 76 L52 76 L52 115 L48 115 Z" fill={goldColor} />
      </svg>
    );
  }

  return null;
};
