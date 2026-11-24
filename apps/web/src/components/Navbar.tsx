'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useGameSocket } from '../context/GameSocketContext';

export const Navbar: React.FC = () => {
  const { isConnected, currentUser, activeTableId } = useGameSocket();
  const pathname = usePathname();

  // Hide lobby header if currently at the game table
  if (activeTableId) {
    return null;
  }

  return (
    <header className="w-full bg-gradient-to-r from-[#240407] via-[#37070D] to-[#240407] border-b border-[#8D1420]/80 px-3 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-40 select-none shadow-xl">
      {/* Left: Hamburger Menu & Mobile Trigger */}
      <div className="flex items-center gap-3">
        <button
          className="w-9 h-9 rounded-xl bg-black/40 hover:bg-black/60 border border-[#8D1420] text-amber-300 flex items-center justify-center text-lg transition active:scale-95 shadow-inner"
          title="Menu"
        >
          ☰
        </button>

        {/* Brand Logo & Crown */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFE17D] via-[#F6BE36] to-[#B92730] flex items-center justify-center font-black text-[#250408] text-lg shadow-md border border-[#FFD96A]/60 group-hover:scale-105 transition-transform">
            👑
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black text-base tracking-wider bg-gradient-to-r from-[#FFD96A] via-[#F6BE36] to-amber-200 bg-clip-text text-transparent">
              RUMMY ROYALE
            </span>
            <span className="text-[8px] font-extrabold text-amber-200/70 tracking-widest uppercase mt-0.5">
              Online Indian Rummy
            </span>
          </div>
        </Link>
      </div>

      {/* Desktop Quick Nav */}
      <nav className="hidden lg:flex items-center gap-2 text-xs font-bold">
        {[
          { label: 'Lobby', href: '/' },
          { label: 'Game History', href: '/history' },
          { label: 'How to Play', href: '/rules' },
          { label: 'Profile', href: '/profile' },
        ].map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#8D1420] to-[#5C0A13] text-[#FFD96A] font-black border border-[#F6BE36]/50 shadow-md'
                  : 'text-amber-100/70 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right Area: Notification & Gold Chips Container */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notification Bell with Badge */}
        <button
          className="relative w-9 h-9 rounded-xl bg-black/40 hover:bg-black/60 border border-[#8D1420] text-amber-200 flex items-center justify-center text-sm transition active:scale-95 shadow-inner"
          title="Notifications"
        >
          <span>🔔</span>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 border border-white text-white rounded-full text-[9px] font-black flex items-center justify-center">
            1
          </span>
        </button>

        {/* Master Sheet Styled Chips Balance Pill: [ 🪙 10,000 + ] */}
        <div className="flex items-center bg-[#1C0306] rounded-full border border-amber-400/50 shadow-md pl-2 pr-1 py-1 gap-1.5">
          <span className="text-sm">🪙</span>
          <span className="font-black text-amber-200 text-xs sm:text-sm tracking-wide">10,000</span>
          <button
            className="w-5 h-5 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-black font-black text-xs flex items-center justify-center shadow-sm ml-0.5 transition active:scale-90"
            title="Add Practice Chips"
          >
            +
          </button>
        </div>

        {/* User Pill / Profile Status */}
        <Link
          href="/profile"
          className="flex items-center gap-1.5 bg-[#1C0306] hover:bg-[#2B0509] px-2.5 py-1 rounded-full border border-[#8D1420] transition-colors cursor-pointer group"
          title="Account Profile"
        >
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-500 animate-pulse'
            }`}
            title={isConnected ? 'Server Connected' : 'Connecting to server...'}
          />
          <span suppressHydrationWarning className="text-xs font-bold text-amber-100 max-w-[85px] truncate group-hover:text-white">
            {currentUser?.username || 'Player'}
          </span>
        </Link>
      </div>
    </header>
  );
};
