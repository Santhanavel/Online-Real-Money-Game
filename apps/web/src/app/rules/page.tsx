import React from 'react';

export default function RulesPage() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-amber-200">Official Indian Rummy Rules</h1>
          <p className="text-xs text-slate-400 mt-1">
            Rules, sequences, sets, declaration guidelines and penalty calculations
          </p>
        </div>
        <a
          href="/"
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
        >
          ← Back to Lobby
        </a>
      </div>

      <div className="space-y-6 text-sm text-slate-300">
        {/* 1. Core Objective */}
        <section className="bg-slate-900/80 rounded-2xl p-6 border border-amber-500/20 shadow-lg">
          <h2 className="text-lg font-black text-amber-300 mb-2">1. Objective of the Game</h2>
          <p className="leading-relaxed">
            In 13-Card Indian Rummy, each player is dealt 13 cards. The goal is to arrange all 13 cards into valid sequences and sets and make a valid Declaration (Show). A valid hand requires:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 font-semibold text-emerald-300">
            <li>At least two sequences.</li>
            <li>At least one Pure Sequence (without any jokers).</li>
            <li>The second sequence can be pure or impure.</li>
            <li>All other cards must be grouped into valid sequences or valid sets. Zero ungrouped cards.</li>
          </ul>
        </section>

        {/* 2. Sequences */}
        <section className="bg-slate-900/80 rounded-2xl p-6 border border-amber-500/20 shadow-lg">
          <h2 className="text-lg font-black text-amber-300 mb-2">2. Pure vs Impure Sequences</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="bg-emerald-950/40 p-4 rounded-xl border border-emerald-500/30">
              <h3 className="font-bold text-emerald-300 mb-1">Pure Sequence (Mandatory)</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                3 or more consecutive cards of the same suit formed without any joker acting as a substitute.
              </p>
              <div className="mt-2 text-xs font-mono bg-black/40 p-2 rounded text-emerald-200">
                Valid: 4♥ 5♥ 6♥ or A♠ 2♠ 3♠ or Q♦ K♦ A♦
              </div>
              <p className="text-[11px] text-amber-300 mt-2">
                Note: A wild joker card used in its natural suit & rank (e.g. 7♠ in 6♠-7♠-8♠) is still considered a Pure Sequence.
              </p>
            </div>

            <div className="bg-blue-950/40 p-4 rounded-xl border border-blue-500/30">
              <h3 className="font-bold text-blue-300 mb-1">Impure Sequence</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                3 or more consecutive cards of the same suit where one or more jokers (wild or printed) substitute for missing cards.
              </p>
              <div className="mt-2 text-xs font-mono bg-black/40 p-2 rounded text-blue-200">
                Valid: 4♥ [Joker] 6♥ or 10♠ J♠ [Wild 3♦] K♠
              </div>
            </div>
          </div>

          <div className="bg-red-950/40 p-3 rounded-xl border border-red-500/30 mt-4 text-xs text-red-200">
            <strong>Ace Rule:</strong> Ace can be Low (A-2-3) or High (Q-K-A). Wrap-around sequences like <strong>K-A-2</strong> are strictly INVALID.
          </div>
        </section>

        {/* 3. Sets */}
        <section className="bg-slate-900/80 rounded-2xl p-6 border border-amber-500/20 shadow-lg">
          <h2 className="text-lg font-black text-amber-300 mb-2">3. Sets</h2>
          <p className="leading-relaxed">
            A set consists of 3 or 4 cards of the same rank with <strong>distinct suits</strong>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <span className="text-xs font-bold text-emerald-400 block mb-1">Valid Sets:</span>
              <p className="text-xs font-mono text-slate-200">
                7♥ 7♦ 7♣ (3 cards, different suits)<br />
                K♥ K♦ K♣ K♠ (4 cards, all 4 suits)<br />
                8♥ 8♦ [Printed Joker] (valid with joker)
              </p>
            </div>
            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <span className="text-xs font-bold text-rose-400 block mb-1">Strictly Invalid Sets:</span>
              <p className="text-xs font-mono text-slate-300">
                7♥ 7♥ 7♦ (duplicate suits from 2 decks are rejected)<br />
                K♥ K♦ K♣ K♠ [Joker] (sets cannot exceed 4 cards)
              </p>
            </div>
          </div>
        </section>

        {/* 4. Drop Penalties & Scoring */}
        <section className="bg-slate-900/80 rounded-2xl p-6 border border-amber-500/20 shadow-lg">
          <h2 className="text-lg font-black text-amber-300 mb-2">4. Penalties & Scoring</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-center">
            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-slate-400 block font-semibold">First Drop</span>
              <span className="text-xl font-black text-amber-400">20 pts</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Drop without drawing</span>
            </div>
            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-slate-400 block font-semibold">Middle Drop</span>
              <span className="text-xl font-black text-amber-400">40 pts</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Drop after drawing</span>
            </div>
            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-slate-400 block font-semibold">Wrong Show</span>
              <span className="text-xl font-black text-rose-400">80 pts</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Invalid declaration</span>
            </div>
            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-slate-400 block font-semibold">Max Cap</span>
              <span className="text-xl font-black text-emerald-400">80 pts</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Maximum hand penalty</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
