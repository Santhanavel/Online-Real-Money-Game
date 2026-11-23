'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-2xl font-bold text-amber-300 mb-2">Something went wrong</h2>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
