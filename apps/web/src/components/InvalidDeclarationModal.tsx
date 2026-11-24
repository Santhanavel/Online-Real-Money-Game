'use client';

import React from 'react';
import { DeclarationResultPayload } from '@rummy/shared-types';

interface InvalidDeclarationModalProps {
  declarationResult: DeclarationResultPayload;
  onDismiss: () => void;
}

export const InvalidDeclarationModal: React.FC<InvalidDeclarationModalProps> = ({
  declarationResult,
  onDismiss,
}) => {
  const missingReqs = declarationResult.missingRequirements || [
    declarationResult.errorMessage || declarationResult.reason || 'Invalid card combination',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 select-none animate-fade-in">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#3a060b] via-[#240407] to-[#120204] border-2 border-rose-500/70 rounded-3xl shadow-2xl p-5 sm:p-6 flex flex-col items-center text-center overflow-hidden">
        {/* Glowing Alert Icon */}
        <div className="w-16 h-16 rounded-full bg-rose-950/80 border-2 border-rose-500 flex items-center justify-center text-3xl mb-3 shadow-lg shadow-rose-900/50 animate-pulse">
          ⚠️
        </div>

        {/* Heading matching Issue 3 specification */}
        <h2 className="text-xl sm:text-2xl font-black text-rose-300 uppercase tracking-wider mb-1">
          Invalid Declaration
        </h2>
        <span className="text-xs text-rose-200/80 font-semibold mb-4">
          Your declared arrangement does not satisfy Indian Rummy rules
        </span>

        {/* Missing Requirements List */}
        <div className="w-full bg-black/50 border border-rose-500/30 rounded-2xl p-3.5 mb-4 text-left">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 block mb-2">
            Identified Deficiencies:
          </span>
          <div className="space-y-2">
            {missingReqs.map((req, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                <span className="text-rose-400 font-bold">✕</span>
                <span className="leading-snug">{req}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Explanation separating immediate notification from official server penalty */}
        <div className="w-full bg-rose-950/30 border border-rose-500/20 rounded-xl px-3 py-2 mb-5 text-[11px] text-amber-200/80 leading-snug">
          The deal will be finalized on the server, and the penalty will be reflected on the unified scoreboard.
        </div>

        {/* Acknowledge Button */}
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-900/50 transition active:scale-95 cursor-pointer"
        >
          Acknowledge &amp; View Result
        </button>
      </div>
    </div>
  );
};
