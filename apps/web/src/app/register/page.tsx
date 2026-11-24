'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useGameSocket } from '../../context/GameSocketContext';

export default function RegisterPage() {
  const { setCurrentUser } = useGameSocket();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email or mobile number');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!agreeTerms) {
      setError('Please agree to the Terms of Service to continue');
      return;
    }

    setIsLoading(true);
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || '';
      const res = await fetch(`${serverUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }
      localStorage.setItem('rummy_token', data.token);
      const userObj = { userId: data.user.id, username: data.user.username };
      localStorage.setItem('rummy_player_profile', JSON.stringify(userObj));
      setCurrentUser(userObj);
      window.location.assign('/');
    } catch (err: any) {
      setError(err.message || 'Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 auth-screen lobby-theme text-white">
      <div className="w-full max-w-md bg-[#250408]/90 backdrop-blur-xl border-2 border-[#961E28] rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.85)] relative overflow-hidden">
        {/* Subtle Brand Watermark */}
        <div className="absolute -top-10 -right-10 text-9xl text-white/[0.03] font-black pointer-events-none select-none">
          ♠
        </div>

        {/* Brand Header (Screen 3 Master Sheet) */}
        <div className="text-center mb-6">
          <div className="auth-spade" aria-hidden="true">♠</div>
          <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD96A] via-[#F6BE36] to-amber-200 tracking-wide uppercase">
            Rummy Royale
          </h1>
          <h2 className="text-base font-black text-white mt-1">
            Create Account
          </h2>
          <p className="text-xs text-amber-200/80 font-bold tracking-wider mt-0.5">
            Join and start playing instantly
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form (Screen 3 Master Sheet) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center rounded-xl bg-[#160205] border border-[#8D1420] focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400 px-3 py-1 transition-all">
              <span className="text-sm text-slate-400 mr-2">👤</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-transparent py-2 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex rounded-xl bg-[#160205] border border-[#8D1420] focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400 overflow-hidden transition-all">
              <div className="flex items-center gap-1 px-3 bg-black/40 border-r border-[#8D1420] text-xs font-bold text-amber-200 select-none">
                <span>+91</span>
                <span className="text-[10px]">⌵</span>
              </div>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Mobile Number"
                className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center rounded-xl bg-[#160205] border border-[#8D1420] focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400 px-3 py-1 transition-all">
              <span className="text-sm text-slate-400 mr-2">🔒</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create Password"
                className="w-full bg-transparent py-2 text-sm text-white placeholder-slate-500 outline-none"
              />
              <span className="text-slate-400 text-xs px-1">👁️</span>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1 accent-amber-400 rounded cursor-pointer"
            />
            <label htmlFor="terms" className="text-[11px] text-amber-200/90 leading-tight cursor-pointer">
              I agree to the <span className="underline font-bold text-white">Terms &amp; Conditions</span> and <span className="underline font-bold text-white">Privacy Policy</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl gold-btn-gradient text-sm font-black tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Sign Up</span>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-300">
          Already have an account?{' '}
          <Link href="/login" className="font-black text-[#F6BE36] hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
