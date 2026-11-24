'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGameSocket } from '../../context/GameSocketContext';

export default function VerifyOtpPage() {
  const router = useRouter();
  const { setCurrentUser } = useGameSocket();
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'INPUT_PHONE' | 'INPUT_OTP'>('INPUT_PHONE');
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'INPUT_OTP' && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim()) {
      setError('Please enter a valid mobile number or email');
      return;
    }

    setIsLoading(true);
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
      const res = await fetch(`${serverUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }
      if (data.demoCode) {
        setDemoCode(data.demoCode);
      }
      setStep('INPUT_OTP');
      setCountdown(30);
      setCanResend(false);
    } catch (err: any) {
      setError(err.message || 'Unable to request OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    if (val.length > 1) {
      val = val.slice(-1);
    }
    const newCode = [...otpCode];
    newCode[index] = val;
    setOtpCode(newCode);

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otpCode.join('');
    if (fullCode.length < 6) {
      setError('Please enter all 6 digits of the OTP');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
      const res = await fetch(`${serverUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid OTP code');
      }
      if (data.token) {
        localStorage.setItem('rummy_token', data.token);
      }
      if (data.user) {
        const userObj = { userId: data.user.id, username: data.user.username };
        localStorage.setItem('rummy_player_profile', JSON.stringify(userObj));
        setCurrentUser(userObj);
      }
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
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
            className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 transition-colors"
          >
            <span className="text-base">←</span>
            <span>Back to Login</span>
          </Link>
        </div>

        {/* Header (Screen 4 Master Sheet) */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#FFE17D] via-[#F6BE36] to-[#B92730] flex items-center justify-center text-3xl shadow-xl border border-amber-200/50 mb-3">
            👑
          </div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD96A] via-[#F6BE36] to-amber-200 tracking-wide uppercase">
            Rummy Royale
          </h1>
          <h2 className="text-lg font-black text-white mt-1">
            Verify OTP
          </h2>
          <p className="text-xs text-amber-200/80 font-bold tracking-wider mt-0.5">
            {step === 'INPUT_PHONE'
              ? 'Receive an instant 6-digit login code'
              : `Enter the 6-digit code sent to ${identifier ? `+91 ${identifier}` : '+91 98765 43210'}`}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Demo Hint */}
        {demoCode && step === 'INPUT_OTP' && (
          <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs text-center font-bold">
            Demo Code: <span className="font-mono text-white text-sm bg-black/40 px-2 py-0.5 rounded">{demoCode}</span>
          </div>
        )}

        {step === 'INPUT_PHONE' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-200 mb-1.5">
                Mobile Number
              </label>
              <div className="flex rounded-xl bg-[#160205] border border-[#8D1420] focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400 overflow-hidden transition-all">
                <span className="bg-black/40 border-r border-[#8D1420] px-3 py-2.5 text-xs text-amber-300 font-bold flex items-center">
                  +91 ⌵
                </span>
                <input
                  type="tel"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="9876543210"
                  className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl gold-btn-gradient text-sm font-black tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Get OTP Code</span>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <div className="flex justify-between gap-2 max-w-xs mx-auto my-2">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    className="w-11 h-12 text-center bg-[#160205] border border-amber-400/50 focus:border-amber-300 focus:ring-2 focus:ring-amber-400 rounded-xl text-lg font-black text-amber-200 outline-none transition-all shadow-inner"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>

              {/* Resend Countdown */}
              <div className="text-center text-xs text-amber-200/70 mt-3 font-semibold">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="font-black text-amber-400 hover:underline"
                  >
                    Resend OTP
                  </button>
                ) : (
                  <span>Resend OTP in 00:{countdown < 10 ? `0${countdown}` : countdown}</span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl gold-btn-gradient text-sm font-black tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Verify &amp; Continue</span>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setStep('INPUT_PHONE')}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Change Mobile Number
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
