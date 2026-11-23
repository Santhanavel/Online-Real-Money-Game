import React from 'react';

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">♠</div>
      <h2 className="text-3xl font-black text-amber-300 mb-2">404 - Page Not Found</h2>
      <p className="text-xs text-slate-400 mb-6">
        The table or page you are looking for does not exist.
      </p>
      <a
        href="/"
        className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400"
      >
        Return to Lobby
      </a>
    </div>
  );
}
