'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GameVariant, EntryAmount, VALID_ENTRY_AMOUNTS } from '@rummy/shared-types';
import { useGameSocket } from '../context/GameSocketContext';
import { GameTable } from '../components/GameTable';

export default function LobbyPage() {
  const { activeTableId, resumableTableId, returnToTable, isConnected, currentUser, joinMatchmaking } = useGameSocket();
  const pathname = usePathname();

  // Splash screen state (Screen 1 from Master Sheet)
  const [showSplash, setShowSplash] = useState(false);
  const [splashProgress, setSplashProgress] = useState(0);

  // Flow State: 'LOBBY' (Screen 5) or 'TABLE_SELECT' (Screen 6)
  const [currentScreen, setCurrentScreen] = useState<'LOBBY' | 'TABLE_SELECT'>('LOBBY');

  // Selected format and configuration
  const [selectedFormat, setSelectedFormat] = useState<GameVariant>('POINTS');
  const [selectedCapacity, setSelectedCapacity] = useState<2 | 6>(2);
  const [selectedEntryAmount, setSelectedEntryAmount] = useState<EntryAmount>(100);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Check if splash was already shown this session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const splashSeen = sessionStorage.getItem('rummy_splash_seen');
      if (!splashSeen) {
        setShowSplash(true);
        let progress = 10;
        const interval = setInterval(() => {
          progress += 25;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => {
              setShowSplash(false);
              sessionStorage.setItem('rummy_splash_seen', 'true');
            }, 300);
          }
          setSplashProgress(progress);
        }, 120);
        return () => clearInterval(interval);
      }
    }
  }, []);

  // If in an active game session, render the GameTable (Screen 9)
  if (activeTableId) {
    return <GameTable />;
  }

  const handleOpenTableSelect = (variant: GameVariant) => {
    setSelectedFormat(variant);
    setCurrentScreen('TABLE_SELECT');
  };

  const handleJoinTable = () => {
    const pointValue = selectedFormat === 'POINTS' ? Number((selectedEntryAmount / 80).toFixed(2)) : 1;
    joinMatchmaking(selectedFormat, selectedEntryAmount, selectedCapacity, pointValue);
  };

  const gameOptions = [
    {
      id: 'POINTS' as GameVariant,
      title: 'Points Rummy',
      subtitle: 'Classic Single Deal',
      badge: '1 DEAL',
      cardTheme: 'crimson',
      badgeNum: '♠',
      description: 'Quick single-deal game where each point holds fixed value. Fastest game format.',
    },
    {
      id: 'POOL_240' as GameVariant,
      title: 'Pool 240',
      subtitle: 'Elimination at 240',
      badge: 'KNOCKOUT',
      cardTheme: 'green',
      badgeNum: '240',
      description: 'Multi-deal elimination pool game. Players reaching 240 points are knocked out.',
    },
    {
      id: 'POOL_101' as GameVariant,
      title: 'Pool 101',
      subtitle: 'Knockout at 101',
      badge: 'KNOCKOUT',
      cardTheme: 'green',
      badgeNum: '101',
      description: 'Multi-deal tournament style. Players reaching 101 points are eliminated.',
    },
    {
      id: 'POOL_201' as GameVariant,
      title: 'Pool 201',
      subtitle: 'Knockout at 201',
      badge: 'KNOCKOUT',
      cardTheme: 'darkgreen',
      badgeNum: '201',
      description: 'Endurance pool rummy. Higher ceiling of 201 points gives room for strategic comeback.',
    },
  ];

  const activeGame = gameOptions.find((g) => g.id === selectedFormat) || gameOptions[0];

  // SCREEN 1: SPLASH / LOADING SCREEN (Master Sheet Screen 1)
  if (showSplash) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#4A0A10] via-[#2A0408] to-[#120204] text-white select-none">
        {/* Sunburst Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(246,190,54,0.18)_0%,_transparent_70%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center animate-fade-in">
          {/* Glowing Crown Flame Ace Logo */}
          <div className="relative w-28 h-28 mb-4 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-300 opacity-60 blur-xl animate-pulse" />
            <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[#FFE17D] via-[#F6BE36] to-[#B92730] p-1 shadow-2xl border border-amber-200/60 flex items-center justify-center">
              <span className="text-5xl font-black text-[#220406] drop-shadow-md">👑</span>
            </div>
          </div>

          <h1 className="text-3xl font-black tracking-wider uppercase bg-gradient-to-r from-[#FFD96A] via-[#F6BE36] to-amber-200 bg-clip-text text-transparent drop-shadow-lg">
            Rummy Royale
          </h1>
          <span className="text-xs font-black tracking-widest uppercase text-amber-200/80 mt-1 mb-8">
            Online Indian Rummy
          </span>

          {/* Fanned Cards Graphic */}
          <div className="relative w-36 h-24 flex items-center justify-center mb-10">
            <div className="w-12 h-18 rounded-lg bg-white text-slate-900 border border-slate-300 shadow-xl transform -rotate-15 -translate-x-4 flex flex-col justify-between p-1.5 text-xs font-black">
              <span>♠</span>
              <span className="self-center text-sm">A</span>
            </div>
            <div className="w-12 h-18 rounded-lg bg-white text-rose-600 border border-slate-300 shadow-2xl transform -translate-y-2 z-10 flex flex-col justify-between p-1.5 text-xs font-black">
              <span>♥</span>
              <span className="self-center text-sm">A</span>
            </div>
            <div className="w-12 h-18 rounded-lg bg-white text-rose-600 border border-slate-300 shadow-xl transform rotate-15 translate-x-4 flex flex-col justify-between p-1.5 text-xs font-black">
              <span>♦</span>
              <span className="self-center text-sm">A</span>
            </div>
          </div>

          {/* Golden Progress Bar */}
          <div className="w-full max-w-[220px]">
            <div className="w-full h-2.5 bg-black/60 rounded-full border border-amber-400/40 overflow-hidden shadow-inner p-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 rounded-full transition-all duration-200"
                style={{ width: `${splashProgress}%` }}
              />
            </div>
            <span className="block text-[11px] font-bold text-amber-200/90 mt-2">
              Loading... {splashProgress}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-56px)] lobby-theme text-white flex flex-col justify-between pb-16 lg:pb-6 select-none">
      <div className="max-w-5xl mx-auto w-full px-3 sm:px-6 pt-4 sm:pt-6">
        {resumableTableId && <div className="flex items-center justify-between gap-4 mb-4 p-4 rounded-xl bg-[#310609] border border-amber-400/50">
          <span>Your table is still in progress.</span>
          <button disabled={!isConnected} onClick={returnToTable} className="gold-btn-gradient rounded-lg px-5 py-2 font-bold">Return to table</button>
        </div>}
        {/* SCREEN 5: HOME / MAIN LOBBY */}
        {currentScreen === 'LOBBY' && (
          <div className="space-y-6 animate-fade-in">
            {/* Verified Player Profile Card (Screen 5 Master Sheet) */}
            <div className="bg-gradient-to-r from-[#200407] via-[#2E0509] to-[#200407] border border-[#8D1420] rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FFE17D] via-[#F6BE36] to-[#B92730] p-0.5 shadow-md">
                    <div className="w-full h-full rounded-full bg-[#2A0408] flex items-center justify-center text-lg">
                      👤
                    </div>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-[#1C0306] rounded-full flex items-center justify-center text-[8px] text-white font-black shadow">
                    ✓
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm sm:text-base text-amber-100">
                      {currentUser?.username || 'Player_7893'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 text-[10px] font-black tracking-wide flex items-center gap-1 shadow-sm">
                      <span>✓</span>
                      <span>Verified</span>
                    </span>
                  </div>
                  <span className="text-xs text-amber-200/60 font-semibold block mt-0.5">
                    Practice table lobby
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowRulesModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-[#8D1420] text-amber-300 hover:text-amber-200 text-xs font-bold transition shadow-sm active:scale-95"
              >
                <span>ⓘ</span>
                <span className="hidden sm:inline">Game Rules</span>
              </button>
            </div>

            {/* 4 FEATURED GAME SELECTION CARDS (Screen 5 Master Sheet) */}
            <div className="lobby-variants grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {gameOptions.map((game) => {
                const isPoints = game.id === 'POINTS';

                return (
                  <button
                    key={game.id}
                    onClick={() => handleOpenTableSelect(game.id)}
                    className={`relative rounded-3xl p-4 sm:p-5 text-center transition-all duration-300 flex flex-col items-center justify-between overflow-hidden group cursor-pointer shadow-xl active:scale-95 border-2 ${
                      isPoints
                        ? 'crimson-card-bg border-[#961E28] hover:border-amber-400 hover:shadow-[0_0_20px_rgba(246,190,54,0.35)]'
                        : 'green-card-bg border-[#0C4E2B] hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                    }`}
                  >
                    {/* Visual Fanned Cards Graphic with Badge */}
                    <div className="relative w-full h-24 sm:h-28 flex items-center justify-center my-1">
                      {/* Fanned Cards Stack */}
                      <div className="relative flex items-center justify-center">
                        <div className="w-11 sm:w-12 h-16 sm:h-18 rounded-md bg-white text-slate-900 border border-slate-300 shadow-md transform -rotate-12 flex flex-col justify-between p-1 text-[10px] font-black select-none pointer-events-none">
                          <span>♠</span>
                          <span className="self-center text-xs">A</span>
                        </div>
                        <div className="w-11 sm:w-12 h-16 sm:h-18 rounded-md bg-white text-rose-600 border border-slate-300 shadow-md transform -rotate-3 -translate-y-1 flex flex-col justify-between p-1 text-[10px] font-black select-none pointer-events-none">
                          <span>♥</span>
                          <span className="self-center text-xs">K</span>
                        </div>
                        <div className="w-11 sm:w-12 h-16 sm:h-18 rounded-md bg-white text-rose-600 border border-slate-300 shadow-md transform rotate-6 flex flex-col justify-between p-1 text-[10px] font-black select-none pointer-events-none">
                          <span>♦</span>
                          <span className="self-center text-xs">Q</span>
                        </div>
                      </div>

                      {/* Central Circular Badge (matching Screen 5 art) */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-black font-black text-xs flex items-center justify-center shadow-xl border-2 border-white/80">
                          {game.badgeNum}
                        </div>
                      </div>
                    </div>

                    {/* Card Title */}
                    <div className="mt-2 text-center w-full">
                      <h3 className="text-base sm:text-lg font-black text-amber-200 tracking-wide drop-shadow group-hover:text-amber-100 transition-colors">
                        {game.title}
                      </h3>
                      <span className="text-[10px] text-amber-200/60 font-semibold block mt-0.5">
                        {game.subtitle}
                      </span>
                    </div>


                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SCREEN 6: TABLE SELECTION SCREEN (Master Sheet Screen 6) */}
        {currentScreen === 'TABLE_SELECT' && (
          <div className="animate-fade-in space-y-4">
            {/* Top Navigation Bar with Back Arrow */}
            <div className="flex items-center justify-between pb-2 border-b border-[#8D1420]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentScreen('LOBBY')}
                  className="w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 border border-amber-400/40 text-amber-200 font-bold flex items-center justify-center transition active:scale-95 shadow cursor-pointer"
                  title="Back to Lobby"
                >
                  ←
                </button>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-amber-100 uppercase tracking-wide">
                    {activeGame.title}
                  </h2>
                  <span className="text-xs text-amber-300/70 font-semibold">
                    {activeGame.description}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowRulesModal(true)}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 border border-amber-400/30 text-amber-300 flex items-center justify-center text-sm font-bold transition"
                title="Game Rules"
              >
                ⓘ
              </button>
            </div>

            {/* Main Selection Card */}
            <div className="bg-[#240407]/95 border-2 border-amber-400/30 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden space-y-6">
              {/* Capacity Selector: [ 2 Players ] [ 6 Players ] */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-white/10">
                <span className="text-xs font-black uppercase tracking-wider text-amber-200">
                  Select Player Capacity
                </span>

                <div className="bg-[#120204] p-1 rounded-2xl border border-amber-400/40 flex items-center gap-1 shadow-inner">
                  {[2, 6].map((cap) => {
                    const isSelected = selectedCapacity === cap;
                    return (
                      <button
                        key={cap}
                        onClick={() => setSelectedCapacity(cap as 2 | 6)}
                        className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'gold-btn-gradient shadow-md scale-105'
                            : 'text-amber-100/70 hover:text-white'
                        }`}
                      >
                        <span>👥</span>
                        <span>{cap} Players</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid: Left Fanned Cards Pedestal, Right 8 Gold Entry Coins */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Left 4 Cols: 3D Glowing Card Pedestal (Screen 6 artwork) */}
                <div className="hidden md:flex md:col-span-4 flex-col items-center justify-center p-4 relative">
                  <div className="relative w-40 h-44 flex items-center justify-center">
                    {/* Sunburst Aura */}
                    <div className="absolute inset-0 sunburst-radial animate-pulse" />

                    {/* Golden Circular Pedestal */}
                    <div className="absolute bottom-1 w-28 h-6 rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-600 shadow-xl border border-amber-200/50" />

                    {/* 3 Fanned Cards */}
                    <div className="relative flex items-center justify-center -translate-y-2">
                      <div className="w-14 h-20 rounded-lg bg-white text-slate-900 border border-slate-300 shadow-2xl transform -rotate-15 -translate-x-3 flex flex-col justify-between p-1.5 text-xs font-black">
                        <span>♠</span>
                        <span className="self-center text-base">K</span>
                      </div>
                      <div className="w-14 h-20 rounded-lg bg-white text-rose-600 border border-slate-300 shadow-2xl transform -translate-y-2 z-10 flex flex-col justify-between p-1.5 text-xs font-black">
                        <span>♥</span>
                        <span className="self-center text-base">Q</span>
                      </div>
                      <div className="w-14 h-20 rounded-lg bg-white text-rose-600 border border-slate-300 shadow-2xl transform rotate-15 translate-x-3 flex flex-col justify-between p-1.5 text-xs font-black">
                        <span>♦</span>
                        <span className="self-center text-base">J</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-amber-300/80 uppercase tracking-widest mt-2">
                    RNG Certified Tables
                  </span>
                </div>

                {/* Right 8 Cols: Select Entry Amount Grid */}
                <div className="md:col-span-8 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black uppercase tracking-wider text-amber-300">
                      Select Entry Amount
                    </label>
                    <span className="text-xs text-amber-200/70 font-semibold">
                      Selected: 🪙 {selectedEntryAmount.toLocaleString()}
                    </span>
                  </div>

                  {/* 8 Selectable Entry Chips matching Screen 6 */}
                  <div className="grid grid-cols-4 gap-2.5">
                    {[50, 100, 200, 500].map((amt) => {
                      const isSelected = selectedEntryAmount === amt;
                      return (
                        <button
                          key={amt}
                          onClick={() => setSelectedEntryAmount(amt as EntryAmount)}
                          className={`py-2 px-2 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#65200c] text-amber-100 border-2 border-amber-300 shadow-[0_0_10px_#fbbf2466]'
                              : 'bg-[#180306] text-amber-200/80 hover:bg-[#250408] border border-amber-400/30'
                          }`}
                        >
                          <span className="text-sm">🪙</span>
                          <span className="text-sm sm:text-base font-black mt-0.5">
                            {amt.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    {[1000, 1500, 2000].map((amt) => {
                      const isSelected = selectedEntryAmount === amt;
                      return (
                        <button
                          key={amt}
                          onClick={() => setSelectedEntryAmount(amt as EntryAmount)}
                          className={`py-2 px-2 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#65200c] text-amber-100 border-2 border-amber-300 shadow-[0_0_10px_#fbbf2466]'
                              : 'bg-[#180306] text-amber-200/80 hover:bg-[#250408] border border-amber-400/30'
                          }`}
                        >
                          <span className="text-sm">🪙</span>
                          <span className="text-sm sm:text-base font-black mt-0.5">
                            {amt.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Action Row: Rules Link & Join Table Button (Screen 6 design) */}
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  onClick={() => setShowRulesModal(true)}
                  className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1 transition"
                >
                  <span>ⓘ</span>
                  <span>Game Rules</span>
                </button>

                <button
                  onClick={handleJoinTable}
                  className="w-full sm:w-auto px-12 py-3.5 rounded-2xl gold-btn-gradient text-base font-black tracking-wider uppercase shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Join Table</span>
                  <span className="text-lg">→</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (Screen 5 Master Sheet) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#150204] via-[#240407] to-[#1F0306] border-t border-[#8D1420] px-3 py-2 flex items-center justify-around z-40 shadow-2xl backdrop-blur-md">
        {[
          { label: 'Home', href: '/', icon: '🏠' },
          { label: 'Game History', href: '/history', icon: '🕒' },
          { label: 'How to Play', href: '/rules', icon: '📖' },
          { label: 'Profile', href: '/profile', icon: '👤' },
        ].map((item) => {
          const isActive = pathname === item.href && currentScreen === 'LOBBY';
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (item.href === '/') setCurrentScreen('LOBBY');
              }}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-bold px-3 py-1 rounded-xl transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#8D1420] to-[#5C0A13] text-[#FFD96A] border border-amber-400/40 shadow-lg shadow-red-950/60'
                  : 'text-amber-100/60 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* GAME RULES MODAL */}
      {showRulesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-fade-in"
          onClick={() => setShowRulesModal(false)}
        >
          <div
            className="bg-[#2B0509] border-2 border-[#F6BE36] rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-left max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#8D1420] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📖</span>
                <h3 className="text-lg font-black text-amber-200 uppercase">
                  {activeGame.title} Rules
                </h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="w-7 h-7 rounded-lg bg-black/40 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-200 leading-relaxed">
              <div className="bg-[#1C0306] p-3 rounded-xl border border-[#8D1420]">
                <h4 className="font-black text-[#F6BE36] mb-1 uppercase tracking-wide">
                  1. Objective &amp; Hand Requirements
                </h4>
                <p>
                  Meld your 13 cards into valid sequences and sets. To declare, you must have at least <strong>two sequences</strong>, of which at least one must be a <strong>pure sequence</strong> (no jokers).
                </p>
              </div>

              <div className="bg-[#1C0306] p-3 rounded-xl border border-[#8D1420]">
                <h4 className="font-black text-[#F6BE36] mb-1 uppercase tracking-wide">
                  2. Jokers &amp; Wild Cards
                </h4>
                <p>
                  At the beginning of each deal, one wild joker is randomly selected. All cards of that rank across all suits function as jokers to complete impure sequences and sets.
                </p>
              </div>

              <div className="bg-[#1C0306] p-3 rounded-xl border border-[#8D1420]">
                <h4 className="font-black text-[#F6BE36] mb-1 uppercase tracking-wide">
                  3. Drop Penalties &amp; Elimination
                </h4>
                <p>
                  {activeGame.id === 'POINTS' && 'First Drop: 20 pts • Middle Drop: 40 pts • Wrong Show: 80 pts.'}
                  {activeGame.id === 'POOL_101' && 'First Drop: 20 pts • Middle Drop: 40 pts • Knockout at 101 pts.'}
                  {activeGame.id === 'POOL_201' && 'First Drop: 25 pts • Middle Drop: 50 pts • Knockout at 201 pts.'}
                  {activeGame.id === 'POOL_240' && 'First Drop: 25 pts • Middle Drop: 50 pts • Knockout at 240 pts.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="mt-6 w-full py-2.5 rounded-xl gold-btn-gradient text-xs font-black uppercase tracking-wider"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
