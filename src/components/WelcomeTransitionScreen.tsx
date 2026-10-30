/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Gem, ShieldCheck, Lock, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface WelcomeTransitionScreenProps {
  userName: string;
  onComplete: () => void;
}

export const WelcomeTransitionScreen: React.FC<WelcomeTransitionScreenProps> = ({
  userName,
  onComplete,
}) => {
  const TOTAL_DURATION_MS = 4000;
  const INTERVAL_MS = 50;
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= TOTAL_DURATION_MS) {
        clearInterval(timer);
        setElapsedMs(TOTAL_DURATION_MS);
        onComplete();
      } else {
        setElapsedMs(elapsed);
      }
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [onComplete]);

  const progressPercent = Math.min(100, Math.round((elapsedMs / TOTAL_DURATION_MS) * 100));
  const remainingSeconds = Math.max(0, ((TOTAL_DURATION_MS - elapsedMs) / 1000)).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#03060B] text-[#E2E8F0] select-none overflow-hidden">
      {/* Ambient Radial Glowing Orbs (Midnight Black + Electric Cobalt + Acid Lime) */}
      <div className="absolute w-[500px] h-[500px] bg-[#2563EB]/15 rounded-full blur-[100px] pointer-events-none -top-20 -left-20 animate-pulse" />
      <div className="absolute w-[450px] h-[450px] bg-[#CCFF00]/10 rounded-full blur-[120px] pointer-events-none -bottom-20 -right-20" />
      <div className="absolute w-80 h-80 bg-[#1D4ED8]/20 rounded-full blur-[90px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* Main Welcome Card */}
      <div className="relative w-full max-w-lg bg-[#070D18]/90 backdrop-blur-2xl border-2 border-[#2563EB]/40 rounded-3xl p-8 sm:p-10 shadow-[0_0_50px_rgba(37,99,235,0.25)] text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Top Security Gate Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2563EB]/20 border border-[#2563EB]/40 text-[#60A5FA] text-[11px] font-bold tracking-widest uppercase">
          <ShieldCheck className="w-3.5 h-3.5 text-[#CCFF00]" />
          <span>Strict Identity Verification Passed</span>
        </div>

        {/* Brand Gem Emblem with Acid Lime & Cobalt Halo */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#1D4ED8] to-[#2563EB] p-0.5 shadow-2xl shadow-[#2563EB]/40 flex items-center justify-center">
              <div className="w-full h-full bg-[#050914] rounded-[22px] flex items-center justify-center">
                <Gem className="w-10 h-10 text-[#CCFF00] drop-shadow-[0_0_15px_rgba(204,255,0,0.6)] animate-pulse" />
              </div>
            </div>
            {/* Pulsing ring */}
            <div className="absolute -inset-2 rounded-3xl border-2 border-[#CCFF00]/30 animate-ping pointer-events-none opacity-40" />
          </div>
        </div>

        {/* The Exact User Requested Welcome Text */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-[#93C5FD] font-semibold flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span>Authenticated Session</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Welcome <span className="text-[#CCFF00] drop-shadow-[0_0_20px_rgba(204,255,0,0.5)]">"{userName}"</span>
          </h1>

          <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
            Mounting your isolated private vault sandbox. Your reminders, voice notes, and documents are 100% offline.
          </p>
        </div>

        {/* 4-Second Animated Progress Bar and Countdown */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-[#60A5FA] font-bold">
              <Lock className="w-3 h-3 text-[#CCFF00]" />
              Decrypting Local Storage...
            </span>
            <span className="text-[#CCFF00] font-bold">{remainingSeconds}s</span>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full h-2.5 bg-[#050914] rounded-full overflow-hidden p-0.5 border border-[#2563EB]/30">
            <div
              className="h-full bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#CCFF00] rounded-full transition-all duration-75 ease-out shadow-[0_0_15px_rgba(204,255,0,0.5)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 pt-1">
            <span className="w-2 h-2 rounded-full bg-[#CCFF00] pulse-dot" />
            <span>Redirecting to Home Dashboard automatically in 4s</span>
          </div>
        </div>
      </div>
    </div>
  );
};
