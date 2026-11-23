'use client';

import React from 'react';
import { useGameSocket } from '../context/GameSocketContext';

export const MatchmakingModal: React.FC = () => {
  const { isSearching, leaveMatchmaking } = useGameSocket();

  if (!isSearching) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
      <div className="bg-gradient-to-b from-slate-900 to-emerald-950 border-2 border-amber-500/40 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative overflow-hidden">
        {/* Glow light effect */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl" />

        {/* Animated Shuffle Cards Indicator */}
        <div className="relative w-24 h-24 mx-auto mb-4 flex items-center justify-center">
          <div className="w-16 h-22 bg-amber-500/10 rounded-lg border border-amber-400/40 animate-spin absolute" />
          <div className="w-16 h-22 bg-emerald-900/60 rounded-lg border-2 border-amber-400 flex items-center justify-center text-3xl shadow-xl z-10 animate-bounce">
            🂠
          </div>
        </div>

        <h3 className="text-xl font-black text-amber-200 tracking-wide mb-1">
          Finding Real Opponents...
        </h3>
        <p className="text-xs text-emerald-300/80 mb-6 font-medium">
          Authoritative server is matching available players on the network
        </p>

        {/* Pulse dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
          <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping delay-150" />
          <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping delay-300" />
        </div>

        <button
          onClick={leaveMatchmaking}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm border border-slate-600 transition-colors shadow-md"
        >
          Cancel Search
        </button>
      </div>
    </div>
  );
};
