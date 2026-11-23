import React from 'react';

interface TurnTimerProps {
  remainingSec: number;
  totalSec?: number;
  size?: number;
}

export const TurnTimer: React.FC<TurnTimerProps> = ({
  remainingSec,
  totalSec = 30,
  size = 52,
}) => {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, remainingSec / totalSec));
  const strokeDashoffset = circumference * (1 - progress);

  const getColor = () => {
    if (remainingSec > 15) return '#10B981'; // green
    if (remainingSec > 7) return '#F59E0B';  // amber
    return '#EF4444';                       // red
  };

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated countdown ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-linear"
        />
      </svg>
      <span
        className="absolute font-black text-sm tracking-tight"
        style={{ color: getColor() }}
      >
        {remainingSec}
      </span>
    </div>
  );
};
