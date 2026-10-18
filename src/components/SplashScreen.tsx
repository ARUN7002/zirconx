/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Gem, ShieldCheck, Sparkles, FileText } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  statusMessage: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, statusMessage }) => {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const timer1 = setTimeout(() => setProgress(55), 400);
    const timer2 = setTimeout(() => setProgress(85), 900);
    const timer3 = setTimeout(() => {
      setProgress(100);
      setTimeout(onComplete, 450);
    }, 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080A0C] text-[#E2E8F0] select-none px-6">
      {/* Background ambient radial glow */}
      <div className="absolute w-80 h-80 bg-[#00F5A0]/10 rounded-full blur-3xl pointer-events-none pulse-dot" />

      {/* Main animated icon badge with Zircon gemstone glow */}
      <div className="relative mb-8">
        <div className="glass-card w-24 h-24 rounded-3xl flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#00F5A0]/20 to-teal-500/10 pulse-dot" />
          <div className="relative flex items-center justify-center">
            <Gem className="w-12 h-12 text-[#00F5A0] drop-shadow-[0_0_20px_rgba(0,245,160,0.6)] animate-pulse" />
            <ShieldCheck className="w-6 h-6 text-emerald-400 absolute -bottom-1 -right-1 bg-[#080A0C] rounded-full p-0.5 border border-[#00F5A0]/40" />
          </div>
        </div>

        {/* Outer orbital indicator */}
        <div className="absolute -inset-1.5 rounded-[28px] border border-[#00F5A0]/30 pulse-dot" />
      </div>

      {/* App Branding */}
      <div className="text-center space-y-2 mb-10">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-zinc-100 to-[#00F5A0] bg-clip-text text-transparent">
            Zircon
          </h1>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-[#00F5A0]/15 text-[#00F5A0] border border-[#00F5A0]/30 rounded-lg">
            Local-First
          </span>
        </div>
        <p className="text-sm text-zinc-400 max-w-xs mx-auto">
          Offline Reminders · 20-Day Voice Retention · 50MB PDF Vault
        </p>
      </div>

      {/* Startup Task Meter */}
      <div className="w-full max-w-xs space-y-3">
        <div className="flex justify-between items-center text-xs text-zinc-400 font-mono">
          <span className="flex items-center gap-1.5 truncate">
            <Sparkles className="w-3.5 h-3.5 text-[#00F5A0] animate-spin" />
            {statusMessage || 'Initializing Zircon engine...'}
          </span>
          <span className="text-[#00F5A0] font-bold">{progress}%</span>
        </div>

        <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-[#00F5A0] to-teal-400 transition-all duration-300 ease-out rounded-full shadow-[0_0_10px_rgba(0,245,160,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Privacy guarantee watermark */}
      <div className="absolute bottom-8 flex items-center gap-2 text-[11px] text-zinc-500 font-medium tracking-wide">
        <FileText className="w-3.5 h-3.5 text-zinc-500" />
        <span>100% On-Device · Zero Cloud Dependency</span>
      </div>
    </div>
  );
};
