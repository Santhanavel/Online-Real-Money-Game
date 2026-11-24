import React from 'react';
import { Rank, Suit } from '@rummy/shared-types';

interface FaceArtworkProps {
  rank: Rank;
  suit: Suit;
  className?: string;
}

export const FaceArtwork: React.FC<FaceArtworkProps> = ({ rank, suit, className = '' }) => {
  const isRed = suit === 'HEARTS' || suit === 'DIAMONDS';
  const primaryColor = isRed ? '#C81E27' : '#1A2332';
  const secondaryColor = isRed ? '#F87171' : '#60A5FA';
  const goldColor = '#D4AF37';
  const goldAccent = '#F59E0B';
  const robeColor = isRed ? '#881337' : '#1E3A8A';

  if (rank === 'JOKER') {
    return (
      <svg viewBox="0 0 100 120" className={className} width="100%" height="100%">
        {/* Two-Tone Jester Cap with bells */}
        <path d="M50 35 C35 15 15 22 12 45 C25 42 40 45 50 50 Z" fill="#7C3AED" />
        <path d="M50 35 C65 15 85 22 88 45 C75 42 60 45 50 50 Z" fill="#DC2626" />
        <path d="M50 30 C50 10 50 8 50 6" stroke={goldAccent} strokeWidth="3" />
        <circle cx="12" cy="45" r="4.5" fill={goldAccent} stroke="#78350F" strokeWidth="1" />
        <circle cx="88" cy="45" r="4.5" fill={goldAccent} stroke="#78350F" strokeWidth="1" />
        <circle cx="50" cy="6" r="4.5" fill={goldAccent} stroke="#78350F" strokeWidth="1" />

        {/* Jester Head & Face */}
        <circle cx="50" cy="58" r="18" fill="#FEE2E2" />
        {/* Mask / Cheek Art */}
        <circle cx="43" cy="55" r="2.5" fill="#1E293B" />
        <circle cx="57" cy="55" r="2.5" fill="#1E293B" />
        <circle cx="39" cy="60" r="3" fill="#F43F5E" opacity="0.4" />
        <circle cx="61" cy="60" r="3" fill="#F43F5E" opacity="0.4" />
        {/* Smiling Mouth */}
        <path d="M42 64 Q50 72 58 64" stroke="#BE123C" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Jester Ruffled Collar */}
        <polygon points="50,72 38,88 44,78 30,92 40,82 50,76 60,82 70,92 56,78 62,88" fill={goldColor} />
        <circle cx="30" cy="92" r="3" fill="#DC2626" />
        <circle cx="50" cy="90" r="3" fill="#7C3AED" />
        <circle cx="70" cy="92" r="3" fill="#DC2626" />

        {/* Jester Tunic */}
        <path d="M25 94 L75 94 L78 116 L22 116 Z" fill="#4B5563" />
        <path d="M25 94 L50 94 L48 116 L22 116 Z" fill="#7C3AED" />
        <path d="M50 94 L75 94 L78 116 L48 116 Z" fill="#DC2626" />
      </svg>
    );
  }

  if (rank === 'K') {
    return (
      <svg viewBox="0 0 100 120" className={className} width="100%" height="100%">
        {/* Ornate Gold Crown */}
        <path
          d="M26 38 L32 18 L42 28 L50 14 L58 28 L68 18 L74 38 Z"
          fill={goldColor}
          stroke="#92400E"
          strokeWidth="1.5"
        />
        {/* Crown Jewels */}
        <circle cx="32" cy="18" r="2.5" fill="#DC2626" />
        <circle cx="50" cy="14" r="3" fill="#2563EB" />
        <circle cx="68" cy="18" r="2.5" fill="#DC2626" />
        <circle cx="42" cy="33" r="2" fill="#10B981" />
        <circle cx="58" cy="33" r="2" fill="#10B981" />
        <rect x="26" y="35" width="48" height="5" fill="#B45309" rx="1" />

        {/* Royal Head & Hair */}
        <path d="M26 38 Q22 55 26 70 Q32 60 34 45 Z" fill="#92400E" />
        <path d="M74 38 Q78 55 74 70 Q68 60 66 45 Z" fill="#92400E" />
        <rect x="34" y="38" width="32" height="28" rx="4" fill="#FEE2E2" />

        {/* Classic King Beard & Mustache */}
        <path d="M38 56 Q50 62 62 56 Q66 60 60 76 Q50 82 40 76 Q34 60 38 56 Z" fill="#B45309" />
        <path d="M42 56 Q50 60 58 56" stroke="#78350F" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* Eyes & Royal Brow */}
        <circle cx="42" cy="48" r="2" fill="#1E293B" />
        <circle cx="58" cy="48" r="2" fill="#1E293B" />
        <path d="M38 45 L46 46" stroke="#78350F" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M62 45 L54 46" stroke="#78350F" strokeWidth="1.8" strokeLinecap="round" />

        {/* Royal Ornate Ermine Mantle & Robe */}
        <path d="M18 78 Q50 68 82 78 L86 116 L14 116 Z" fill={robeColor} />
        {/* Robe Collar / Gold Trim */}
        <path d="M30 76 L50 96 L70 76 L66 84 L50 102 L34 84 Z" fill={goldColor} />
        {/* Sword / Scepter in Hand */}
        <rect x="18" y="70" width="5" height="36" fill={goldColor} stroke="#78350F" strokeWidth="1" rx="1" />
        <circle cx="20.5" cy="67" r="4" fill="#DC2626" />
        <rect x="14" y="76" width="13" height="3" fill={goldColor} rx="1" />
        {/* Ermine Spots */}
        <circle cx="38" cy="110" r="1.5" fill="#FFFFFF" />
        <circle cx="50" cy="112" r="1.5" fill="#FFFFFF" />
        <circle cx="62" cy="110" r="1.5" fill="#FFFFFF" />
      </svg>
    );
  }

  if (rank === 'Q') {
    return (
      <svg viewBox="0 0 100 120" className={className} width="100%" height="100%">
        {/* Ornate Queen Tiara */}
        <path d="M30 36 Q50 16 70 36 L66 40 L34 40 Z" fill={goldColor} stroke="#92400E" strokeWidth="1.2" />
        <circle cx="50" cy="22" r="3" fill="#EC4899" />
        <circle cx="38" cy="30" r="2" fill="#3B82F6" />
        <circle cx="62" cy="30" r="2" fill="#3B82F6" />

        {/* Flowing Queen Hair */}
        <path d="M28 38 Q18 60 26 80 Q34 68 32 46 Z" fill="#92400E" />
        <path d="M72 38 Q82 60 74 80 Q66 68 68 46 Z" fill="#92400E" />

        {/* Queen Face */}
        <circle cx="50" cy="52" r="16" fill="#FEE2E2" />

        {/* Eyes & Rosy Smile */}
        <circle cx="43" cy="50" r="2" fill="#1E293B" />
        <circle cx="57" cy="50" r="2" fill="#1E293B" />
        <path d="M46 60 Q50 64 54 60" stroke="#E11D48" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="39" cy="54" r="2.5" fill="#F43F5E" opacity="0.3" />
        <circle cx="61" cy="54" r="2.5" fill="#F43F5E" opacity="0.3" />

        {/* Pearl Necklace */}
        <path d="M40 68 Q50 74 60 68" stroke="#FFFFFF" strokeWidth="2.5" strokeDasharray="3 2" fill="none" />

        {/* Royal Gown */}
        <path d="M20 78 Q50 68 80 78 L84 116 L16 116 Z" fill={primaryColor} />
        {/* Flower / Scepter */}
        <line x1="74" y1="72" x2="74" y2="108" stroke={goldColor} strokeWidth="3" />
        <circle cx="74" cy="70" r="4.5" fill="#F43F5E" stroke={goldColor} strokeWidth="1" />
        <path d="M34 82 L50 102 L66 82 L60 116 L40 116 Z" fill={secondaryColor} opacity="0.75" />
        <path d="M48 82 L52 82 L52 116 L48 116 Z" fill={goldColor} />
      </svg>
    );
  }

  if (rank === 'J') {
    return (
      <svg viewBox="0 0 100 120" className={className} width="100%" height="100%">
        {/* Jack Feathered Cap */}
        <path d="M28 36 Q50 18 72 32 L68 40 L30 40 Z" fill="#2563EB" />
        {/* Red Feather */}
        <path d="M34 26 Q42 8 50 4 Q44 18 42 28 Z" fill="#EF4444" />
        <circle cx="36" cy="36" r="3" fill={goldColor} />

        {/* Jack Hair & Face */}
        <path d="M28 40 Q22 58 28 72 Q34 60 32 44 Z" fill="#B45309" />
        <path d="M72 40 Q78 58 72 72 Q66 60 68 44 Z" fill="#B45309" />
        <circle cx="50" cy="52" r="16" fill="#FED7AA" />

        {/* Young Warrior Face Details */}
        <circle cx="43" cy="50" r="2" fill="#1E293B" />
        <circle cx="57" cy="50" r="2" fill="#1E293B" />
        <path d="M40 46 L47 47" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M60 46 L53 47" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M46 61 Q50 63 54 61" stroke="#92400E" strokeWidth="1.8" fill="none" strokeLinecap="round" />

        {/* Halberd / Lance Shaft */}
        <rect x="20" y="62" width="4" height="46" fill="#78350F" />
        <polygon points="22,48 16,62 28,62" fill="#94A3B8" stroke="#475569" strokeWidth="1" />

        {/* Royal Court Tunic */}
        <path d="M24 76 Q50 68 76 76 L80 116 L20 116 Z" fill={primaryColor} />
        {/* Striped Royal Guard Sash */}
        <polygon points="34,74 44,72 68,116 58,116" fill={goldColor} />
        <polygon points="46,72 56,72 80,116 70,116" fill="#DC2626" />
      </svg>
    );
  }

  return null;
};
