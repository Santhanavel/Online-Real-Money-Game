'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGameSocket } from '../../context/GameSocketContext';

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser } = useGameSocket();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim()) {
      setError('Please enter your mobile number or username');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }
      localStorage.setItem('rummy_token', data.token);
      const userObj = { userId: data.user.id, username: data.user.username };
      localStorage.setItem('rummy_player_profile', JSON.stringify(userObj));
      setCurrentUser(userObj);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestQuickPlay = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const guestUser = { userId: `usr-${rand}`, username: `Player_${rand}` };
    localStorage.setItem('rummy_player_profile', JSON.stringify(guestUser));
    setCurrentUser(guestUser);
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lobby-theme text-white">
      <div className="w-full max-w-md bg-[#250408]/90 backdrop-blur-xl border-2 border-[#961E28] rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.85)] relative overflow-hidden">
        {/* Subtle Brand Watermark */}
        <div className="absolute -top-10 -right-10 text-9xl text-white/[0.03] font-black pointer-events-none select-none">
          ♠
        </div>

        {/* Brand Header (Screen 2 Master Sheet) */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#FFE17D] via-[#F6BE36] to-[#B92730] flex items-center justify-center text-3xl shadow-xl border border-amber-200/50 mb-3">
            👑
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD96A] via-[#F6BE36] to-amber-200 tracking-wide uppercase">
            Rummy Royale
          </h1>
          <p className="text-xs text-amber-200/80 font-bold tracking-wider mt-1">
            Login to your account
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-200 mb-1.5">
              Mobile Number
            </label>
            <div className="flex rounded-xl bg-[#160205] border border-[#8D1420] focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400 overflow-hidden transition-all">
              <div className="flex items-center gap-1 px-3 bg-black/40 border-r border-[#8D1420] text-xs font-bold text-amber-200 select-none">
                <span>+91</span>
                <span className="text-[10px]">⌵</span>
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Mobile Number"
                className="w-full bg-transparent px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-200">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="flex items-center rounded-xl bg-[#160205] border border-[#8D1420] focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400 px-3 py-1 transition-all">
              <span className="text-sm text-slate-400 mr-2">🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-transparent py-2 text-sm text-white placeholder-slate-500 outline-none"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-amber-300 text-xs font-bold px-1"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Primary Gold Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl gold-btn-gradient text-sm font-black tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>

        {/* Divider OR */}
        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Continue with Google (Screen 2 Master Sheet) */}
        <button
          type="button"
          onClick={handleGuestQuickPlay}
          className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="text-sm font-black text-rose-600">G</span>
          <span>Continue with Google</span>
        </button>

        {/* Footer Link */}
        <p className="mt-5 text-center text-xs text-slate-300">
          New to Rummy Royale?{' '}
          <Link href="/register" className="font-black text-[#F6BE36] hover:underline">
            Sign Up
          </Link>
        </p>

        {/* Terms notice */}
        <p className="mt-4 text-center text-[10px] text-slate-400 leading-relaxed">
          100% Legal &amp; Safe • Non-monetary Free Virtual Chips Only • 18+ Play Responsibly
        </p>
      </div>
    </div>
  );
}
