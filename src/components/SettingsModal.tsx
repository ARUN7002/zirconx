/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  X,
  Volume2,
  Globe,
  Download,
  Calendar,
  Sparkles,
  CheckCircle2,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { SystemConfig } from '../types';
import { playChime } from '../services/audioChime';
import { runAutoCleanupSweep, getAllReminders, getAllVoiceNotes, getAllVaultItems, getAllChatMessages } from '../services/db';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SystemConfig;
  onSaveConfig: (updated: Partial<SystemConfig>) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onThemeChange?: (theme: 'dark' | 'light' | 'system') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onRefreshData,
  onThemeChange,
}) => {
  if (!isOpen) return null;

  const [retentionDays, setRetentionDays] = useState(config.retentionDays || 20);
  const [voiceLanguage, setVoiceLanguage] = useState(config.voiceLanguage || 'en-US');
  const [chimeType, setChimeType] = useState(config.notificationChime || 'bell');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(config.theme || 'dark');
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSelectTheme = (newTheme: 'dark' | 'light' | 'system') => {
    setTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  const handleSave = async () => {
    await onSaveConfig({
      retentionDays,
      voiceLanguage,
      notificationChime: chimeType,
      theme,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const handleTestSound = (type: 'bell' | 'alert' | 'gentle') => {
    setChimeType(type);
    playChime(type);
  };

  const handleRunCleanupNow = async () => {
    const res = await runAutoCleanupSweep();
    setCleanupStatus(
      res.purgedCount > 0
        ? `Purged ${res.purgedCount} expired voice notes (> ${retentionDays} days old).`
        : 'Zero expired notes found. All current recordings are within retention period or bookmarked.'
    );
    await onRefreshData();
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const [reminders, voiceNotes, vaultItems, chatHistory] = await Promise.all([
        getAllReminders(),
        getAllVoiceNotes(),
        getAllVaultItems(),
        getAllChatMessages(),
      ]);

      const backupData = {
        app: 'Zircon',
        exportedAt: new Date().toISOString(),
        config: { ...config, theme },
        reminders,
        voiceNotes,
        vaultItems,
        chatHistory,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zircon_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const languageOptions = [
    { code: 'en-US', label: 'English (United States)' },
    { code: 'en-GB', label: 'English (United Kingdom)' },
    { code: 'en-AU', label: 'English (Australia)' },
    { code: 'en-IN', label: 'English (India)' },
    { code: 'es-ES', label: 'Spanish (Español)' },
    { code: 'fr-FR', label: 'French (Français)' },
    { code: 'de-DE', label: 'German (Deutsch)' },
    { code: 'ja-JP', label: 'Japanese (日本語)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg glass-card rounded-3xl overflow-hidden flex flex-col max-h-[92vh] border border-white/10 dark:border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00F5A0]/15 border border-[#00F5A0]/30 flex items-center justify-center text-[#00F5A0]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Zircon Settings</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Appearance, speech, and storage retention</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {saveSuccess && (
            <div className="p-3 bg-[#00F5A0]/20 border border-[#00F5A0]/40 rounded-2xl text-emerald-800 dark:text-[#00F5A0] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Zircon settings updated successfully!</span>
            </div>
          )}

          {/* Theme Switcher (Light / Dark / System) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-[#00F5A0]" />
              Color Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectTheme('dark')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  theme === 'dark'
                    ? 'bg-[#00F5A0]/15 border-[#00F5A0] text-[#00F5A0] shadow-sm'
                    : 'bg-white/50 dark:bg-zinc-950/60 border-black/5 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:border-black/20 dark:hover:border-white/20'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Dark Mode</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTheme('light')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  theme === 'light'
                    ? 'bg-[#00C280]/20 border-[#00C280] text-emerald-800 dark:text-[#00F5A0] shadow-sm'
                    : 'bg-white/50 dark:bg-zinc-950/60 border-black/5 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:border-black/20 dark:hover:border-white/20'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Light Mode</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTheme('system')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  theme === 'system'
                    ? 'bg-[#00F5A0]/15 border-[#00F5A0] text-[#00F5A0] shadow-sm'
                    : 'bg-white/50 dark:bg-zinc-950/60 border-black/5 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:border-black/20 dark:hover:border-white/20'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>Auto System</span>
              </button>
            </div>
          </div>

          {/* 1. Voice Retention Duration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#00F5A0]" />
                Voice Retention Window
              </label>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-[#00F5A0] bg-[#00F5A0]/15 px-2.5 py-0.5 rounded-lg border border-[#00F5A0]/30">
                {retentionDays} Days
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Unsaved recordings auto-purge after this duration. Bookmarked recordings are permanently saved.
            </p>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[7, 14, 20, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRetentionDays(days)}
                  className={`py-2 px-1 text-xs font-bold rounded-xl border transition ${
                    retentionDays === days
                      ? 'bg-[#00F5A0] text-zinc-950 border-[#00F5A0] shadow-md shadow-[#00F5A0]/20'
                      : 'bg-white/50 dark:bg-zinc-950/60 text-slate-700 dark:text-zinc-300 border-black/5 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20'
                  }`}
                >
                  {days} Days {days === 20 ? '(Default)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Voice Recognition Language */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#00F5A0]" />
              Speech Recognition Language
            </label>
            <select
              value={voiceLanguage}
              onChange={(e) => setVoiceLanguage(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/70 dark:bg-zinc-950 border border-black/10 dark:border-white/10 rounded-2xl text-slate-800 dark:text-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#00F5A0]/50"
            >
              {languageOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Notification Chime Tone */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[#00F5A0]" />
              Notification Chime Tone
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['bell', 'alert', 'gentle'] as const).map((sound) => (
                <button
                  key={sound}
                  type="button"
                  onClick={() => handleTestSound(sound)}
                  className={`py-2.5 px-2 text-xs font-bold rounded-xl border capitalize transition flex items-center justify-center gap-1.5 ${
                    chimeType === sound
                      ? 'bg-[#00F5A0]/20 text-emerald-800 dark:text-[#00F5A0] border-[#00F5A0]/50 ring-1 ring-[#00F5A0]/50'
                      : 'bg-white/50 dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 border-black/5 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{sound}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Background Cleanup Job Trigger */}
          <div className="p-4 bg-white/40 dark:bg-zinc-950/60 border border-black/5 dark:border-white/10 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">Manual Cleanup Sweep</div>
              <button
                type="button"
                onClick={handleRunCleanupNow}
                className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold transition flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-[#00F5A0]" />
                <span>Run Sweep Now</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              Purges unsaved voice recordings exceeding {retentionDays} days. Does not touch Library Vault documents or bookmarked voice notes.
            </p>
            {cleanupStatus && (
              <div className="p-2.5 bg-slate-100 dark:bg-zinc-900 border border-black/5 dark:border-white/10 rounded-xl text-[11px] text-emerald-700 dark:text-[#00F5A0]">
                {cleanupStatus}
              </div>
            )}
          </div>

          {/* 5. Emergency Database Backup */}
          <div className="p-4 bg-white/40 dark:bg-zinc-950/60 border border-black/5 dark:border-white/10 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">Local JSON Data Backup</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">Download offline copy of Zircon reminders and vault metadata</div>
            </div>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportBackup}
              className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 dark:border-white/10 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700 font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 px-4 rounded-2xl bg-[#00F5A0] hover:bg-[#00d68c] text-zinc-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#00F5A0]/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
