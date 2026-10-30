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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#03060B] text-[#E2E8F0] select-none overflow-y-auto">
      {/* Background ambient radial glow (Cobalt Blue + Acid Lime) */}
      <div className="absolute w-[450px] h-[450px] bg-[#2563EB]/15 rounded-full blur-3xl pointer-events-none -top-10 -left-10" />
      <div className="absolute w-[400px] h-[400px] bg-[#CCFF00]/10 rounded-full blur-3xl pointer-events-none -bottom-10 -right-10" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md bg-[#070D18]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-[#2563EB]/35 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Security Badge Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex relative mb-1">
            <div className="w-16 h-16 rounded-2xl bg-[#2563EB]/20 border-2 border-[#2563EB]/50 flex items-center justify-center relative shadow-lg shadow-[#2563EB]/30">
              <Gem className="w-8 h-8 text-[#CCFF00] drop-shadow-[0_0_15px_rgba(204,255,0,0.6)]" />
              <ShieldCheck className="w-5 h-5 text-[#CCFF00] absolute -bottom-1 -right-1 bg-[#03060B] rounded-full p-0.5 border border-[#2563EB]/60" />
            </div>
            <div className="absolute -inset-1 rounded-2xl border border-[#CCFF00]/30 pulse-dot pointer-events-none" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2563EB]/20 border border-[#2563EB]/40 text-[#93C5FD] text-[10px] font-bold uppercase tracking-widest mb-1.5">
              <Fingerprint className="w-3.5 h-3.5 text-[#CCFF00]" />
              Strict Identity Access Gate
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Zircon Terminal Login
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto leading-relaxed">
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
            <label className="text-xs font-bold uppercase tracking-wider text-[#CCFF00] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#3B82F6]" />
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
                className="w-full pl-4 pr-10 py-3.5 bg-[#03060B]/90 border border-[#2563EB]/40 rounded-2xl text-white placeholder-slate-500 font-semibold focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/60 focus:border-[#CCFF00] transition text-sm shadow-inner"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#3B82F6]">
                <Lock className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#CCFF00] hover:bg-[#b8e600] active:scale-[0.99] text-[#03060B] font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#CCFF00]/25 hover:shadow-[#CCFF00]/40 hover:scale-[1.01] cursor-pointer disabled:opacity-50"
          >
            {isVerifying ? (
              <span>Verifying Identity...</span>
            ) : (
              <>
                <span>Open Private Vault</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Security Isolation Guarantee Banner */}
        <div className="p-3 bg-[#03060B]/90 border border-[#2563EB]/25 rounded-2xl space-y-1.5 text-[11px] text-slate-300">
          <div className="flex items-center gap-1.5 text-white font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span>Strict User Isolation Guarantee</span>
          </div>
          <p className="leading-relaxed text-[10.5px] text-slate-400">
            Reminders, voice notes, PDFs, and notification timers are stored in dedicated per-user databases. Data from <strong>Person A</strong> will never bleed or move to <strong>Person B</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
