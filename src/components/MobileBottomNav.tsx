/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Bell,
  BarChart3,
  Mic,
  FileText,
  SlidersHorizontal,
  Bot,
  Activity,
  Settings,
  Lock,
  Sun,
  Moon,
  Monitor,
  Smartphone,
  Sparkles,
  X,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { DisplayMode } from '../types';

interface MobileBottomNavProps {
  activeTab: 'agenda' | 'weekly' | 'vault';
  onSelectTab: (tab: 'agenda' | 'weekly' | 'vault') => void;
  onOpenVoice: () => void;
  onOpenManual: () => void;
  onOpenVault: () => void;
  onOpenChat: () => void;
  onOpenHealth: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  remindersCount: number;
  vaultCount: number;
  activeTheme: 'dark' | 'light';
  onToggleTheme: () => void;
  displayMode: DisplayMode;
  onChangeDisplayMode: (mode: DisplayMode) => void;
  healthAccessEnabled: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenVoice,
  onOpenManual,
  onOpenVault,
  onOpenChat,
  onOpenHealth,
  onOpenSettings,
  onLogout,
  remindersCount,
  vaultCount,
  activeTheme,
  onToggleTheme,
  displayMode,
  onChangeDisplayMode,
  healthAccessEnabled,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isLight = activeTheme === 'light';

