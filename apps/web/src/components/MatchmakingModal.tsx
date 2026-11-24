'use client';

import React, { useEffect, useState } from 'react';
import { useGameSocket } from '../context/GameSocketContext';

export const MatchmakingModal: React.FC = () => {
  const {
    isSearching,
    matchmakingUiState,
    matchmakingTicket,
    waitingTable,
    matchmakingMessage,
    currentUser,
    cancelMatchmaking,
    dismissMatchmakingModal,
    joinMatchmaking,
  } = useGameSocket();

  // Local ticker to smoothly interpolate countdowns every 200ms
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);

  if (!isSearching || matchmakingUiState === 'IDLE') return null;

  const variant = waitingTable?.gameType || matchmakingTicket?.gameType || 'POINTS';
  const entryAmount = waitingTable?.entryAmount || matchmakingTicket?.entryAmount || 100;
  const pointValue = waitingTable?.pointValue || matchmakingTicket?.pointValue || (entryAmount / 80);
  const capacity = waitingTable?.tableCapacity || matchmakingTicket?.tableCapacity || 2;
  const occupiedCount = waitingTable?.occupiedSeatCount || 1;
  const seats = waitingTable?.seats || [];
  const matchmakingDeadline = waitingTable?.matchmakingDeadline;
  const gameStartsAt = waitingTable?.gameStartsAt;
  const serverCanLeave = waitingTable?.canLeave !== undefined ? waitingTable.canLeave : true;

  const getVariantLabel = () => {
    switch (variant) {
      case 'POINTS':
        return 'Points Rummy';
      case 'POOL_240':
      case 'POINTS_240':
        return 'Pool 240';
      case 'POOL_101':
        return 'Pool 101';
      case 'POOL_201':
        return 'Pool 201';
      default:
        return 'Points Rummy';
    }
  };

  // 3-second launch countdown
  const isCountingDown =
    matchmakingUiState === 'START_COUNTDOWN' ||
    matchmakingUiState === 'LOCKED' ||
    (gameStartsAt !== null && gameStartsAt !== undefined && gameStartsAt > now);

  const remainingStartSec = gameStartsAt
    ? Math.max(0, Math.ceil((gameStartsAt - now) / 1000))
    : 3;

  // Final boundary leave lock
  const isLocked =
    !serverCanLeave ||
    (matchmakingUiState as string) === 'LOCKED' ||
    (matchmakingUiState as string) === 'STARTING' ||
    matchmakingUiState === 'STARTED' ||
    (gameStartsAt !== null && gameStartsAt !== undefined && gameStartsAt - now <= 1000);

  // 60-second waiting period countdown
  const remainingWaitSec = matchmakingDeadline
    ? Math.max(0, Math.ceil((matchmakingDeadline - now) / 1000))
    : 60;

  const waitRatio = Math.max(0, Math.min(1, remainingWaitSec / 60));

  const isTerminalFailure = ['CANCELLED', 'EXPIRED', 'FAILED'].includes(matchmakingUiState);

  const tableIdShort = waitingTable?.tableId ? `#${waitingTable.tableId.slice(-7)}` : '#1603163';

  const joinedSeats = seats.filter(seat => seat.isOccupied);
  const waitingProfiles = joinedSeats.some(seat => seat.playerId === currentUser.userId)
    ? joinedSeats
    : [{ playerId: currentUser.userId, username: currentUser.username, avatarUrl: undefined }, ...joinedSeats];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#0a0b0f] select-none overflow-hidden animate-fade-in p-1 sm:p-2">
      {/* 1. TOP HEADER BAR matching RummyCulture Video */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-300 px-3 py-1.5 z-20 bg-black/60 border-b border-amber-500/25 rounded-b-xl">
        {/* Left: LEAVE Button */}
        <div className="flex items-center gap-2">
          {!isLocked && (
            <button
              onClick={cancelMatchmaking}
              className="px-2.5 py-1 rounded-md border border-white/30 hover:border-white text-white/85 hover:text-white font-extrabold text-[11px] tracking-wider transition bg-black/40 flex items-center gap-1 cursor-pointer"
              title="Leave Table"
            >
              <span>LEAVE</span>
              <span>←</span>
            </button>
          )}
        </div>

        {/* Center: Table Capsule (#Table_ID | Format | Stake) */}
        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black/75 border border-amber-500/35 text-[11px] sm:text-xs font-black shadow-inner">
          <span className="text-emerald-400 font-mono">{tableIdShort}</span>
          <span className="text-amber-500/60">•</span>
          <span className="text-amber-100">{getVariantLabel()}</span>
          <span className="text-amber-500/60">•</span>
          <span className="text-amber-300 font-extrabold">🪙 {entryAmount.toLocaleString()}</span>
          <span className="text-amber-500/60">•</span>
          <span className="text-slate-300">Deal 1</span>
        </div>

        {/* Right Tools: Rules, Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open('/rules', '_blank')}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black border border-slate-700 text-amber-200 font-bold flex items-center justify-center text-xs transition cursor-pointer"
            title="How to Play"
          >
            ⓘ
          </button>
        </div>
      </div>

      {/* 2. SUBHEADER COUNTDOWN BAR matching RummyCulture Sheet 0 */}
      <div className="w-full max-w-xl mx-auto mt-1 z-20 px-3">
        <div className="relative overflow-hidden bg-black/70 border border-amber-500/40 rounded-full px-4 py-1 text-center shadow-lg">
          {/* Animated Amber Progress Fill */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-600/40 to-amber-400/40 transition-all duration-300"
            style={{ width: `${waitRatio * 100}%` }}
          />
          <span className="relative z-10 text-[11px] sm:text-xs font-black text-amber-200 tracking-wide">
            {isCountingDown
              ? `Game starting in ${remainingStartSec} seconds...`
              : `This game should start in ${remainingWaitSec} seconds`}
          </span>
        </div>
      </div>

      {/* 3. CASINO GREEN STADIUM FELT TABLE (WAITING RADAR) */}
      <div className="w-full flex-1 flex items-center justify-center overflow-x-auto overflow-y-hidden py-1">
        <div className="relative w-full max-w-6xl waiting-felt rounded-[70px] sm:rounded-[120px] md:rounded-[150px] bg-[radial-gradient(ellipse_at_center,_#166a39_0%,_#0f4c27_50%,_#083119_80%,_#03190c_100%)] border-[8px] sm:border-[12px] border-[#7a4c16] shadow-[inset_0_0_100px_rgba(0,0,0,0.85),_0_0_0_3px_rgba(240,185,50,0.5),_0_25px_60px_rgba(0,0,0,0.95)] flex flex-col justify-between p-3 relative overflow-hidden select-none">
          {/* Golden Inset Ring */}
          <div className="absolute inset-2 sm:inset-3 rounded-[60px] sm:rounded-[110px] md:rounded-[140px] border border-amber-400/25 pointer-events-none" />

          {/* Table Left: Green "+ Game" Button & "Waiting..." Pill */}
          <div className="absolute left-4 bottom-4 z-30 flex items-center gap-2">
            <button
              onClick={() => {}}
              className="px-3.5 py-1 rounded-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white font-black text-xs border border-emerald-400/70 shadow-lg transition active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              <span className="text-sm font-bold">+</span>
              <span>Game</span>
            </button>
            <div className="px-3 py-1 rounded-full bg-black/60 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>Waiting...</span>
            </div>
          </div>

          {/* Table Right: History Button Placeholder */}
          <div className="absolute -right-1 top-1/2 -translate-y-1/2 z-30 w-11 sm:w-12 h-11 sm:h-12 rounded-full bg-gradient-to-br from-[#8b1420] to-[#590a12] text-white font-black border-2 border-[#d4af37] shadow flex flex-col items-center justify-center opacity-60">
            <span className="text-base sm:text-lg leading-none">↺</span>
            <span className="text-[7px] font-extrabold uppercase text-amber-200">HISTORY</span>
          </div>

          {/* Terminal Failure Modal Inside Table if timed out/cancelled */}
          {isTerminalFailure ? (
            <div className="relative z-30 m-auto bg-black/85 border-2 border-red-500/60 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-2xl text-red-400 mb-2">
                ✕
              </div>
              <h3 className="text-base font-black text-white mb-1">
                {matchmakingUiState === 'CANCELLED' ? 'Matchmaking Cancelled' : 'Matchmaking Timed Out'}
              </h3>
              <p className="text-xs text-slate-300 mb-4">
                {matchmakingMessage || 'Unable to assemble enough players. Please try again.'}
              </p>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => joinMatchmaking(variant, entryAmount, capacity, pointValue)}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs uppercase cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  onClick={dismissMatchmakingModal}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs uppercase cursor-pointer"
                >
                  Lobby
                </button>
              </div>
            </div>
          ) : (
            <div className="waiting-radar" aria-label={`${occupiedCount} of ${capacity} players joined`}>
              <div className="waiting-profiles">
                {waitingProfiles.map(profile => (
                  <img key={profile.playerId} alt={profile.username || 'Player'}
                    title={profile.username || 'Player'}
                    src={profile.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile.username || 'Player')}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
