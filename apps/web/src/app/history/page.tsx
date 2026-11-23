'use client';

import React, { useEffect, useState } from 'react';
import { useGameSocket } from '../../context/GameSocketContext';

export default function HistoryPage() {
  const { currentUser } = useGameSocket();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
    fetch(`${serverUrl}/api/games/history/${currentUser.userId}`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load history:', err);
        setLoading(false);
      });
  }, [currentUser.userId]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-amber-200">Completed Match History</h1>
          <p className="text-xs text-slate-400 mt-1">
            Permanent audit record of all your completed Points and Pool Rummy games
          </p>
        </div>
        <a
          href="/"
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
        >
          ← Back to Lobby
        </a>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading match history...</div>
      ) : history.length === 0 ? (
        <div className="bg-slate-900/60 rounded-2xl p-12 text-center border border-white/5">
          <div className="text-5xl mb-3">🂠</div>
          <h3 className="text-lg font-bold text-slate-200 mb-1">No completed games yet</h3>
          <p className="text-xs text-slate-400 mb-6">
            Join a Points or Pool Rummy match from the lobby to start building your record!
          </p>
          <a
            href="/"
            className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400"
          >
            Play Now
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((game) => {
            const isWinner = game.winnerUserId === currentUser.userId;
            return (
              <div
                key={game.id}
                className="bg-slate-900/80 rounded-2xl p-5 border border-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-amber-400">{game.variant}</span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      Table #{game.tableId.substring(0, 8)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(game.completedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-300">
                    Deals Played: <span className="font-bold text-white">{game.dealsCount}</span> •
                    Winner: <span className="font-bold text-amber-300">{game.winnerUserId}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className={`px-4 py-1.5 rounded-full font-black text-xs tracking-wider ${
                      isWinner
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {isWinner ? '👑 VICTORY' : 'DEFEAT'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
