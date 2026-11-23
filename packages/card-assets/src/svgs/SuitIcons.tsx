import React from 'react';
import { Suit } from '@rummy/shared-types';

interface SuitIconProps {
  suit: Suit;
  className?: string;
  size?: number;
  color?: string;
}

export const SuitIcon: React.FC<SuitIconProps> = ({ suit, className = '', size = 16, color }) => {
  const redColor = color || '#DC2626';
  const blackColor = color || '#0F172A';

  switch (suit) {
    case 'HEARTS':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={redColor}
          className={className}
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );

    case 'DIAMONDS':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={redColor}
          className={className}
        >
          <path d="M12 2L3 12l9 10 9-10L12 2z" />
        </svg>
      );

    case 'CLUBS':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={blackColor}
          className={className}
        >
          <path d="M19 10.5a3.5 3.5 0 0 0-4.9-3.2 4 4 0 0 0-7.2 0 3.5 3.5 0 0 0-1.4 6.7 3.5 3.5 0 0 0 4.5 2.3l-1 4.7h4l-1-4.7a3.5 3.5 0 0 0 4.5-2.3 3.5 3.5 0 0 0 1.5-3.5z" />
        </svg>
      );

    case 'SPADES':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={blackColor}
          className={className}
        >
          <path d="M12 2.5C9.8 6 4 10.8 4 15a4.5 4.5 0 0 0 7 3.7l-1 3.8h4l-1-3.8A4.5 4.5 0 0 0 20 15c0-4.2-5.8-9-8-12.5z" />
        </svg>
      );

    default:
      return null;
  }
};
