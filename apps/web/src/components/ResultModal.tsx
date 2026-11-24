'use client';

import React, { useEffect, useState } from 'react';
import { CardGroupView, PlayingCard } from '@rummy/card-assets';
import { useGameSocket } from '../context/GameSocketContext';

export const ResultModal: React.FC = () => {
  const {
    lastDealResult,
    gameFinalResult,
    activeTableConfig,
    isScoreboardOpen,
    isScoreboardMinimized,
    openScoreboard,
    closeScoreboard,
    resetGame,
    revealedHands,
    scoreboard,
    splitRequest,
    countdownTick,
    requestSplit,
    voteSplit,
    requestReentry,
    currentUser,
  } = useGameSocket();

  // Local ticker to smoothly interpolate countdowns every 200ms
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);

  // Selected deal for inspection in Deal History tab
  const [selectedDealNum, setSelectedDealNum] = useState<number | null>(null);

  const nextStartsAt = countdownTick?.startsAt || (lastDealResult as any)?.nextRoundStartsAt;
  const isCountdownPaused = countdownTick?.isPaused;
  const timeLeftSec = nextStartsAt ? Math.max(0, Math.ceil((nextStartsAt - now) / 1000)) : null;

  // Escape key closes/minimizes scoreboard to view felt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isScoreboardOpen) {
        closeScoreboard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScoreboardOpen, closeScoreboard]);

  if (!lastDealResult && !gameFinalResult && !scoreboard) return null;

  const isFinalWinner = gameFinalResult !== null;
  const isSplitVictory = gameFinalResult?.winnerPlayerId === 'SPLIT_MUTUAL';
  const currentDealNum = lastDealResult?.dealNumber || 1;
  const viewingDealNum = selectedDealNum ?? currentDealNum;

  // Historical deals available from scoreboard or completed deal
  const historyDeals = scoreboard?.dealHistory || (lastDealResult ? [lastDealResult] : []);
  const viewingDealResult = historyDeals.find((d) => d.dealNumber === viewingDealNum) || lastDealResult;

  const winner = viewingDealResult?.scores.find((s) => s.isWinner);
  const winnerName = isSplitVictory
    ? 'Mutual Split (All Survivors)'
    : winner?.username || viewingDealResult?.winnerPlayerId || 'Winner';
  const winnerAvatar = (winner as any)?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${winnerName}`;

  const isPool =
    activeTableConfig?.variant === 'POOL_101' ||
    activeTableConfig?.variant === 'POOL_201' ||
    activeTableConfig?.variant === 'POOL_240' ||
    (activeTableConfig?.variant as string) === 'POINTS_240';

  const variantLabel =
    activeTableConfig?.variant === 'POOL_240' || (activeTableConfig?.variant as string) === 'POINTS_240'
      ? 'Pool 240'
      : activeTableConfig?.variant === 'POOL_101'
      ? 'Pool 101'
      : activeTableConfig?.variant === 'POOL_201'
      ? 'Pool 201'
      : 'Points Rummy';

  const entryAmount = (activeTableConfig as any)?.entryFee || (activeTableConfig as any)?.entryAmount || 100;
  const poolLimit = activeTableConfig?.poolEliminationLimit || (activeTableConfig?.variant === 'POOL_101' ? 101 : 201);

  // Check if current user is eliminated and eligible for re-entry
  const myScoreboardRow = scoreboard?.rows.find((r) => r.playerId === currentUser.userId);
  const canMeReenter = myScoreboardRow?.canReenter;

  // Minimized Top Bar notification when user minimizes to inspect table
  if (isScoreboardMinimized || !isScoreboardOpen) {
    return (
      <div className="fixed top-16 right-3 sm:right-6 z-40 bg-[#1e0306]/95 border-2 border-amber-400/60 text-white px-3 sm:px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-fade-in select-none">
        <div className="flex items-center gap-1.5">
          <span className="text-amber-400 text-lg">🏆</span>
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-200">
              {isFinalWinner ? 'Match Completed' : `Deal ${currentDealNum} Completed`}
            </span>
            <span className="text-[10px] text-emerald-300 font-bold truncate max-w-[130px]">
              {winnerName}
            </span>
          </div>
        </div>

        {timeLeftSec !== null && timeLeftSec > 0 && !isFinalWinner && (
          <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-lg border border-amber-500/30">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isCountdownPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'
              } inline-block`}
            />
            <span className="text-[10px] font-mono font-bold text-amber-300">
              {isCountdownPaused ? 'PAUSED' : `Next: ${timeLeftSec}s`}
            </span>
          </div>
        )}

        <button
          onClick={openScoreboard}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-[11px] px-3 py-1 rounded-xl shadow-md transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>🏆 Result</span>
        </button>
      </div>
    );
  }

  // PRIZE SPLIT VOTING MODAL
  if (splitRequest && splitRequest.status === 'PENDING') {
    const hasVoted = splitRequest.votes[currentUser.userId] !== null && splitRequest.votes[currentUser.userId] !== undefined;
    const splitExpiresAt = splitRequest.votingExpiresAt;
    const splitTimeLeftSec = Math.max(0, Math.ceil((splitExpiresAt - now) / 1000));

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-3 select-none animate-fade-in">
        <div className="relative w-full max-w-lg bg-gradient-to-b from-[#2a0408] via-[#1a0204] to-[#0c0102] border-2 border-amber-400/80 rounded-3xl shadow-2xl p-5 sm:p-6 flex flex-col items-center text-center overflow-hidden">
          <div className="w-full flex items-center justify-between pb-3 border-b border-amber-500/30 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤝</span>
              <h3 className="text-base sm:text-lg font-black text-amber-200 uppercase tracking-wide">
                Prize Split Proposal
              </h3>
            </div>
            <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-400/40 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold text-amber-300">
              <span>⏳</span>
              <span>{splitTimeLeftSec}s</span>
            </div>
          </div>

          <p className="text-xs text-amber-100/90 mb-4">
            Initiated by <strong className="text-amber-300">{splitRequest.initiatorUsername}</strong>. All remaining
            players must accept for the prize split to finalize.
          </p>

          <div className="w-full grid grid-cols-3 gap-2 mb-4 bg-black/50 p-2.5 rounded-2xl border border-amber-500/20 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Gross Prize</span>
              <span className="font-bold text-amber-200">
                ₹{(splitRequest.calculation.totalPrizePool / 100).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Rake Fee</span>
              <span className="font-bold text-rose-300">
                ₹{(splitRequest.calculation.rakeAmount / 100).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Net Distributable</span>
              <span className="font-bold text-emerald-300">
                ₹{(splitRequest.calculation.distributablePrize / 100).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="w-full bg-black/40 rounded-2xl border border-amber-500/20 overflow-hidden mb-5">
            <div className="grid grid-cols-12 bg-amber-950/40 px-3 py-1.5 text-[10px] font-black text-amber-300 uppercase tracking-wider">
              <span className="col-span-4 text-left">Player</span>
              <span className="col-span-2 text-center">Drops</span>
              <span className="col-span-3 text-right">Excess</span>
              <span className="col-span-3 text-right">Payout</span>
            </div>
            <div className="divide-y divide-white/5 text-xs">
              {splitRequest.calculation.playerCalculations.map((c) => {
                const vote = splitRequest.votes[c.playerId];
                return (
                  <div key={c.playerId} className="grid grid-cols-12 items-center px-3 py-2">
                    <div className="col-span-4 text-left flex items-center gap-1.5 truncate">
                      <span className="font-bold text-slate-200 truncate">{c.username}</span>
                      {vote === 'ACCEPT' && <span className="text-emerald-400 text-xs">✓</span>}
                      {vote === 'REJECT' && <span className="text-rose-400 text-xs">✕</span>}
                      {vote === null && <span className="text-amber-400 text-xs animate-pulse">…</span>}
                    </div>
                    <span className="col-span-2 text-center font-mono text-slate-300">
                      {c.remainingDrops}
                    </span>
                    <span className="col-span-3 text-right font-mono text-slate-400">
                      ₹{(c.excessDropPayout / 100).toFixed(2)}
                    </span>
                    <span className="col-span-3 text-right font-black text-amber-300">
                      ₹{(c.totalPayout / 100).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {!hasVoted ? (
            <div className="w-full flex gap-3">
              <button
                onClick={() => voteSplit(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer"
              >
                ✕ Decline
              </button>
              <button
                onClick={() => voteSplit(true)}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 transition active:scale-95 cursor-pointer"
              >
                ✓ Accept Split
              </button>
            </div>
          ) : (
            <div className="text-xs text-amber-300/80 font-bold bg-black/40 px-4 py-2 rounded-xl border border-amber-500/30">
              Your vote has been recorded. Waiting for other players...
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // UNIFIED DEAL RESULT & LEADERBOARD SCOREBOARD SCREEN (ISSUE 2 REMEDIATION)
  // Single, consolidated page removing separate Winner and Scoreboard views.
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-md p-2 sm:p-4 select-none animate-fade-in">
      <div className="relative w-full max-w-5xl bg-gradient-to-b from-[#2e0509] via-[#1a0204] to-[#0c0102] border-2 border-amber-500/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Subtle Sunburst Background Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.18)_0%,_transparent_70%)] pointer-events-none" />

        {/* 1. TOP HEADER & DEAL BANNER */}
        <div className="relative z-10 flex flex-wrap items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b border-amber-500/30 bg-black/45">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 text-base shadow">
              🏆
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-amber-100 uppercase tracking-wide flex items-center gap-2">
                <span>{isFinalWinner ? 'Match Completed' : `Deal ${currentDealNum} Result`}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {variantLabel}
                </span>
              </h2>
              <span className="text-[10px] text-amber-300/70 font-semibold block">
                {isPool ? `Knockout Threshold: ${poolLimit} pts` : `Points Table • 🪙 ${entryAmount}`}
              </span>
            </div>
          </div>

          {/* Right Tools: Split Prize + Back to Table Button matching RummyCulture Sheet 3 */}
          <div className="flex items-center gap-2 mt-1 sm:mt-0">
            {/* Split Prize Shortcut if eligible */}
            {scoreboard?.splitEligible && !isFinalWinner && (
              <button
                onClick={requestSplit}
                className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow transition active:scale-95 cursor-pointer"
              >
                🤝 Split Prize
              </button>
            )}

            {/* Back to Table Button matching RummyCulture Sheet 3 Panels 6-8 */}
            <button
              onClick={closeScoreboard}
              className="px-3.5 py-1 rounded-full border border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md"
              title="Return to Table View"
            >
              <span>←</span>
              <span>Back to Table</span>
            </button>
          </div>
        </div>

        {/* 2. SUBHEADER COUNTDOWN BANNER matching RummyCulture Sheet 3 */}
        <div className="relative z-10 w-full px-4 sm:px-6 py-2 bg-gradient-to-r from-amber-950/80 via-black/80 to-amber-950/80 border-b border-amber-500/20 flex items-center justify-center text-center">
          {timeLeftSec !== null && timeLeftSec > 0 && !isFinalWinner ? (
            <div className="flex items-center gap-2 font-mono text-xs sm:text-sm font-black text-amber-200">
              <span className="text-amber-400">🏆</span>
              <span>Deal {currentDealNum} has finished. Deal {currentDealNum + 1} starts in</span>
              <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
                {timeLeftSec}s
              </span>
            </div>
          ) : isFinalWinner ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-emerald-300 uppercase tracking-wider">
              <span>👑 Tournament Winner:</span>
              <span className="text-amber-300">{winnerName}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
              <span>🟡 Waiting for players to complete declaration...</span>
            </div>
          )}
        </div>

        {/* 2. DEAL HISTORY TAB SELECTOR (Inspect past deals without leaving match context) */}
        {historyDeals.length > 1 && (
          <div className="relative z-10 flex items-center gap-1.5 px-4 sm:px-6 py-1.5 bg-black/60 border-b border-amber-500/20 overflow-x-auto">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400/80 mr-1 flex items-center gap-1">
              <span>📜</span> History:
            </span>
            {historyDeals.map((deal) => {
              const isSelected = deal.dealNumber === viewingDealNum;
              const isCurrent = deal.dealNumber === currentDealNum;
              return (
                <button
                  key={deal.dealNumber}
                  onClick={() => setSelectedDealNum(deal.dealNumber)}
                  className={`px-3 py-0.5 rounded-full text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30 ring-1 ring-amber-300'
                      : 'bg-black/40 hover:bg-black/70 text-amber-200/80 border border-amber-500/20'
                  }`}
                >
                  <span>Deal {deal.dealNumber}</span>
                  {isCurrent && <span className="text-[9px] opacity-75">(Latest)</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* 3. MAIN CONTENT SCROLL AREA */}
        <div className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {/* A. SPOTLIGHT WINNER BANNER */}
          <div className="w-full bg-gradient-to-r from-amber-950/60 via-black/60 to-amber-950/60 border border-amber-500/35 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-amber-400 overflow-hidden bg-slate-900 shadow-md">
                <img src={winnerAvatar} alt={winnerName} className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-amber-300/80 uppercase tracking-wide block">
                  {isFinalWinner ? '🏆 Tournament Champion' : `Deal ${viewingDealNum} Winner`}
                </span>
                <span className="text-base sm:text-lg font-black text-white">{winnerName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500 text-white font-black text-xs shadow flex items-center gap-1">
                {isSplitVictory ? 'Split ✓' : 'Valid Show ✓ (0 pts)'}
              </span>
            </div>
          </div>

          {/* B. REVEALED HANDS & CARD GROUPINGS FOR ALL PLAYERS */}
          <div className="w-full bg-black/55 rounded-2xl border border-amber-500/25 p-3 sm:p-4 shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-200 mb-3 flex items-center gap-2">
              <span>🃏</span>
              <span>Revealed Player Hands &amp; Melds</span>
            </h3>

            <div className="space-y-3">
              {(revealedHands || []).map((handInfo) => {
                const isWinnerPlayer = handInfo.isWinner;
                const isSelf = handInfo.playerId === currentUser.userId;

                return (
                  <div
                    key={handInfo.playerId}
                    className={`p-2.5 sm:p-3 rounded-xl border transition-all ${
                      isWinnerPlayer
                        ? 'bg-amber-950/30 border-amber-500/50 shadow-md'
                        : 'bg-black/40 border-white/5'
                    }`}
                  >
                    {/* Player Info Row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full border border-amber-400/50 overflow-hidden bg-slate-900 flex-shrink-0">
                          <img
                            src={handInfo.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${handInfo.username}`}
                            alt={handInfo.username}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className={`text-xs font-black ${isWinnerPlayer ? 'text-amber-200' : 'text-slate-200'}`}>
                          {handInfo.username} {isSelf && '(You)'}
                        </span>
                        {isWinnerPlayer && (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500 text-white font-extrabold">
                            Declared Show
                          </span>
                        )}
                        {handInfo.isEliminated && (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-700 text-white font-extrabold">
                            Knocked Out
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[11px] text-slate-400">Deal Score:</span>
                        <span className={`font-black ${handInfo.dealPenalty === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {handInfo.dealPenalty === 0 ? '0 pts' : `+${handInfo.dealPenalty} pts`}
                        </span>
                      </div>
                    </div>

                    {/* Render Grouped Cards Tray */}
                    <div className="flex flex-wrap items-end gap-1.5 sm:gap-2 overflow-x-auto py-1">
                      {handInfo.groups && handInfo.groups.length > 0 ? (
                        handInfo.groups.map((grp, gIdx) => (
                          <CardGroupView
                            key={grp.id || gIdx}
                            group={grp}
                            selectedCardIds={new Set()}
                            size="sm"
                          />
                        ))
                      ) : (
                        <div className="flex items-center gap-1 py-1">
                          {handInfo.cards.map((c) => (
                            <PlayingCard key={c.cardId} card={c} size="sm" />
                          ))}
                        </div>
                      )}

                      {/* Unmatched Deadwood Cards */}
                      {handInfo.unmatchedCards && handInfo.unmatchedCards.length > 0 && (
                        <div className="inline-flex flex-col items-center px-1.5 py-1 rounded-xl bg-rose-950/30 border border-rose-500/30">
                          <div className="flex items-center">
                            {handInfo.unmatchedCards.map((c) => (
                              <div key={c.cardId} className="-ml-4 first:ml-0">
                                <PlayingCard card={c} size="sm" />
                              </div>
                            ))}
                          </div>
                          <span className="text-[9px] font-black text-rose-300 mt-0.5">
                            Unmatched ({handInfo.unmatchedCards.length})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* C. UNIFIED CUMULATIVE SCOREBOARD & LEADERBOARD TABLE */}
          <div className="w-full bg-black/55 rounded-2xl border border-amber-500/25 overflow-hidden shadow-xl">
            <div className="px-4 py-2.5 bg-amber-950/40 border-b border-amber-500/30 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-200 flex items-center gap-2">
                <span>📊</span>
                <span>Cumulative Scoreboard &amp; Standings</span>
              </h3>
              <span className="text-[10px] text-amber-300/80 font-bold">
                {isPool ? `Threshold: ${poolLimit} pts` : 'Single Deal'}
              </span>
            </div>

            {/* Scoreboard Table Headers matching RummyCulture Sheet 3 */}
            <div className="grid grid-cols-12 bg-black/60 px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] font-black text-amber-300 uppercase tracking-wider border-b border-white/5">
              <span className="col-span-1">Rank</span>
              <span className="col-span-3">Player</span>
              <span className="col-span-4 text-center">Cards • Joker</span>
              <span className="col-span-2 text-right">Deal Score</span>
              <span className="col-span-2 text-right">{isPool ? 'Game Score' : 'Total'}</span>
            </div>

            {/* Scoreboard Rows */}
            <div className="divide-y divide-white/5 text-xs sm:text-sm">
              {(scoreboard?.rows || []).map((row) => {
                const isWin = row.isWinner;
                const isEliminated = row.status === 'ELIMINATED';
                const isDropped = row.status === 'DROPPED';
                const isSelf = row.playerId === currentUser.userId;
                const playerRevealedHand = (revealedHands || []).find((h) => h.playerId === row.playerId);

                return (
                  <div
                    key={row.playerId}
                    className={`grid grid-cols-12 items-center px-3 sm:px-4 py-2.5 transition-colors ${
                      isWin
                        ? 'bg-amber-500/15 font-bold'
                        : isEliminated
                        ? 'opacity-65 bg-red-950/20'
                        : isSelf
                        ? 'bg-white/[0.04]'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <span className="col-span-1 text-xs font-mono font-black text-amber-400">
                      #{row.rank}
                    </span>

                    <div className="col-span-3 flex items-center gap-2 truncate">
                      <div className="w-7 h-7 rounded-full border border-amber-400/60 overflow-hidden bg-slate-900 flex-shrink-0">
                        <img
                          src={row.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${row.username}`}
                          alt={row.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="truncate">
                        <span className={`text-xs block truncate ${isWin ? 'text-amber-200 font-black' : 'text-slate-200'}`}>
                          {row.username} {isSelf && '(You)'}
                        </span>
                        {isPool && (
                          <span className="text-[9px] text-slate-400 block font-mono">
                            Drops: {row.remainingDrops}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cards • Joker Column (Miniature cards or DROPPED pill) */}
                    <div className="col-span-4 flex items-center justify-center overflow-x-auto py-0.5">
                      {isDropped ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-950/80 border border-red-500/60 text-red-300 font-extrabold text-[10px]">
                          DROPPED
                        </span>
                      ) : playerRevealedHand?.cards && playerRevealedHand.cards.length > 0 ? (
                        <div className="flex items-center -space-x-3 max-w-full overflow-hidden">
                          {playerRevealedHand.cards.slice(0, 7).map((c) => (
                            <div key={c.cardId} className="transform scale-[0.6] origin-left">
                              <PlayingCard card={c} size="sm" />
                            </div>
                          ))}
                          {playerRevealedHand.cards.length > 7 && (
                            <span className="text-[9px] text-slate-400 font-bold ml-1">
                              +{playerRevealedHand.cards.length - 7}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-medium italic">
                          Cards Hidden
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 text-right font-black text-xs sm:text-sm">
                      <span className={row.currentDealScore === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {row.currentDealScore === 0 ? '0' : `+${row.currentDealScore}`}
                      </span>
                    </div>

                    <div className="col-span-2 text-right font-black text-amber-300 text-xs sm:text-sm">
                      {row.totalScore}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* D. RE-ENTRY PROMPT (If current user is eliminated and eligible) */}
          {canMeReenter && !isFinalWinner && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950 via-amber-950 to-red-950 border-2 border-amber-400/60 flex flex-wrap items-center justify-between gap-3 shadow-xl">
              <div>
                <span className="text-xs font-black text-amber-200 block">
                  Knocked Out! Re-entry Window Open
                </span>
                <span className="text-[11px] text-amber-300/80">
                  Fee: 🪙 {entryAmount} • Re-entry Score: Highest active player score + 1 point
                </span>
              </div>
              <button
                onClick={requestReentry}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
              >
                Re-enter Table
              </button>
            </div>
          )}
        </div>

        {/* 4. BOTTOM ACTION & NAVIGATION BAR matching RummyCulture Sheet 3 */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-amber-500/30 bg-black/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {}}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white font-black text-xs border border-emerald-400 shadow-md flex items-center gap-1 cursor-pointer transition active:scale-95"
            >
              <span className="text-sm font-bold">+</span>
              <span>Game</span>
            </button>
            <button
              onClick={closeScoreboard}
              className="px-4 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs uppercase tracking-wider border border-amber-500/40 shadow transition cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <span>👁️</span>
              <span>Inspect Table</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isFinalWinner || !isPool ? (
              <button
                onClick={resetGame}
                className="px-6 py-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/40 transition active:scale-95 cursor-pointer"
              >
                Return to Lobby
              </button>
            ) : (
              <button
                onClick={closeScoreboard}
                className="px-6 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 transition active:scale-95 cursor-pointer"
              >
                Continue to Table
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
