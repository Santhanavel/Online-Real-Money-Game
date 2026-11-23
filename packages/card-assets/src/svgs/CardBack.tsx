import React from 'react';

interface CardBackProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export const CardBack: React.FC<CardBackProps> = ({
  className = '',
  width = '100%',
  height = '100%',
}) => {
  return (
    <svg
      viewBox="0 0 140 190"
      className={className}
      width={width}
      height={height}
      style={{ borderRadius: '8px', overflow: 'hidden' }}
    >
      <defs>
        <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#064E3B" />
          <stop offset="50%" stopColor="#047857" />
          <stop offset="100%" stopColor="#064E3B" />
        </linearGradient>

        <pattern id="cardPattern" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M8 0 L16 8 L8 16 L0 8 Z" fill="none" stroke="#F59E0B" strokeWidth="0.8" opacity="0.35" />
          <circle cx="8" cy="8" r="1.5" fill="#F59E0B" opacity="0.4" />
        </pattern>
      </defs>

      {/* White outer card border */}
      <rect x="0" y="0" width="140" height="190" rx="8" fill="#F8FAFC" />

      {/* Emerald Card Back Body */}
      <rect x="5" y="5" width="130" height="180" rx="6" fill="url(#emeraldGrad)" stroke="#F59E0B" strokeWidth="1.5" />

      {/* Inner repeating pattern */}
      <rect x="10" y="10" width="120" height="170" rx="4" fill="url(#cardPattern)" />

      {/* Center Gold Filigree Medallion */}
      <circle cx="70" cy="95" r="26" fill="#064E3B" stroke="#F59E0B" strokeWidth="2.5" />
      <circle cx="70" cy="95" r="21" fill="none" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3,2" />

      {/* Center Golden Star */}
      <polygon
        points="70,78 74,88 85,89 77,97 79,108 70,102 61,108 63,97 55,89 66,88"
        fill="#F59E0B"
      />
    </svg>
  );
};
