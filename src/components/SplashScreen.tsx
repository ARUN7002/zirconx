/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Gem, ShieldCheck, Sparkles, FileText } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  statusMessage: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, statusMessage }) => {
  const [progress, setProgress] = useState(15);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timer1 = setTimeout(() => setProgress(55), 350);
    const timer2 = setTimeout(() => setProgress(88), 800);
    const timer3 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => onCompleteRef.current(), 350);
    }, 1250);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#03060B] text-[#E2E8F0] select-none px-6 overflow-hidden">
      {/* Background ambient radial glow (Electric Cobalt + Acid Lime) */}
      <div className="absolute w-96 h-96 bg-[#2563EB]/20 rounded-full blur-3xl pointer-events-none pulse-dot -top-12 -left-12" />
      <div className="absolute w-80 h-80 bg-[#CCFF00]/10 rounded-full blur-3xl pointer-events-none -bottom-12 -right-12" />

      {/* Main animated icon badge with Zircon gemstone glow */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-3xl bg-[#070D18]/90 border-2 border-[#2563EB]/45 flex items-center justify-center relative overflow-hidden shadow-2xl shadow-[#2563EB]/30">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#2563EB]/25 to-[#CCFF00]/10 pulse-dot" />
          <div className="relative flex items-center justify-center">
            <Gem className="w-12 h-12 text-[#CCFF00] drop-shadow-[0_0_20px_rgba(204,255,0,0.6)] animate-pulse" />
            <ShieldCheck className="w-6 h-6 text-[#CCFF00] absolute -bottom-1 -right-1 bg-[#03060B] rounded-full p-0.5 border border-[#2563EB]/60" />
          </div>
        </div>

        {/* Outer orbital indicator */}
        <div className="absolute -inset-1.5 rounded-[28px] border border-[#CCFF00]/30 pulse-dot" />
      </div>

      {/* App Branding */}
      <div className="text-center space-y-2 mb-10">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#93C5FD] to-[#CCFF00] bg-clip-text text-transparent">
            Zircon
          </h1>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-[#2563EB]/20 text-[#CCFF00] border border-[#2563EB]/40 rounded-lg">
            Local-First
          </span>
        </div>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          Offline Reminders · 20-Day Voice Retention · 50MB PDF Vault
        </p>
      </div>

      {/* Startup Task Meter */}
      <div className="w-full max-w-xs space-y-3">
        <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 truncate">
            <Sparkles className="w-3.5 h-3.5 text-[#CCFF00] animate-spin" />
            {statusMessage || 'Loading Zircon vault...'}
          </span>
          <span className="text-[#CCFF00] font-bold">{progress}%</span>
        </div>

        <div className="w-full h-1.5 bg-[#070D18] rounded-full overflow-hidden border border-[#2563EB]/30">
          <div
            className="h-full bg-gradient-to-r from-[#2563EB] to-[#CCFF00] transition-all duration-300 ease-out rounded-full shadow-[0_0_10px_rgba(204,255,0,0.6)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Privacy guarantee watermark */}
      <div className="absolute bottom-8 flex items-center gap-2 text-[11px] text-slate-500 font-medium tracking-wide">
        <FileText className="w-3.5 h-3.5 text-[#3B82F6]" />
        <span>100% On-Device · Zero Cloud Dependency</span>
      </div>
    </div>
  );
};
