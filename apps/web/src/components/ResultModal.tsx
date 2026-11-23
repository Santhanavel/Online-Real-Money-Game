'use client';

import React, { useEffect, useState } from 'react';
import { useGameSocket } from '../context/GameSocketContext';
import { CardGroupView } from '@rummy/card-assets';

export const ResultModal: React.FC = () => {
  const {
    lastDealResult,
    gameFinalResult,
    publicState,
    resetGame,
    activeTableConfig,
    isScoreboardOpen,
    isScoreboardMinimized,
    closeScoreboard,
    openScoreboard,
    setIsScoreboardMinimized,
  } = useGameSocket();

  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);

  // Synchronized countdown timer based on server-authoritative nextRoundStartsAt
  useEffect(() => {
    const nextRoundStartsAt = publicState?.nextRoundStartsAt;
    if (!nextRoundStartsAt) {
      setTimeLeftSec(null);
      return;
    }

    const updateTimer = () => {
      const remainingMs = nextRoundStartsAt - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setTimeLeftSec(remainingSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [publicState?.nextRoundStartsAt]);

  // Escape key handler on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isScoreboardOpen) {
        closeScoreboard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScoreboardOpen, closeScoreboard]);

  if (!lastDealResult && !gameFinalResult) return null;

  const isFinalWinner = gameFinalResult !== null;
  const winnerId = isFinalWinner ? gameFinalResult.winnerPlayerId : lastDealResult?.winnerPlayerId;
  const isPool = activeTableConfig?.variant !== 'POINTS';

  // Compact Minimized Floating Bar
  if (isScoreboardMinimized || !isScoreboardOpen) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border-2 border-amber-400 text-white px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-lg">🏆</span>
          <span className="text-xs font-black uppercase tracking-wider text-amber-200">
            {isFinalWinner ? 'Pool Champion Decided' : `Deal #${lastDealResult?.dealNumber} Complete`}
          </span>
        </div>

        {timeLeftSec !== null && timeLeftSec > 0 && !isFinalWinner && (
          <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-xl border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span className="text-xs font-mono font-bold text-amber-300">
              Next in {String(Math.floor(timeLeftSec / 60)).padStart(2, '0')}:{String(timeLeftSec % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        <button
          onClick={openScoreboard}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl shadow-md transition-all flex items-center gap-1"
        >
          <span>📊 View Scoreboard</span>
        </button>
      </div>
    );
  }

  // Full Controlled Scoreboard Modal
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 overflow-y-auto"
      onClick={(e) => {
        // Close on background backdrop click
        if (e.target === e.currentTarget) closeScoreboard();
      }}
    >
      <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-black border-2 border-amber-400/90 rounded-3xl max-w-2xl w-full p-4 md:p-7 text-center shadow-2xl relative my-auto max-h-[95vh] overflow-y-auto">
        {/* Top Control Bar with Close and Minimize buttons */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider border border-amber-500/30">
              {isPool ? (activeTableConfig?.variant === 'POOL_101' ? '101 Pool Rummy' : '201 Pool Rummy') : 'Points Rummy'}
            </span>
            <span className="text-slate-400 font-semibold">
              Deal #{lastDealResult?.dealNumber || 1}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsScoreboardMinimized(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors flex items-center gap-1"
              title="Minimize to inspect table"
            >
              <span>—</span>
              <span className="hidden sm:inline">Minimize</span>
            </button>
            <button
              onClick={closeScoreboard}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white font-black text-sm transition-colors flex items-center justify-center border border-white/10"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Server Authoritative Next Round Countdown Header */}
        {timeLeftSec !== null && timeLeftSec > 0 && !isFinalWinner && (
          <div className="mb-4 bg-gradient-to-r from-amber-500/15 via-emerald-500/20 to-amber-500/15 p-3 rounded-2xl border border-amber-400/30">
            <span className="text-[11px] block font-extrabold uppercase tracking-widest text-amber-300 mb-1">
              NEXT ROUND STARTS IN
            </span>
            <div className="font-mono text-3xl md:text-4xl font-black text-amber-200 tracking-wider">
              {String(Math.floor(timeLeftSec / 60)).padStart(2, '0')}:{String(timeLeftSec % 60).padStart(2, '0')}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              All active players will receive cards automatically when the timer reaches zero.
            </p>
          </div>
        )}

        {/* Winner Hero Banner */}
        <div className="mb-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-600 flex items-center justify-center text-3xl shadow-xl shadow-amber-500/30 mb-2 border-2 border-amber-200">
            👑
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 uppercase tracking-wide">
            {isFinalWinner ? 'Pool Game Champion!' : `Deal Complete`}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Winner: <span className="font-black text-amber-400">
              {lastDealResult?.scores.find((s) => s.isWinner)?.username || winnerId}
            </span>
          </p>
        </div>

        {/* Scores Table */}
        <div className="bg-black/60 rounded-2xl border border-white/10 overflow-hidden mb-6 text-left">
          <div className="grid grid-cols-12 bg-white/5 px-4 py-2.5 text-[11px] font-black text-amber-300 tracking-wider uppercase border-b border-white/10">
            <span className="col-span-5">Player</span>
            <span className="col-span-3 text-center">Pure Seq</span>
            <span className="col-span-2 text-right">Penalty</span>
            <span className="col-span-2 text-right">{isPool ? 'Pool Total' : 'Score'}</span>
          </div>

          <div className="divide-y divide-white/5 text-sm">
            {lastDealResult?.scores.map((score) => {
              const isWinner = score.isWinner;
              return (
                <div
                  key={score.playerId}
                  className={`grid grid-cols-12 items-center px-4 py-3 transition-colors ${
                    isWinner ? 'bg-amber-500/10 font-bold' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="col-span-5 flex items-center gap-2">
                    {isWinner && <span className="text-amber-400 text-base">👑</span>}
                    <span className={`truncate ${isWinner ? 'text-amber-200 font-extrabold' : 'text-slate-200'}`}>
                      {score.username}
                    </span>
                    {score.isEliminated && (
                      <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-black">
                        ELIMINATED
                      </span>
                    )}
                  </div>

                  <div className="col-span-3 text-center">
                    {score.hasPureSequence ? (
                      <span className="text-xs text-emerald-400 font-black">✓ Valid</span>
                    ) : (
                      <span className="text-xs text-rose-400 font-semibold">✗ None</span>
                    )}
                  </div>

                  <div className="col-span-2 text-right font-bold">
                    <span className={score.dealPenalty === 0 ? 'text-emerald-400 font-black' : 'text-rose-400'}>
                      {score.dealPenalty === 0 ? '0 (Won)' : `+${score.dealPenalty}`}
                    </span>
                  </div>

                  <div className="col-span-2 text-right font-black text-amber-300">
                    {score.totalPoolScore}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Winning Hand Cards Display */}
        {lastDealResult && (
          <div className="mb-6 text-left">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 mb-2 flex items-center gap-1.5">
              <span>🃏</span> Declared Winning Hand:
            </h4>
            <div className="flex flex-wrap gap-2 justify-center bg-black/50 p-3 rounded-2xl border border-white/5 max-h-48 overflow-y-auto">
              {lastDealResult.scores.find((s) => s.isWinner)?.groups?.map((group) => (
                <CardGroupView
                  key={group.id}
                  group={group}
                  selectedCardIds={new Set()}
                  wildJokerCard={lastDealResult.wildJoker}
                  size="sm"
                />
              ))}
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap gap-3 justify-center items-center pt-2 border-t border-white/10">
          <button
            onClick={closeScoreboard}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors border border-white/10"
          >
            Close Scoreboard (Esc)
          </button>

          {isFinalWinner || !isPool ? (
            <button
              onClick={resetGame}
              className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs tracking-wide shadow-lg shadow-amber-500/20 transition-all"
            >
              Back to Game Lobby
            </button>
          ) : (
            <button
              onClick={() => setIsScoreboardMinimized(true)}
              className="px-6 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-xs border border-amber-500/40 transition-colors"
            >
              Minimize & Inspect Table
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
