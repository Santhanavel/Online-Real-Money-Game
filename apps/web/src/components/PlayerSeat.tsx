import React from 'react';
import { PlayerPublicInfo } from '@rummy/shared-types';
import { CardBack } from '@rummy/card-assets';
import { TurnTimer } from './TurnTimer';

interface PlayerSeatProps {
  player: PlayerPublicInfo;
  isSelf?: boolean;
  hasJustDrawn?: { source: 'CLOSED_DECK' | 'OPEN_DISCARD' } | null;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({ player, isSelf = false, hasJustDrawn = null }) => {
  const isTurn = player.isTurn;
  const isDropped = player.status === 'DROPPED';
  const isEliminated = player.status === 'ELIMINATED';

  return (
    <div className="flex flex-col items-center select-none relative">
      {/* Outer halo when active turn */}
      <div
        className={`relative p-1 rounded-full transition-all duration-300 ${
          isTurn
            ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-emerald-950 animate-pulse'
            : 'border-2 border-white/20'
        }`}
      >
        {/* Avatar */}
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden bg-slate-800 border-2 border-amber-300/40 relative shadow-lg">
          <img
            src={player.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.username}`}
            alt={player.username}
            className="w-full h-full object-cover"
          />
          {isDropped && (
            <div className="absolute inset-0 bg-red-900/85 flex items-center justify-center font-black text-[9px] text-white tracking-wider">
              DROPPED
            </div>
          )}
          {isEliminated && (
            <div className="absolute inset-0 bg-red-950/90 flex items-center justify-center font-black text-[9px] text-red-200 tracking-wider">
              OUT
            </div>
          )}
        </div>

        {/* Turn timer floating overlay */}
        {isTurn && player.turnRemainingSec !== undefined && (
          <div className="absolute -top-2 -right-2 z-20 bg-slate-900/95 rounded-full p-0.5 shadow-xl border border-amber-400/40">
            <TurnTimer remainingSec={player.turnRemainingSec} size={34} />
          </div>
        )}

        {/* Floating draw animation badge for opponent */}
        {hasJustDrawn && !isSelf && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black text-[9px] shadow-xl animate-bounce whitespace-nowrap">
            Drew {hasJustDrawn.source === 'CLOSED_DECK' ? 'Deck' : 'Discard'} 🎴
          </div>
        )}
      </div>

      {/* Username & Score Badge */}
      <div className="mt-1 flex flex-col items-center">
        <div className="bg-black/80 px-2.5 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1.5 shadow-md">
          <span className="text-[11px] md:text-xs font-bold text-amber-200 truncate max-w-[85px] md:max-w-[110px]">
            {player.username} {isSelf && '(You)'}
          </span>
          {player.totalPoolScore > 0 && (
            <span className="text-[9px] font-bold text-rose-300 bg-rose-950/70 px-1 rounded">
              {player.totalPoolScore} pts
            </span>
          )}
        </div>

        {/* Card count stack for opponents */}
        {!isSelf && player.status === 'ACTIVE' && (
          <div className="flex items-center gap-1 mt-0.5 bg-emerald-950/90 px-2 py-0.5 rounded-md border border-emerald-500/30 text-[10px] text-emerald-200 font-semibold shadow-sm">
            <div className="w-3 h-4 inline-block">
              <CardBack width={12} height={16} />
            </div>
            <span>{player.cardCount} cards</span>
          </div>
        )}
      </div>
    </div>
  );
};
