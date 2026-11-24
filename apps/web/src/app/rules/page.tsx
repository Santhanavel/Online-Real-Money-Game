'use client';

import React from 'react';
import Link from 'next/link';

export default function RulesPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] lobby-theme text-white p-4 sm:p-6 select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#8D1420]">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD96A] via-[#F6BE36] to-amber-100 uppercase tracking-wide">
              Official Indian Rummy Rules
            </h1>
            <p className="text-xs text-amber-200/70 font-semibold tracking-wider mt-0.5">
              13-card rules, pure sequences, sets, joker substitutions, and format guidelines
            </p>
          </div>
          <Link
            href="/"
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#250408] hover:bg-[#470A10] border border-[#8D1420] text-xs font-bold text-amber-300 transition-colors shadow-sm"
          >
            ← Back to Lobby
          </Link>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-200">
          {/* 1. Core Objective */}
          <section className="bg-[#250408]/90 rounded-3xl p-5 sm:p-6 border border-[#8D1420] shadow-xl">
            <h2 className="text-base font-black text-[#F6BE36] mb-2 uppercase tracking-wide">
              1. Objective of the Game
            </h2>
            <p className="leading-relaxed">
              In 13-Card Indian Rummy, each player receives 13 cards. The objective is to arrange all 13 cards into valid sequences and sets and make a valid Show (Declaration). A valid hand requires:
            </p>
            <ul className="list-disc pl-5 mt-2.5 space-y-1.5 font-semibold text-amber-200">
              <li>At least two sequences.</li>
              <li>At least one Pure Sequence (mandatory, no jokers used as substitutes).</li>
              <li>The second sequence can be pure or impure (with jokers).</li>
              <li>All remaining cards must be grouped into valid sequences or sets with zero ungrouped cards.</li>
            </ul>
          </section>

          {/* 2. Sequences */}
          <section className="bg-[#250408]/90 rounded-3xl p-5 sm:p-6 border border-[#8D1420] shadow-xl">
            <h2 className="text-base font-black text-[#F6BE36] mb-2 uppercase tracking-wide">
              2. Pure vs Impure Sequences
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="bg-[#1A0306] p-4 rounded-2xl border border-emerald-500/30">
                <h3 className="font-bold text-emerald-400 mb-1">Pure Sequence (Mandatory)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  3 or more consecutive cards of the same suit formed without any joker acting as a substitute.
                </p>
                <div className="mt-2.5 text-xs font-mono bg-black/60 p-2.5 rounded-xl text-emerald-300">
                  Example: 4♥ 5♥ 6♥ or A♠ 2♠ 3♠ or Q♦ K♦ A♦
                </div>
                <p className="text-[11px] text-amber-300/80 mt-2">
                  Note: A wild joker card used in its natural suit &amp; rank (e.g. 7♠ in 6♠-7♠-8♠) is counted as a Pure Sequence.
                </p>
              </div>

              <div className="bg-[#1A0306] p-4 rounded-2xl border border-blue-500/30">
                <h3 className="font-bold text-blue-400 mb-1">Impure Sequence</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  3 or more consecutive cards of the same suit where one or more jokers substitute for missing ranks.
                </p>
                <div className="mt-2.5 text-xs font-mono bg-black/60 p-2.5 rounded-xl text-blue-300">
                  Example: 4♥ [Joker] 6♥ or 10♠ J♠ [Wild 3♦] K♠
                </div>
              </div>
            </div>
          </section>

          {/* 3. Valid Sets */}
          <section className="bg-[#250408]/90 rounded-3xl p-5 sm:p-6 border border-[#8D1420] shadow-xl">
            <h2 className="text-base font-black text-[#F6BE36] mb-2 uppercase tracking-wide">
              3. Valid Sets
            </h2>
            <p className="leading-relaxed">
              A Set is formed by 3 or 4 cards of the same rank from strictly distinct suits. Two cards of the same suit cannot be part of the same set, even across multiple decks.
            </p>
            <div className="mt-2.5 text-xs font-mono bg-black/60 p-2.5 rounded-xl text-amber-300">
              Valid: 7♠ 7♥ 7♦ (or 7♠ 7♥ 7♦ [Joker]) • Disallowed: 7♠ 7♠ 7♦ (duplicate suits invalid)
            </div>
          </section>

          {/* 4. Drop and Penalty Rules */}
          <section className="bg-[#250408]/90 rounded-3xl p-5 sm:p-6 border border-[#8D1420] shadow-xl">
            <h2 className="text-base font-black text-[#F6BE36] mb-2 uppercase tracking-wide">
              4. Drop and Penalty Rules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="bg-[#1A0306] p-3.5 rounded-2xl border border-[#8D1420]">
                <span className="font-bold text-slate-300 block text-xs">First Drop</span>
                <span className="text-rose-400 font-black text-lg">20 Points</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Dropping before drawing any card</p>
              </div>
              <div className="bg-[#1A0306] p-3.5 rounded-2xl border border-[#8D1420]">
                <span className="font-bold text-slate-300 block text-xs">Middle Drop</span>
                <span className="text-rose-400 font-black text-lg">40 Points</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Dropping on any subsequent turn</p>
              </div>
              <div className="bg-[#1A0306] p-3.5 rounded-2xl border border-[#8D1420]">
                <span className="font-bold text-slate-300 block text-xs">Wrong Declaration</span>
                <span className="text-rose-400 font-black text-lg">80 Points</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Declaring an invalid show</p>
              </div>
            </div>
          </section>

          {/* 5. Approved Formats */}
          <section className="bg-[#250408]/90 rounded-3xl p-5 sm:p-6 border border-[#8D1420] shadow-xl">
            <h2 className="text-base font-black text-[#F6BE36] mb-2 uppercase tracking-wide">
              5. Approved Game Formats
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="bg-[#1A0306] p-3.5 rounded-2xl border border-[#8D1420]">
                <h3 className="font-black text-white text-xs">⚡ Points Rummy</h3>
                <p className="text-[11px] text-slate-300 mt-1">
                  Classic single-deal rummy. Winner gets 0 penalty. Losers score points based on unmelded cards up to the 80-point cap.
                </p>
              </div>
              <div className="bg-[#1A0306] p-3.5 rounded-2xl border border-[#8D1420]">
                <h3 className="font-black text-white text-xs">🎯 Pool 240</h3>
                <p className="text-[11px] text-slate-300 mt-1">
                  Multi-deal elimination pool game. Cumulative penalties accumulate across deals; players hitting 240 points are knocked out.
                </p>
              </div>
              <div className="bg-[#1A0306] p-3.5 rounded-2xl border border-[#8D1420]">
                <h3 className="font-black text-white text-xs">🏊 Pool 101</h3>
                <p className="text-[11px] text-slate-300 mt-1">
                  Knockout pool game where reaching 101 points results in elimination. Last surviving player wins.
                </p>
              </div>
              <div className="bg-[#1A0306] p-3.5 rounded-2xl border border-[#8D1420]">
                <h3 className="font-black text-white text-xs">🏆 Pool 201</h3>
                <p className="text-[11px] text-slate-300 mt-1">
                  Strategic endurance pool format with 201 point elimination limit for longer competitive sessions.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
