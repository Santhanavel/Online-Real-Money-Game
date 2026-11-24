'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'REQUEST' | 'SUCCESS'>('REQUEST');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Please enter your username or registered email');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
      const res = await fetch(`${serverUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.message || 'Unable to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lobby-theme text-white">
      <div className="w-full max-w-md bg-[#250408]/90 backdrop-blur-xl border-2 border-[#961E28] rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.85)] relative overflow-hidden">
        {/* Subtle Brand Watermark */}
        <div className="absolute -top-10 -right-10 text-9xl text-white/[0.03] font-black pointer-events-none select-none">
          ♠
        </div>

        {/* Back Link */}
        <div className="mb-4">
          <Link
            href="/login"
            className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1 transition-colors"
          >
            <span>←</span> Back to Login
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#F6BE36] to-[#B92730] flex items-center justify-center text-3xl shadow-lg border border-[#FFD96A]/40 mb-2">
            🔑
          </div>
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD96A] via-[#F6BE36] to-amber-200 tracking-wide uppercase">
            Reset Password
          </h1>
          <p className="text-xs text-amber-200/70 font-semibold tracking-wider mt-0.5">
            Enter your details to create a new password
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {step === 'SUCCESS' ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-2xl text-emerald-400">
              ✓
            </div>
            <h3 className="text-sm font-bold text-emerald-300">Password Reset Successfully!</h3>
            <p className="text-xs text-slate-300">You can now login with your new password.</p>
            <Link
              href="/login"
              className="inline-block w-full py-3 rounded-xl bg-gradient-to-r from-[#159A43] to-[#107A35] text-white font-black text-sm tracking-wider uppercase shadow-lg shadow-emerald-900/40 transition-all border border-emerald-400/30"
            >
              PROCEED TO LOGIN
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-200 mb-1">
                Username or Registered Email
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter username or email"
                className="w-full bg-[#160205] border border-[#8D1420] focus:border-[#F6BE36] focus:ring-1 focus:ring-[#F6BE36] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-200 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-[#160205] border border-[#8D1420] focus:border-[#F6BE36] focus:ring-1 focus:ring-[#F6BE36] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-200 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-[#160205] border border-[#8D1420] focus:border-[#F6BE36] focus:ring-1 focus:ring-[#F6BE36] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#159A43] to-[#107A35] hover:from-[#19B54F] hover:to-[#138E3F] text-white font-black text-sm tracking-wider uppercase shadow-lg shadow-emerald-900/40 transition-all border border-emerald-400/30 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>SAVE NEW PASSWORD</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
