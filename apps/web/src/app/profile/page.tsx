'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useGameSocket } from '../../context/GameSocketContext';

export default function ProfilePage() {
  const { currentUser, setCurrentUser, isConnected } = useGameSocket();
  const [editingUsername, setEditingUsername] = useState(currentUser.username);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUsername.trim()) return;

    const updated = {
      ...currentUser,
      username: editingUsername.trim(),
    };
    setCurrentUser(updated);
    try {
      localStorage.setItem('rummy_player_profile', JSON.stringify(updated));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem('rummy_token');
    localStorage.removeItem('rummy_player_profile');
    sessionStorage.removeItem('rummy_active_table');
    sessionStorage.removeItem('rummy_in_matchmaking');
    window.location.assign('/login');
  };

  return (
    <div className="min-h-[calc(100vh-56px)] lobby-theme text-white p-4 sm:p-6 select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#8D1420]">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD96A] via-[#F6BE36] to-amber-100 uppercase tracking-wide">
              Player Profile
            </h1>
            <p className="text-xs text-amber-200/70 font-semibold tracking-wider mt-0.5">
              Manage your Rummy Royale account and gameplay identity
            </p>
          </div>
          <Link
            href="/"
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#250408] hover:bg-[#470A10] border border-[#8D1420] text-xs font-bold text-amber-300 transition-colors shadow-sm"
          >
            ← Back to Lobby
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Player Avatar Card */}
          <div className="bg-[#250408]/90 border border-[#8D1420] rounded-3xl p-6 flex flex-col items-center text-center shadow-xl">
            <div className="w-20 h-20 rounded-full border-2 border-[#F6BE36] p-0.5 mb-3 shadow-md overflow-hidden bg-[#1A0306]">
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`}
                alt={currentUser.username}
                className="w-full h-full rounded-full"
              />
            </div>

            <h3 className="text-base font-black text-white truncate max-w-[180px]">
              {currentUser.username}
            </h3>
            <span className="text-[11px] text-amber-200/60 font-mono mt-0.5">
              ID: {currentUser.userId}
            </span>

            <div className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-[#1A0306] rounded-full border border-[#8D1420] text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
                }`}
              />
              <span className="font-semibold text-slate-300">
                {isConnected ? 'Server Online' : 'Connecting...'}
              </span>
            </div>

            {/* Virtual Practice Balance */}
            <div className="w-full bg-[#180306] rounded-2xl p-3.5 mt-5 border border-[#8D1420] text-left">
              <span className="text-[10px] text-amber-300/80 font-bold uppercase tracking-wider block mb-1">
                Virtual Chips Balance
              </span>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-2xl">🪙</span>
                <div>
                  <div className="text-lg font-black text-amber-200">10,000</div>
                  <div className="text-[10px] text-slate-400">Free Practice Chips</div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="w-full mt-4 space-y-2">
              <Link
                href="/history"
                className="w-full block py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[#8D1420] text-amber-200 font-bold text-xs text-center transition"
              >
                📜 View Match History
              </Link>
              <button
                onClick={handleLogout}
                className="w-full py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-200 font-bold text-xs text-center transition"
              >
                🚪 Logout Account
              </button>
            </div>
          </div>

          {/* Right: Account Settings & Verification */}
          <div className="md:col-span-2 space-y-6">
            {/* Edit Display Name */}
            <div className="bg-[#250408]/90 border border-[#8D1420] rounded-3xl p-6 shadow-xl">
              <h4 className="text-sm font-black text-amber-200 uppercase tracking-wide mb-3">
                Account Settings
              </h4>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Player Display Name
                  </label>
                  <input
                    type="text"
                    value={editingUsername}
                    onChange={(e) => setEditingUsername(e.target.value)}
                    className="w-full bg-[#180306] border border-[#8D1420] focus:border-[#F6BE36] focus:ring-1 focus:ring-[#F6BE36] rounded-xl px-3.5 py-2 text-sm text-white outline-none transition"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#159A43] to-[#107A35] hover:from-[#19B54F] hover:to-[#138E3F] text-white font-black text-xs uppercase tracking-wider shadow-md transition"
                  >
                    Save Changes
                  </button>

                  {savedSuccess && (
                    <span className="text-xs font-bold text-emerald-400 animate-fade-in flex items-center gap-1">
                      <span>✓</span> Saved successfully!
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Legal & Responsible Play Notice */}
            <div className="bg-[#250408]/90 border border-[#8D1420] rounded-3xl p-6 shadow-xl space-y-3">
              <h4 className="text-sm font-black text-amber-200 uppercase tracking-wide">
                Responsible Gaming &amp; Security
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Rummy Royale operates strictly with free, virtual entertainment chips. No real money deposits, withdrawals, or cash wagering are supported. Play responsibly and enjoy the skill and strategy of Indian Rummy.
              </p>
              <div className="pt-2 flex items-center gap-4 text-xs text-amber-300/80">
                <span>🛡️ RNG Certified</span>
                <span>•</span>
                <span>🔒 Secure Session</span>
                <span>•</span>
                <span>⚖️ Fair Play Policy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
