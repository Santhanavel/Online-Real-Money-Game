'use client';

import React, { useState } from 'react';
import { GameVariant } from '@rummy/shared-types';
import { useGameSocket } from '../context/GameSocketContext';
import { GameTable } from '../components/GameTable';

export default function LobbyPage() {
  const { activeTableId, joinMatchmaking } = useGameSocket();

  const [selectedTab, setSelectedTab] = useState<'POINTS' | 'POOL'>('POINTS');
  const [selectedMaxPlayers, setSelectedMaxPlayers] = useState<2 | 6>(2);

  // If in an active game session, render the GameTable!
  if (activeTableId) {
    return <GameTable />;
  }

  const pointsTables = [
    { pointValue: 0.05, label: 'Micro Points', desc: 'Fast single-deal match' },
    { pointValue: 0.10, label: 'Standard Points', desc: 'Popular beginner table' },
    { pointValue: 0.50, label: 'Pro Points', desc: 'Competitive single deal' },
    { pointValue: 1.00, label: 'High Stakes Points', desc: 'Classic Points Rummy' },
  ];

  const poolTables = [
    { variant: 'POOL_101' as GameVariant, title: '101 Pool Rummy', limit: 101, desc: 'Elimination at 101 penalty points' },
    { variant: 'POOL_201' as GameVariant, title: '201 Pool Rummy', limit: 201, desc: 'Longer tournament format, elimination at 201' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 flex flex-col items-center">
      {/* Hero Banner */}
      <div className="w-full text-center mb-8 relative">
        <span className="inline-block px-4 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-widest mb-3">
          100% Server Authoritative Indian Rummy
        </span>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2">
          SELECT YOUR GAME TABLE
        </h1>
        <p className="text-slate-400 text-sm max-w-xl mx-auto">
          Play authentic 13-card Indian Rummy in real-time. Choose between fast single-deal Points Rummy or multi-deal Pool elimination.
        </p>
      </div>

      {/* Mode Tabs: Points vs Pool */}
      <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-amber-500/30 shadow-xl mb-6">
        <button
          onClick={() => setSelectedTab('POINTS')}
          className={`px-8 py-2.5 rounded-xl font-black text-sm tracking-wide transition-all ${
            selectedTab === 'POINTS'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Points Rummy
        </button>
        <button
          onClick={() => setSelectedTab('POOL')}
          className={`px-8 py-2.5 rounded-xl font-black text-sm tracking-wide transition-all ${
            selectedTab === 'POOL'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Pool Rummy (101 & 201)
        </button>
      </div>

      {/* Player Capacity Selector (2 Players vs 6 Players) */}
      <div className="flex items-center gap-3 mb-8 bg-slate-900/60 px-4 py-2 rounded-xl border border-white/5">
        <span className="text-xs font-bold text-slate-400">Table Capacity:</span>
        <button
          onClick={() => setSelectedMaxPlayers(2)}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            selectedMaxPlayers === 2
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          2 Players (Heads Up)
        </button>
        <button
          onClick={() => setSelectedMaxPlayers(6)}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            selectedMaxPlayers === 6
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          6 Players (Full Table)
        </button>
      </div>

      {/* Lobby Tables Grid */}
      {selectedTab === 'POINTS' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
          {pointsTables.map((tbl) => (
            <div
              key={tbl.pointValue}
              className="bg-gradient-to-b from-slate-900 via-slate-900/80 to-emerald-950/40 rounded-2xl p-5 border border-amber-500/20 hover:border-amber-400 transition-all flex flex-col justify-between shadow-xl group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400/90 tracking-wide">
                    {tbl.label}
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                    {selectedMaxPlayers}P
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white mb-1">
                  ₹{tbl.pointValue.toFixed(2)} <span className="text-xs text-slate-400 font-normal">/ point</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">{tbl.desc}</p>
                <div className="bg-black/30 p-2.5 rounded-xl text-[11px] text-slate-300 space-y-1 mb-5">
                  <div className="flex justify-between">
                    <span>Format:</span>
                    <span className="font-bold text-amber-300">Single Deal</span>
                  </div>
                  <div className="flex justify-between">
                    <span>First / Mid Drop:</span>
                    <span className="font-bold text-slate-200">20 / 40 pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Penalty:</span>
                    <span className="font-bold text-slate-200">80 pts</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => joinMatchmaking('POINTS', tbl.pointValue, selectedMaxPlayers)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 group-hover:scale-[1.02] transition-all"
              >
                Join Table
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {poolTables.map((tbl) => (
            <div
              key={tbl.variant}
              className="bg-gradient-to-b from-slate-900 via-slate-900/80 to-emerald-950/40 rounded-2xl p-6 border border-amber-500/20 hover:border-amber-400 transition-all flex flex-col justify-between shadow-xl group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400 tracking-wide uppercase">
                    Cumulative Elimination
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                    {selectedMaxPlayers}P
                  </span>
                </div>
                <h3 className="text-3xl font-black text-white mb-2">{tbl.title}</h3>
                <p className="text-xs text-slate-400 mb-4">{tbl.desc}</p>
                <div className="bg-black/30 p-3 rounded-xl text-xs text-slate-300 space-y-1.5 mb-6">
                  <div className="flex justify-between">
                    <span>Elimination Threshold:</span>
                    <span className="font-bold text-rose-400">≥ {tbl.limit} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deal Progression:</span>
                    <span className="font-bold text-amber-300">Continuous until 1 winner</span>
                  </div>
                  <div className="flex justify-between">
                    <span>First / Mid Drop:</span>
                    <span className="font-bold text-slate-200">20 / 40 pts</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => joinMatchmaking(tbl.variant, 1.0, selectedMaxPlayers)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 group-hover:scale-[1.02] transition-all"
              >
                Play {tbl.title}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
