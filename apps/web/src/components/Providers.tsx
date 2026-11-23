'use client';

import React from 'react';
import { GameSocketProvider } from '../context/GameSocketContext';
import { Navbar } from './Navbar';
import { MatchmakingModal } from './MatchmakingModal';

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <GameSocketProvider>
      <Navbar />
      <main className="flex-1 flex flex-col">{children}</main>
      <MatchmakingModal />
    </GameSocketProvider>
  );
};
