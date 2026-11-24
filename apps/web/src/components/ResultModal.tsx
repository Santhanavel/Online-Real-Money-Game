 'use client';

import React, { useEffect, useState } from 'react';
import { CardGroupView, PlayingCard } from '@rummy/card-assets';
import { ScoreboardRow } from '@rummy/shared-types';
import { Trophy, X, ListOrdered } from 'lucide-react';
import { useGameSocket } from '../context/GameSocketContext';

const ordinal = (rank: number): string => {
  const suffix = rank % 100 >= 11 && rank % 100 <= 13 ? 'th'
    : rank % 10 === 1 ? 'st' : rank % 10 === 2 ? 'nd' : rank % 10 === 3 ? 'rd' : 'th';
  return `${rank}${suffix}`;
};

export const ResultModal: React.FC = () => {
  const { lastDealResult, gameFinalResult, activeTableConfig, isScoreboardOpen,
    openScoreboard, closeScoreboard, resetGame, revealedHands, scoreboard,
    splitRequest, countdownTick, requestSplit, voteSplit, requestReentry, currentUser } = useGameSocket();
  const [now, setNow] = useState(Date.now());
  const [selectedDealNum, setSelectedDealNum] = useState<number | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => {setSelectedDealNum(null);}, [lastDealResult?.dealNumber]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {if (event.key === 'Escape' && isScoreboardOpen) closeScoreboard();};
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [isScoreboardOpen, closeScoreboard]);
  if (!lastDealResult && !gameFinalResult && !scoreboard) return null;
  const isFinalWinner = gameFinalResult !== null;
  const isPool = activeTableConfig?.variant !== 'POINTS';
  const entryAmount = activeTableConfig?.entryAmount ?? 100;
  const poolLimit = activeTableConfig?.poolEliminationLimit ?? 101;
  const variantLabel = isPool ? `${poolLimit} Pool` : 'Points Rummy';
  const history = scoreboard?.dealHistory ?? gameFinalResult?.deals ?? (lastDealResult ? [lastDealResult] : []);
  const viewingDeal = history.find(deal => deal.dealNumber === selectedDealNum) ?? lastDealResult ?? history[history.length - 1];
  const currentDealNumber = lastDealResult?.dealNumber ?? scoreboard?.dealNumber ?? 1;
  const fallbackRows: ScoreboardRow[] = (viewingDeal?.scores ?? []).slice().sort((a,b) => a.totalPoolScore - b.totalPoolScore || a.dealPenalty - b.dealPenalty).map((score, index) => ({
    rank: gameFinalResult?.finalStandings.find(row => row.playerId === score.playerId)?.rank ?? index + 1,
    playerId: score.playerId, username: score.username, avatarUrl: '', isWinner: score.isWinner,
    previousScore: score.totalPoolScore - score.dealPenalty, currentDealScore: score.dealPenalty,
    totalScore: isPool ? score.totalPoolScore : score.dealPenalty, poolLimit, pointsRemaining: poolLimit - score.totalPoolScore,
    status: score.isEliminated ? 'ELIMINATED' : score.notes.startsWith('Dropped') ? 'DROPPED' : 'ACTIVE', remainingDrops: 0,
  }));
  const isHistorical = viewingDeal && viewingDeal.dealNumber !== currentDealNumber;
  const rows = isHistorical || isFinalWinner ? fallbackRows : scoreboard?.rows ?? fallbackRows;
  const myRow = rows.find(row => row.playerId === currentUser.userId);
  const eliminated = myRow?.status === 'ELIMINATED';
  const nextStartsAt = countdownTick?.startsAt ?? scoreboard?.nextDealStartsAt;
  const timeLeft = nextStartsAt ? Math.max(0, Math.ceil((nextStartsAt - now) / 1000)) : 0;
  const finishTitle = eliminated && myRow ? `You finished ${ordinal(myRow.rank)}`
    : isFinalWinner ? (gameFinalResult.winnerPlayerId === currentUser.userId ? 'You won the match!' : 'Match completed')
    : `Deal ${viewingDeal?.dealNumber ?? currentDealNumber} completed`;
  const reentryCutoff = poolLimit === 101 ? 80 : poolLimit === 201 ? 175 : 201;
  const orderedRows = [...rows].sort((a,b) => Number(b.playerId === currentUser.userId) - Number(a.playerId === currentUser.userId) || a.rank - b.rank);
  if (!isScoreboardOpen && splitRequest?.status !== 'PENDING') return <button className="result-reopen" onClick={openScoreboard}><ListOrdered size={20} />View results {timeLeft > 0 && !isFinalWinner ? `· ${timeLeft}s` : ''}</button>;
  // PRIZE SPLIT VOTING MODAL
  if (splitRequest && splitRequest.status === 'PENDING') {
    const hasVoted = splitRequest.votes[currentUser.userId] !== null && splitRequest.votes[currentUser.userId] !== undefined;
    const splitExpiresAt = splitRequest.votingExpiresAt;
    const splitTimeLeftSec = Math.max(0, Math.ceil((splitExpiresAt - now) / 1000));

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-3 select-none animate-fade-in">
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
                ₹{(splitRequest.calculation.platformFee / 100).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Net Distributable</span>
              <span className="font-bold text-emerald-300">
                ₹{(splitRequest.calculation.netPrizePool / 100).toFixed(2)}
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
                      {vote === true && <span className="text-emerald-400 text-xs">✓</span>}
                      {vote === false && <span className="text-rose-400 text-xs">✕</span>}
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


  return (
    <section className="rummy-results" role="dialog" aria-modal="true" aria-labelledby="results-title">
      <div className="results-sheet">
        <header className="results-header">
          <div><strong>{variantLabel} · {entryAmount.toLocaleString('en-IN')} chips</strong><small>#{activeTableConfig?.tableId.slice(-9)} · Deal {viewingDeal?.dealNumber ?? currentDealNumber}</small></div>
          <div className="flex gap-3 items-center">
            {scoreboard?.splitEligible && !isFinalWinner && <button onClick={requestSplit}>Split prize</button>}
            {(eliminated || isFinalWinner || !isPool) && <button onClick={resetGame}>Go to lobby</button>}
            <button className="table-icon" onClick={closeScoreboard} aria-label="Inspect table"><X /></button>
          </div>
        </header>
        <div className="results-summary"><Trophy size={38} /><div><h2 id="results-title">{finishTitle}</h2>
          {eliminated && isPool ? <p>{myRow?.canReenter ? `Rejoin with ${entryAmount} chips to continue playing.` : `To rejoin in ${poolLimit} Pool, the highest remaining score must be less than ${reentryCutoff}.`}</p>
            : <p>{isFinalWinner || !isPool ? 'Final standings and revealed hands' : timeLeft > 0 ? (countdownTick?.isPaused ? 'Next deal paused while players respond' : `Next deal starts in ${timeLeft}s`) : 'Deal scores and total game scores'}</p>}
        </div></div>
        {history.length > 1 && <nav className="results-deals" aria-label="Deal history">{history.map(deal => <button key={deal.dealNumber} aria-pressed={viewingDeal?.dealNumber === deal.dealNumber} onClick={() => setSelectedDealNum(deal.dealNumber)}>Deal {deal.dealNumber}</button>)}</nav>}
        <div className="results-table-scroll"><table className="results-table"><thead><tr><th>Rank</th><th>Player</th><th>Cards · Joker {viewingDeal?.wildJoker && <span className="result-joker">{viewingDeal.wildJoker.rank}</span>}</th><th>Deal score</th><th>Game score</th></tr></thead>
          <tbody>{orderedRows.map(row => {
            const own = row.playerId === currentUser.userId;
            const score = viewingDeal?.scores.find(item => item.playerId === row.playerId);
            const revealed = !isHistorical ? revealedHands?.find(hand => hand.playerId === row.playerId) : undefined;
            const groups = score?.groups ?? revealed?.groups ?? [];
            const cards = score?.hand ?? revealed?.cards ?? [];
            const dropped = score ? score.notes.startsWith('Dropped') : row.status === 'DROPPED';
            return <tr key={row.playerId} className={own ? 'results-own-row' : ''}>
              <td>{row.rank}</td><td><span>{own ? 'You' : row.username}</span>{row.isWinner && <small className="deal-winner">Deal winner</small>}{row.status === 'ELIMINATED' && <small className="result-eliminated">Eliminated</small>}</td>
              <td>{dropped ? <span className="result-dropped">DROPPED</span> : <div className="result-cards">{groups.length > 0 ? groups.map(group => <CardGroupView key={group.id} group={group} selectedCardIds={new Set()} size="sm" />) : cards.length > 0 ? cards.map(card => <PlayingCard key={card.cardId} card={card} size="sm" />) : <span className="result-hidden">Cards hidden</span>}</div>}</td>
              <td>{row.currentDealScore}</td><td>{row.totalScore}</td>
            </tr>;
          })}</tbody>
        </table></div>
        <footer className="results-footer"><span>{eliminated ? 'Eliminated' : isFinalWinner ? 'Match complete' : 'Deal complete'} · {variantLabel}</span><div className="flex gap-3">{myRow?.canReenter && !isFinalWinner && <button onClick={requestReentry}>Rejoin · {entryAmount} chips</button>}<button onClick={closeScoreboard}>Inspect table</button></div></footer>
      </div>
    </section>
  );
};
