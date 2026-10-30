/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Gem, User, ArrowRight, Lock, KeyRound, CheckCircle2, AlertTriangle, Fingerprint } from 'lucide-react';
import { AUTHORIZED_USERS, AuthorizedUserName } from '../types';
import { normalizeAuthorizedUser } from '../services/db';

interface LoginScreenProps {
  onLoginSuccess: (userName: AuthorizedUserName) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [inputName, setInputName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = inputName.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your authorized name.');
      return;
    }

    const validatedUser = normalizeAuthorizedUser(trimmed);
    if (!validatedUser) {
      setErrorMsg('Access Denied: Unrecognized name. Terminal access is restricted to authorized personnel only.');
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      onLoginSuccess(validatedUser);
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080A0C] text-[#E2E8F0] select-none overflow-y-auto">
      {/* Background ambient radial glow */}
      <div className="absolute w-96 h-96 bg-[#00F5A0]/10 rounded-full blur-3xl pointer-events-none pulse-dot" />
      <div className="absolute top-1/4 -right-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md glass-card rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 dark:border-white/10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Security Badge Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex relative mb-1">
            <div className="w-16 h-16 rounded-2xl bg-[#00F5A0]/15 border border-[#00F5A0]/30 flex items-center justify-center relative">
              <Gem className="w-8 h-8 text-[#00F5A0] drop-shadow-[0_0_15px_rgba(0,245,160,0.5)]" />
              <ShieldCheck className="w-5 h-5 text-emerald-400 absolute -bottom-1 -right-1 bg-[#080A0C] rounded-full p-0.5 border border-[#00F5A0]/40" />
            </div>
            <div className="absolute -inset-1 rounded-2xl border border-[#00F5A0]/20 pulse-dot pointer-events-none" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00F5A0]/10 border border-[#00F5A0]/30 text-[#00F5A0] text-[10px] font-bold uppercase tracking-widest mb-1.5">
              <Fingerprint className="w-3 h-3" />
              Strict Identity Access Gate
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Zircon Terminal Login
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              Enter your authorized name to access your private, isolated vault. No data is shared between user accounts.
            </p>
          </div>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-2xl text-rose-200 text-xs leading-relaxed animate-in slide-in-from-top-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#00F5A0] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              NAME <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                placeholder="Enter authorized name..."
                value={inputName}
                onChange={(e) => {
                  setInputName(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full pl-4 pr-10 py-3.5 bg-zinc-950/80 border border-white/10 rounded-2xl text-white placeholder-zinc-500 font-semibold focus:outline-none focus:ring-2 focus:ring-[#00F5A0]/50 focus:border-[#00F5A0] transition text-sm"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                <Lock className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#00F5A0] hover:bg-[#00d68c] text-zinc-950 font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00F5A0]/25 hover:shadow-[#00F5A0]/40 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {isVerifying ? (
              <span>Verifying Identity...</span>
            ) : (
              <>
                <span>Open Private Vault</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Isolation Guarantee Banner */}
        <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-2xl space-y-1.5 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5 text-zinc-200 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00F5A0]" />
            <span>Strict User Isolation Guarantee</span>
          </div>
          <p className="leading-relaxed text-[10.5px]">
            Reminders, voice notes, PDFs, and notification timers are stored in dedicated per-user databases. Data from <strong>Person A</strong> will never bleed or move to <strong>Person B</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
