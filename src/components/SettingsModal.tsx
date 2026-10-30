/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  User,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  Power,
  Lock,
} from 'lucide-react';
import { SystemConfig } from '../types';
import { playChime, speakVoiceAnnouncement, isSpeechSynthesisSupported } from '../services/audioChime';
import { runAutoCleanupSweep, getAllReminders, getAllVoiceNotes, getAllVaultItems, getAllChatMessages, getUserDatabaseName } from '../services/db';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SystemConfig;
  onSaveConfig: (updated: Partial<SystemConfig>) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onThemeChange?: (theme: 'dark' | 'light' | 'system') => void;
  currentUser?: string | null;
  onLogout?: () => void;
  onFactoryReset?: () => Promise<void> | void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onRefreshData,
  onThemeChange,
  currentUser,
  onLogout,
  onFactoryReset,
}) => {
  const [retentionDays, setRetentionDays] = useState(config.retentionDays || 20);
  const [voiceLanguage, setVoiceLanguage] = useState(config.voiceLanguage || 'en-US');
  const [chimeType, setChimeType] = useState(config.notificationChime || 'bell');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(config.theme || 'dark');
  const [voiceAnnouncementEnabled, setVoiceAnnouncementEnabled] = useState(
    config.voiceAnnouncementEnabled || false
  );
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setRetentionDays(config.retentionDays || 20);
      setVoiceLanguage(config.voiceLanguage || 'en-US');
      setChimeType(config.notificationChime || 'bell');
      setTheme(config.theme || 'dark');
      setVoiceAnnouncementEnabled(config.voiceAnnouncementEnabled || false);
      setCleanupStatus(null);
      setSaveSuccess(false);
      setShowResetConfirm(false);
      setIsResetting(false);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

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
      voiceAnnouncementEnabled,
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

  const handleTestVoiceAnnouncement = () => {
    speakVoiceAnnouncement(
      'Zircon voice announcement test: This is how your scheduled reminders will sound.',
      voiceLanguage
    );
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

          {/* Active Account Identity Card (Anonymous to viewers) */}
          {currentUser && (
            <div className="p-4 bg-white/50 dark:bg-zinc-950/70 border border-[#00F5A0]/30 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#00F5A0]/20 text-[#00F5A0] font-black flex items-center justify-center text-sm border border-[#00F5A0]/30">
                    <ShieldCheck className="w-4 h-4 text-[#00F5A0]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span>Private Vault Active</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00F5A0]/15 text-emerald-800 dark:text-[#00F5A0] border border-[#00F5A0]/30">
                        Encrypted & Isolated
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                      Dedicated Local-First Sandbox
                    </div>
                  </div>
                </div>

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-rose-500 hover:text-white border border-black/10 dark:border-white/10 text-slate-700 dark:text-zinc-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Lock session & return to name login"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock Vault</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 pt-1 border-t border-black/5 dark:border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00F5A0] shrink-0" />
                <span>Strict local isolation active. Identity hidden from dashboard.</span>
              </div>
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

          {/* 3b. Spoken Voice Announcements (Text-to-Speech) */}
          <div className="p-4 bg-white/40 dark:bg-zinc-950/60 border border-black/5 dark:border-white/10 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#00F5A0]" />
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                    Spoken Voice Announcements (TTS)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Speaks reminder title out loud when alarms trigger
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoiceAnnouncementEnabled(!voiceAnnouncementEnabled)}
                className={`w-11 h-6 rounded-full p-1 transition-colors ${
                  voiceAnnouncementEnabled ? 'bg-[#00F5A0]' : 'bg-slate-300 dark:bg-zinc-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white dark:bg-zinc-950 transition-transform ${
                    voiceAnnouncementEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/10">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                {isSpeechSynthesisSupported()
                  ? 'Speech synthesis engine is ready'
                  : 'Speech synthesis not supported on this device'}
              </span>
              <button
                type="button"
                onClick={handleTestVoiceAnnouncement}
                disabled={!isSpeechSynthesisSupported()}
                className="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-[#00F5A0] hover:text-zinc-950 disabled:opacity-40 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition"
              >
                Test Voice
              </button>
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

          {/* 6. Emergency Complete Delete of Data & Vault Shutdown */}
          <div className="p-4 bg-rose-500/10 dark:bg-rose-950/25 border-2 border-rose-500/40 rounded-2xl space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Vault Reset & Emergency Shutdown</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40">
                    Wipe All Data
                  </span>
                </div>
                <p className="text-[11px] text-rose-700/80 dark:text-rose-300/70 mt-1 leading-relaxed">
                  Permanently deletes all reminders, voice logs, documents, chats, and isolated user databases. Shuts down the vault and resets to the original uninitialized state.
                </p>
              </div>
            </div>

            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Complete Delete of Data & Shutdown Vault</span>
              </button>
            ) : (
              <div className="p-3 bg-rose-600/10 dark:bg-rose-950/60 border border-rose-500/50 rounded-xl space-y-2.5">
                <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Are you completely sure? This will wipe all data and shut down the vault.</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={() => setShowResetConfirm(false)}
                    className="py-2 px-3 rounded-lg bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold transition cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={async () => {
                      setIsResetting(true);
                      if (onFactoryReset) {
                        await onFactoryReset();
                      }
                      setIsResetting(false);
                      onClose();
                    }}
                    className="py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{isResetting ? 'Wiping & Shutting Down...' : 'Confirm Wipe & Reset'}</span>
                  </button>
                </div>
              </div>
            )}
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
