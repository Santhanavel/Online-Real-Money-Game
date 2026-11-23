'use client';

import React from 'react';
import { useGameSocket } from '../context/GameSocketContext';

export const Navbar: React.FC = () => {
  const { isConnected, currentUser } = useGameSocket();

  return (
    <header className="w-full bg-slate-950/80 backdrop-blur-md border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between sticky top-0 z-40">
      {/* Brand */}
      <a href="/" className="flex items-center gap-2 group">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-300 flex items-center justify-center font-black text-slate-950 text-lg shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
          ♠
        </div>
        <div>
          <span className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            RUMMY ROYALE
          </span>
          <span className="text-[10px] block font-semibold text-emerald-400 uppercase tracking-widest leading-none">
            Points & Pool Rummy
          </span>
        </div>
      </a>

      {/* Navigation Links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-300">
        <a href="/" className="hover:text-amber-400 transition-colors">
          Lobby
        </a>
        <a href="/history" className="hover:text-amber-400 transition-colors">
          Game History
        </a>
        <a href="/rules" className="hover:text-amber-400 transition-colors">
          How to Play
        </a>
        <a href="/admin" className="hover:text-amber-400 transition-colors text-amber-400/90 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-ping" />
          Admin Portal
        </a>
      </nav>

      {/* User Status / Connection */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-full border border-slate-700/60 shadow-sm">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-500 animate-pulse'
            }`}
            title={isConnected ? 'Server Online' : 'Connecting...'}
          />
          <span suppressHydrationWarning className="text-xs font-bold text-slate-200">
            {currentUser.username}
          </span>
        </div>
      </div>
    </header>
  );
};
