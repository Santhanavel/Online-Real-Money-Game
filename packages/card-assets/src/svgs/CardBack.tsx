import React from 'react';

interface CardBackProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  colorTheme?: 'red' | 'emerald';
}

export const CardBack: React.FC<CardBackProps> = ({
  className = '',
  width = '100%',
  height = '100%',
  colorTheme = 'red',
}) => {
  const isRed = colorTheme === 'red';

  return (
    <svg
      viewBox="0 0 140 190"
      className={className}
      width={width}
      height={height}
      style={{ borderRadius: '8px', overflow: 'hidden' }}
    >
      <defs>
        <linearGradient id={isRed ? 'redGrad' : 'emeraldGrad'} x1="0%" y1="0%" x2="100%" y2="100%">
          {isRed ? (
            <>
              <stop offset="0%" stopColor="#7E0816" />
              <stop offset="50%" stopColor="#BA1222" />
              <stop offset="100%" stopColor="#62040E" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#064E3B" />
              <stop offset="50%" stopColor="#047857" />
              <stop offset="100%" stopColor="#064E3B" />
            </>
          )}
        </linearGradient>

        <pattern id="cardPattern" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="none" stroke="#F59E0B" strokeWidth="0.75" opacity="0.3" />
          <circle cx="7" cy="7" r="1.2" fill="#F59E0B" opacity="0.35" />
        </pattern>
      </defs>

      {/* White outer card border */}
      <rect x="0" y="0" width="140" height="190" rx="8" fill="#FFFFFF" />

      {/* Card Back Body */}
      <rect
        x="5"
        y="5"
        width="130"
        height="180"
        rx="6"
        fill={`url(#${isRed ? 'redGrad' : 'emeraldGrad'})`}
        stroke="#E2B144"
        strokeWidth="1.5"
      />

      {/* Inner repeating pattern */}
      <rect x="9" y="9" width="122" height="172" rx="4" fill="url(#cardPattern)" />

      {/* Center Medallion */}
      <circle cx="70" cy="95" r="28" fill={isRed ? '#62040E' : '#064E3B'} stroke="#F59E0B" strokeWidth="2.5" />
      <circle cx="70" cy="95" r="23" fill="none" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3,2" />

      {/* Stylized White 'R' Monogram (RummyCulture Standard) */}
      <text
        x="70"
        y="107"
        textAnchor="middle"
        fontFamily="sans-serif, Arial, Helvetica"
        fontSize="34"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="-1"
        style={{
          filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.6))',
          userSelect: 'none',
        }}
      >
        R
      </text>
    </svg>
  );
};
