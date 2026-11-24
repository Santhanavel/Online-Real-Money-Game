import React from 'react';
import { PlayerPublicInfo } from '@rummy/shared-types';
import { CardBack } from '@rummy/card-assets';

interface PlayerSeatProps {
  player: PlayerPublicInfo;
  isSelf?: boolean;
  isDealer?: boolean;
  hasTossWin?: boolean;
  hasJustDrawn?: { source: 'CLOSED_DECK' | 'OPEN_DISCARD' } | null;
  className?: string;
  totalTurnDurationSec?: number;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isSelf = false,
  isDealer = false,
  hasTossWin = false,
  hasJustDrawn = null,
  className = '',
  totalTurnDurationSec = 30,
}) => {
  const isTurn = player.isTurn;
  const isDropped = player.status === 'DROPPED';
  const isEliminated = player.status === 'ELIMINATED';
  const remainingSec = player.turnRemainingSec ?? 0;

  // Circular timer calculations (Issue 4)
  const radius = 27;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.max(0, Math.min(1, remainingSec / totalTurnDurationSec));
  const strokeDashoffset = circumference * (1 - progressRatio);

  const timerColor =
    remainingSec > 10
      ? '#10B981' // Emerald
      : remainingSec > 5
      ? '#F59E0B' // Amber
      : '#EF4444'; // Red warning

  return (
    <div className={`flex flex-col items-center select-none relative z-20 ${className}`}>
      {/* Avatar Container with Integrated Circular Countdown Ring */}
      <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
        {/* SVG Circular Countdown Ring around Avatar (Only on Active Player) */}
        {isTurn && remainingSec > 0 && (
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-30">
            {/* Background track */}
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              fill="transparent"
              stroke="#1e293b"
              strokeWidth="3.5"
            />
            {/* Animated Progress Sweep */}
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              fill="transparent"
              stroke={timerColor}
              strokeWidth="3.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300 ease-linear"
            />
          </svg>
        )}

        {/* Circular Avatar */}
        <div
          className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full overflow-hidden bg-slate-900 relative flex items-center justify-center transition-all duration-300 ${
            isTurn
              ? 'ring-2 ring-amber-400 shadow-xl shadow-amber-400/40'
              : 'border border-slate-700/80 shadow-md'
          }`}
        >
          <img
            src={player.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.username}`}
            alt={player.username}
            className="w-full h-full object-cover"
          />

          {/* Dropped Overlay */}
          {isDropped && (
            <div className="absolute inset-0 bg-red-950/90 backdrop-blur-[1px] flex items-center justify-center font-black text-[9px] text-red-200 tracking-wider">
              DROP
            </div>
          )}

          {/* Eliminated Overlay */}
          {isEliminated && (
            <div className="absolute inset-0 bg-black/92 flex items-center justify-center font-black text-[9px] text-rose-400 tracking-wider">
              OUT
            </div>
          )}
        </div>

        {/* Numeric Remaining Seconds Badge (Centered at bottom of avatar) */}
        {isTurn && remainingSec > 0 && (
          <div
            style={{ backgroundColor: timerColor }}
            className={`absolute -bottom-1 z-35 px-1.5 py-0.2 rounded-full text-slate-950 font-black text-[9px] font-mono shadow-md ${
              remainingSec <= 5 ? 'animate-bounce' : ''
            }`}
          >
            {remainingSec}s
          </div>
        )}

        {/* Dealer 'D' Button */}
        {isDealer && (
          <div
            className="absolute -top-0.5 -left-0.5 z-25 w-5 h-5 rounded-full bg-amber-400 border border-amber-600 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-md"
            title="Dealer"
          >
            D
          </div>
        )}

        {/* TOSS WIN Ribbon Badge matching RummyCulture Video Sheet 0 */}
        {hasTossWin && (
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-[8px] px-2 py-0.5 rounded-full shadow-lg border border-amber-200 whitespace-nowrap animate-pulse"
            title="Toss Winner"
          >
            TOSS WIN
          </div>
        )}

        {/* Floating draw action notification */}
        {hasJustDrawn && !isSelf && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black text-[9px] shadow-xl animate-bounce whitespace-nowrap border border-amber-200">
            Drew {hasJustDrawn.source === 'CLOSED_DECK' ? 'Deck' : 'Discard'} 🎴
          </div>
        )}
      </div>

      {/* Username & Score Pill matching RummyCulture Video */}
      <div className="mt-1 flex flex-col items-center">
        <div className="bg-[#052b17]/95 backdrop-blur-sm px-3 py-0.5 rounded-full border border-emerald-500/40 flex flex-col items-center shadow-lg leading-tight">
          <span className="text-[10px] sm:text-[11px] font-black text-white truncate max-w-[80px] sm:max-w-[100px]">
            {player.username} {isSelf && '(You)'}
          </span>
          <span className="text-[9px] font-bold text-amber-300">
            {player.totalPoolScore !== undefined ? `${player.totalPoolScore} pts` : '4,800'}
          </span>
        </div>

        {/* Card Count Pill for Opponents */}
        {!isSelf && player.status === 'ACTIVE' && (
          <div className="flex items-center gap-1 mt-0.5 bg-emerald-950/80 px-1.5 py-0.5 rounded text-[9px] text-emerald-300 font-bold border border-emerald-500/30 shadow-sm">
            <div className="w-2.5 h-3.5 inline-block">
              <CardBack width={10} height={14} />
            </div>
            <span>{player.cardCount} cards</span>
          </div>
        )}
      </div>
    </div>
  );
};
