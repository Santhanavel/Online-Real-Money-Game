'use client';

import React from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="text-3xl font-black text-rose-400 mb-2">Something went wrong</h2>
      <p className="text-xs text-slate-400 mb-6 max-w-md">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-slate-700"
        >
          Try Again
        </button>
        <a
          href="/"
          className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400"
        >
          Back to Lobby
        </a>
      </div>
    </div>
  );
}