  return (
    <>
      {/* Fixed Bottom Navigation Bar (Thumb Zone) */}
      <nav
        aria-label="Mobile Navigation"
        className={`fixed bottom-0 left-0 right-0 z-40 ${
          isLight
            ? 'bg-white/95 border-t border-slate-200 text-slate-800'
            : 'bg-[#03060B]/95 border-t border-[#2563EB]/35 text-slate-200'
        } backdrop-blur-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.4)] px-3 py-1.5 transition-colors`}
      >
        <div className="max-w-md mx-auto grid grid-cols-5 items-center justify-between relative">
          {/* Tab 1: Reminders / Agenda */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('agenda');
              const el = document.getElementById('reminders-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition cursor-pointer min-h-[48px] ${
              activeTab === 'agenda'
                ? isLight
                  ? 'text-[#1D4ED8]'
                  : 'text-[#CCFF00]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Reminders Agenda"
          >
            <div className="relative">
              <Bell className="w-5 h-5 stroke-[2.2]" />
              {remindersCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] bg-[#CCFF00] text-[#03060B] rounded-full text-[9px] font-black flex items-center justify-center font-mono">
                  {remindersCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold mt-1 tracking-tight">Agenda</span>
            {activeTab === 'agenda' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] mt-0.5" />
            )}
          </button>

          {/* Tab 2: Weekly Performance */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('weekly');
              const el = document.getElementById('weekly-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition cursor-pointer min-h-[48px] ${
              activeTab === 'weekly'
                ? isLight
                  ? 'text-[#1D4ED8]'
                  : 'text-[#CCFF00]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Weekly Analysis"
          >
            <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold mt-1 tracking-tight">Weekly</span>
            {activeTab === 'weekly' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] mt-0.5" />
            )}
          </button>

          {/* Tab 3 (Center Action FAB): Voice Studio */}
          <div className="flex flex-col items-center justify-center relative -top-3">
            <button
              type="button"
              onClick={onOpenVoice}
              className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#1D4ED8] via-[#2563EB] to-[#CCFF00] p-0.5 shadow-[0_0_25px_rgba(37,99,235,0.6)] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center group"
              title="Speak Reminder (Voice Studio)"
            >
              <div className="w-full h-full bg-[#03060B] rounded-full flex items-center justify-center text-[#CCFF00] group-hover:bg-transparent group-hover:text-[#03060B] transition-colors">
                <Mic className="w-6 h-6 stroke-[2.5]" />
              </div>
            </button>
            <span className="text-[9px] font-black uppercase text-[#CCFF00] tracking-wider mt-1 drop-shadow">
              Voice
            </span>
          </div>

          {/* Tab 4: PDF Vault */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('vault');
              onOpenVault();
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition cursor-pointer min-h-[48px] ${
              activeTab === 'vault'
                ? isLight
                  ? 'text-[#1D4ED8]'
                  : 'text-[#CCFF00]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="PDF Vault"
          >
            <div className="relative">
              <FileText className="w-5 h-5 stroke-[2.2]" />
              {vaultCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] bg-[#2563EB] text-white rounded-full text-[9px] font-bold flex items-center justify-center font-mono">
                  {vaultCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold mt-1 tracking-tight">Vault</span>
            {activeTab === 'vault' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] mt-0.5" />
            )}
          </button>

          {/* Tab 5: More Drawer */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition cursor-pointer min-h-[48px] ${
              isDrawerOpen
                ? isLight
                  ? 'text-[#1D4ED8]'
                  : 'text-[#CCFF00]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="More Options"
          >
            <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] font-bold mt-1 tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Slide-Up Mobile Action Drawer (Bottom Sheet) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`w-full max-w-lg rounded-t-3xl border-t p-5 space-y-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#070D18] border-[#2563EB]/40 text-white'
            }`}
          >
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-slate-400/40 rounded-full mx-auto" />

            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#CCFF00]" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Mobile Control Hub
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Action 1: New Manual Reminder */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenManual();
                }}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition cursor-pointer ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 hover:border-blue-500'
                    : 'bg-[#03060B] border-[#2563EB]/35 hover:border-[#CCFF00]/50'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#CCFF00] text-[#03060B] flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="text-xs font-bold">New Reminder</div>
                  <div className="text-[10px] text-slate-400">Manual input</div>
                </div>
              </button>

              {/* Action 2: AI Local Assistant */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenChat();
                }}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition cursor-pointer ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 hover:border-blue-500'
                    : 'bg-[#03060B] border-[#2563EB]/35 hover:border-[#CCFF00]/50'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-[#CCFF00] flex items-center justify-center font-bold">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold">AI Assistant</div>
                  <div className="text-[10px] text-slate-400">Local chat</div>
                </div>
              </button>

              {/* Action 3: System Health Diagnostics */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenHealth();
                }}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition cursor-pointer ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 hover:border-blue-500'
                    : 'bg-[#03060B] border-[#2563EB]/35 hover:border-[#CCFF00]/50'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-[#3B82F6] flex items-center justify-center font-bold">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Health</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        healthAccessEnabled ? 'bg-[#CCFF00]' : 'bg-zinc-500'
                      }`}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">Diagnostics</div>
                </div>
              </button>

              {/* Action 4: Settings */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenSettings();
                }}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition cursor-pointer ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 hover:border-blue-500'
                    : 'bg-[#03060B] border-[#2563EB]/35 hover:border-[#CCFF00]/50'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-slate-300 flex items-center justify-center font-bold">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold">Settings</div>
                  <div className="text-[10px] text-slate-400">Preferences</div>
                </div>
              </button>
            </div>

            {/* Display Mode Version Switcher */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-[#CCFF00]" />
                Display Version (Desktop / Mobile / Auto)
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#03060B] rounded-2xl border border-[#2563EB]/30">
                <button
                  type="button"
                  onClick={() => onChangeDisplayMode('auto')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    displayMode === 'auto'
                      ? 'bg-[#CCFF00] text-[#03060B]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeDisplayMode('mobile')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    displayMode === 'mobile'
                      ? 'bg-[#CCFF00] text-[#03060B]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeDisplayMode('desktop')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    displayMode === 'desktop'
                      ? 'bg-[#CCFF00] text-[#03060B]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
              </div>
            </div>

            {/* Quick Toggle Row: Theme & Lock */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={onToggleTheme}
                className="py-3 px-3 rounded-2xl bg-[#03060B] border border-[#2563EB]/35 text-xs font-bold flex items-center justify-center gap-2 hover:border-[#CCFF00]/50 transition cursor-pointer"
              >
                {isLight ? (
                  <>
                    <Moon className="w-4 h-4 text-slate-300" />
                    <span>Dark Theme</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4 text-[#CCFF00]" />
                    <span>Light Theme</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onLogout();
                }}
                className="py-3 px-3 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-900/60 transition cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Lock Vault</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
