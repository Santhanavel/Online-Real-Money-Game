'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGameSocket } from '../../context/GameSocketContext';

export default function HistoryPage() {
  const { currentUser } = useGameSocket();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'POINTS' | 'POOL_240' | 'POOL_101' | 'POOL_201'>('ALL');

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

  const filteredHistory = history.filter((game) => {
    if (filter === 'ALL') return true;
    if (filter === 'POOL_240') return game.variant === 'POOL_240' || game.variant === 'POINTS_240';
    return game.variant === filter;
  });

  const getVariantName = (variant: string) => {
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
        return variant;
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] lobby-theme text-white p-4 sm:p-6 select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#8D1420]">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD96A] via-[#F6BE36] to-amber-100 uppercase tracking-wide">
              Game Match History
            </h1>
            <p className="text-xs text-amber-200/70 font-semibold tracking-wider mt-0.5">
              Authoritative records of your completed Points &amp; Pool Rummy tables
            </p>
          </div>
          <Link
            href="/"
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#250408] hover:bg-[#470A10] border border-[#8D1420] text-xs font-bold text-amber-300 transition-colors shadow-sm"
          >
            ← Back to Lobby
          </Link>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All Games' },
            { id: 'POINTS', label: 'Points Rummy' },
            { id: 'POOL_240', label: 'Pool 240' },
            { id: 'POOL_101', label: 'Pool 101' },
            { id: 'POOL_201', label: 'Pool 201' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as any)}
              className={`px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
                filter === item.id
                  ? 'bg-[#B92730] text-white border border-[#F6BE36] shadow-sm'
                  : 'bg-[#250408] text-amber-100/70 border border-[#8D1420] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-amber-200/60 text-xs font-semibold">
            Loading match records from server...
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="bg-[#250408]/80 rounded-3xl p-10 text-center border border-[#8D1420]">
            <div className="text-4xl mb-3">🂠</div>
            <h3 className="text-base font-bold text-amber-200 mb-1">No completed games found</h3>
            <p className="text-xs text-slate-300 mb-5">
              Join a Points or Pool match from the lobby to start building your record!
            </p>
            <Link
              href="/"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#159A43] to-[#107A35] text-white font-black text-xs shadow-md transition-all inline-block uppercase tracking-wider"
            >
              Go to Game Lobby
            </Link>
          </div>
        ) : (
          <div className="bg-[#250408]/90 border border-[#8D1420] rounded-3xl overflow-hidden shadow-2xl">
            {/* Header Row */}
            <div className="grid grid-cols-12 bg-[#1A0306] px-4 py-3 text-[11px] font-black text-amber-300 uppercase tracking-wider border-b border-[#8D1420]">
              <span className="col-span-4 sm:col-span-3">Format / Table</span>
              <span className="col-span-4 sm:col-span-3">Date &amp; Time</span>
              <span className="col-span-2 text-center">Deals</span>
              <span className="col-span-2 sm:col-span-2 text-center">Winner</span>
              <span className="hidden sm:block sm:col-span-2 text-right">Result</span>
            </div>

            <div className="divide-y divide-[#8D1420]/40 text-xs">
              {filteredHistory.map((game) => {
                const isWinner = game.winnerUserId === currentUser.userId;
                return (
                  <div
                    key={game.id}
                    className="grid grid-cols-12 items-center px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="col-span-4 sm:col-span-3 flex flex-col justify-center">
                      <span className="font-bold text-white text-xs sm:text-sm">
                        {getVariantName(game.variant)}
                      </span>
                      <span className="text-[10px] text-amber-200/50 font-mono">
                        #{game.tableId.substring(0, 8)}
                      </span>
                    </div>

                    <div className="col-span-4 sm:col-span-3 text-slate-300 text-[11px]">
                      {new Date(game.completedAt).toLocaleDateString()} {new Date(game.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="col-span-2 text-center text-slate-200 font-bold">
                      {game.dealsCount || 1}
                    </div>

                    <div className="col-span-2 sm:col-span-2 text-center text-amber-300 font-bold truncate">
                      {isWinner ? (
                        <span className="text-emerald-400 font-black">👑 You Won</span>
                      ) : (
                        <span className="text-slate-400 truncate">{game.winnerUserId}</span>
                      )}
                    </div>

                    <div className="hidden sm:block sm:col-span-2 text-right">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                          isWinner
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {isWinner ? 'VICTORY' : 'COMPLETED'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
