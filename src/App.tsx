/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Gem,
  Bell,
  Mic,
  FileText,
  Activity,
  Settings,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Bookmark,
  Trash2,
  RotateCcw,
  Sparkles,
  Calendar,
  Volume2,
  ChevronRight,
  Sun,
  Moon,
  Bot,
  MessageSquare,
  Pencil,
  User,
  LogOut,
  Lock,
} from 'lucide-react';
import { Reminder, VoiceNote, VaultItem, SystemConfig, ReminderStatus, AuthorizedUserName } from './types';
import {
  getDB,
  getAllReminders,
  saveReminder,
  deleteReminder,
  updateReminderStatus,
  getAllVoiceNotes,
  saveVoiceNote,
  toggleSaveVoiceNote,
  deleteVoiceNote,
  getAllVaultItems,
  saveVaultItem,
  deleteVaultItem,
  getSystemConfig,
  saveSystemConfig,
  seedInitialDataIfEmpty,
  reconcileMissedReminders,
  runAutoCleanupSweep,
  ensureStoragePersistence,
  getActiveUser,
  setActiveUser,
  getUserDatabaseName,
  factoryResetAndShutdown,
  completeResetEraseAll,
} from './services/db';
import { notificationManager } from './services/notificationManager';
import { SplashScreen } from './components/SplashScreen';
import { LoginScreen } from './components/LoginScreen';
import { ManualReminderModal } from './components/ManualReminderModal';
import { VoiceReminderModal } from './components/VoiceReminderModal';
import { LibraryVaultModal } from './components/LibraryVaultModal';
import { SystemHealthModal } from './components/SystemHealthModal';
import { SettingsModal } from './components/SettingsModal';
import { ChatbotModal } from './components/ChatbotModal';
import { WelcomeTransitionScreen } from './components/WelcomeTransitionScreen';
import { WeeklyAnalysisCard } from './components/WeeklyAnalysisCard';

export default function App() {
  // Splash & Initialization State
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatusMessage, setInitStatusMessage] = useState('Verifying Zircon security gate...');

  // Active Authenticated User (Strict Whitelist: Ajitha, Daresh, Arun, Ananya, Kiruba)
  const [currentUser, setCurrentUser] = useState<AuthorizedUserName | null>(() => getActiveUser());

  // Core Data States
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [config, setConfig] = useState<SystemConfig>({
    retentionDays: 20,
    voiceLanguage: 'en-US',
    notificationChime: 'bell',
    autoCleanupIntervalHours: 12,
    lastCleanupTimestamp: 0,
    theme: 'dark',
  });

  // Theme State: 'dark' | 'light'
  const [activeTheme, setActiveTheme] = useState<'dark' | 'light'>('dark');

  // System Health Access Switch State (ON/OFF)
  const [healthAccessEnabled, setHealthAccessEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('zircon_health_access');
      if (stored !== null) return stored === 'true';
    }
    return true;
  });

  // 4-Second Welcome Transition on Login / Name Change
  const [welcomeUser, setWelcomeUser] = useState<string | null>(null);

  // Selected Day Timestamp Filter from Weekly Analysis (null = show normal agenda)
  const [selectedWeeklyDayTimestamp, setSelectedWeeklyDayTimestamp] = useState<number | null>(null);

  // Navigation & Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  // Active Reminder Fired Alert Modal / Toast
  const [activeFiredReminder, setActiveFiredReminder] = useState<Reminder | null>(null);

  // UI Filters
  const [reminderFilter, setReminderFilter] = useState<'all' | 'today' | 'active' | 'completed' | 'missed'>('active');

  // Audio Playback in Dashboard
  const [activePlayingVoiceId, setActivePlayingVoiceId] = useState<string | null>(null);
  const audioDashboardPlayerRef = React.useRef<HTMLAudioElement | null>(null);

  // Initialize Theme from localStorage or system config
  useEffect(() => {
    const active = getActiveUser();
    const userThemeKey = active ? `zircon_theme_${active}` : 'zircon_theme';
    const savedTheme = localStorage.getItem(userThemeKey) as 'dark' | 'light' | null;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setActiveTheme(savedTheme);
      document.documentElement.classList.toggle('theme-light', savedTheme === 'light');
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('theme-light');
    }
  }, [currentUser]);

  const handleToggleTheme = () => {
    const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
    setActiveTheme(nextTheme);
    const userThemeKey = currentUser ? `zircon_theme_${currentUser}` : 'zircon_theme';
    localStorage.setItem(userThemeKey, nextTheme);
    localStorage.setItem('zircon_theme', nextTheme);
    document.documentElement.classList.toggle('theme-light', nextTheme === 'light');
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    saveSystemConfig({ theme: nextTheme }).catch(console.error);
  };

  const handleSetSpecificTheme = (newTheme: 'dark' | 'light' | 'system') => {
    let resolved: 'dark' | 'light' = 'dark';
    if (newTheme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } else {
      resolved = newTheme;
    }
    setActiveTheme(resolved);
    const userThemeKey = currentUser ? `zircon_theme_${currentUser}` : 'zircon_theme';
    localStorage.setItem(userThemeKey, resolved);
    localStorage.setItem('zircon_theme', resolved);
    document.documentElement.classList.toggle('theme-light', resolved === 'light');
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    saveSystemConfig({ theme: newTheme }).catch(console.error);
  };

  // Cold Boot Initialization
  useEffect(() => {
    async function boot() {
      try {
        setInitStatusMessage('Verifying storage sandbox...');
        await ensureStoragePersistence();

        const active = getActiveUser();
        if (active) {
          setInitStatusMessage('Mounting isolated vault sandbox...');
          await getDB();
          await seedInitialDataIfEmpty(active);
          await reconcileMissedReminders();
          await runAutoCleanupSweep();
          await refreshAllData();
        }
      } catch (err) {
        console.error('Boot error:', err);
      }
    }
    boot();
  }, []);

  // Strict Login Success Handler
  const handleLoginSuccess = async (userName: AuthorizedUserName) => {
    notificationManager.cancelAll();
    setActiveUser(userName);
    setCurrentUser(userName);
    setWelcomeUser(userName); // Trigger 4-second Welcome "[Name]" Screen

    // Apply user theme if stored
    const userTheme = (localStorage.getItem(`zircon_theme_${userName}`) || 'dark') as 'dark' | 'light';
    setActiveTheme(userTheme);
    document.documentElement.classList.toggle('theme-light', userTheme === 'light');
    document.documentElement.classList.toggle('dark', userTheme === 'dark');

    // Mount user vault & initialize data
    await getDB();
    await seedInitialDataIfEmpty(userName);
    await reconcileMissedReminders();
    await runAutoCleanupSweep();
    await refreshAllData();
  };

  // Clean Logout Handler (Guarantees zero bleed to next user)
  const handleLogout = () => {
    // 1. Cancel all timers so Person A notifications never fire for Person B
    notificationManager.cancelAll();

    // 2. Clear state in memory
    setActiveUser(null);
    setCurrentUser(null);
    setWelcomeUser(null);
    setSelectedWeeklyDayTimestamp(null);
    setReminders([]);
    setVoiceNotes([]);
    setVaultItems([]);
    setActiveFiredReminder(null);
    setIsManualModalOpen(false);
    setIsVoiceModalOpen(false);
    setIsVaultModalOpen(false);
    setIsHealthModalOpen(false);
    setIsSettingsModalOpen(false);
    setIsChatbotOpen(false);
  };

  // Complete Reset from New (Violet Option / Erase All Memory & Files)
  const handleCompleteReset = async () => {
    // 1. Cancel all notifications & exact audio alarms
    notificationManager.cancelAll();

    // 2. Perform complete wipe of all memory, databases, caches & localStorage
    await completeResetEraseAll();

    // 3. Reset all React state to uninitialized virgin phase
    setActiveUser(null);
    setCurrentUser(null);
    setWelcomeUser(null);
    setSelectedWeeklyDayTimestamp(null);
    setReminders([]);
    setVoiceNotes([]);
    setVaultItems([]);
    setActiveFiredReminder(null);
    setIsManualModalOpen(false);
    setIsVoiceModalOpen(false);
    setIsVaultModalOpen(false);
    setIsHealthModalOpen(false);
    setIsSettingsModalOpen(false);
    setIsChatbotOpen(false);
    setActiveTheme('dark');
    setHealthAccessEnabled(true);
    document.documentElement.classList.remove('theme-light');
    document.documentElement.classList.add('dark');
  };

  // Factory Reset & Vault Shutdown Handler (Red Button Action)
  const handleFactoryReset = async () => {
    return handleCompleteReset();
  };

  // Arm exact alarms whenever reminders list changes
  useEffect(() => {
    reminders.forEach((r) => {
      if (r.status === 'active' && r.dueTimestamp > Date.now()) {
        notificationManager.scheduleReminder(
          r,
          config.notificationChime,
          config.voiceAnnouncementEnabled
        );
      }
    });
  }, [reminders, config.notificationChime, config.voiceAnnouncementEnabled]);

  // Subscribe to in-app reminder trigger notifications
  useEffect(() => {
    const unsubscribe = notificationManager.subscribe((reminder) => {
      setActiveFiredReminder(reminder);
      refreshAllData();
    });
    return () => unsubscribe();
  }, []);

  const refreshAllData = useCallback(async () => {
    const [fetchedReminders, fetchedVoices, fetchedVault, fetchedConfig] = await Promise.all([
      getAllReminders(),
      getAllVoiceNotes(),
      getAllVaultItems(),
      getSystemConfig(),
    ]);
    setReminders(fetchedReminders);
    setVoiceNotes(fetchedVoices);
    setVaultItems(fetchedVault);
    setConfig(fetchedConfig);
    if (fetchedConfig.theme && (fetchedConfig.theme === 'light' || fetchedConfig.theme === 'dark')) {
      const local = localStorage.getItem('zircon_theme') as 'dark' | 'light' | null;
      if (!local) {
        setActiveTheme(fetchedConfig.theme);
        document.documentElement.classList.toggle('theme-light', fetchedConfig.theme === 'light');
        document.documentElement.classList.toggle('dark', fetchedConfig.theme === 'dark');
      }
    }
  }, []);

  // Reminder Actions
  const handleOpenEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setIsManualModalOpen(true);
  };

  const handleSaveReminder = async (newReminder: Reminder) => {
    // Clear old timer if editing
    notificationManager.cancelReminder(newReminder.id);
    await saveReminder(newReminder);
    if (newReminder.status === 'active' && newReminder.dueTimestamp > Date.now()) {
      notificationManager.scheduleReminder(
        newReminder,
        config.notificationChime,
        config.voiceAnnouncementEnabled
      );
    }
    setEditingReminder(null);
    await refreshAllData();
  };

  const handleToggleReminderDone = async (reminder: Reminder) => {
    const nextStatus: ReminderStatus = reminder.status === 'completed' ? 'active' : 'completed';
    await updateReminderStatus(reminder.id, nextStatus);
    if (nextStatus === 'completed') {
      notificationManager.cancelReminder(reminder.id);
    } else {
      notificationManager.scheduleReminder(
        { ...reminder, status: nextStatus },
        config.notificationChime
      );
    }
    await refreshAllData();
  };

  const handleSnooze = async (reminder: Reminder, minutes = 15) => {
    const newDueTime = Date.now() + minutes * 60 * 1000;
    await updateReminderStatus(reminder.id, 'snoozed', newDueTime);
    notificationManager.scheduleReminder(
      { ...reminder, dueTimestamp: newDueTime, status: 'active' },
      config.notificationChime
    );
    if (activeFiredReminder?.id === reminder.id) {
      setActiveFiredReminder(null);
    }
    await refreshAllData();
  };

  const handleDeleteReminder = async (id: string) => {
    notificationManager.cancelReminder(id);
    await deleteReminder(id);
    await refreshAllData();
  };

  // Voice Note Actions
  const handleSaveVoiceReminder = async (newReminder: Reminder, newVoiceNote: VoiceNote) => {
    await saveVoiceNote(newVoiceNote);
    await saveReminder(newReminder);
    notificationManager.scheduleReminder(newReminder, config.notificationChime);
    await refreshAllData();
  };

  const handleToggleSaveVoice = async (id: string) => {
    await toggleSaveVoiceNote(id);
    await refreshAllData();
  };

  const handleDeleteVoice = async (id: string) => {
    await deleteVoiceNote(id);
    await refreshAllData();
  };

  const playVoiceNoteAudio = (note: VoiceNote) => {
    if (activePlayingVoiceId === note.id) {
      audioDashboardPlayerRef.current?.pause();
      setActivePlayingVoiceId(null);
      return;
    }

    if (note.audioDataUrl && audioDashboardPlayerRef.current) {
      audioDashboardPlayerRef.current.src = note.audioDataUrl;
      audioDashboardPlayerRef.current.play();
      setActivePlayingVoiceId(note.id);
    }
  };

  // Vault Actions
  const handleUploadVaultItem = async (item: VaultItem) => {
    await saveVaultItem(item);
    await refreshAllData();
  };

  const handleDeleteVaultItem = async (id: string) => {
    await deleteVaultItem(id);
    await refreshAllData();
  };

  // Metric Computations
  const now = Date.now();
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);
  const remindersTodayCount = reminders.filter(
    (r) => r.status === 'active' && r.dueTimestamp >= now && r.dueTimestamp <= dayEnd.getTime()
  ).length;

  const unexpiredVoices = voiceNotes.filter((v) => !v.isSaved);
  const oldestUnsavedDaysLeft = unexpiredVoices.length
    ? Math.max(
        0,
        Math.ceil(((unexpiredVoices[unexpiredVoices.length - 1].expiresAt || now) - now) / (86400 * 1000))
      )
    : config.retentionDays;

  const totalVaultBytes = vaultItems.reduce((acc, v) => acc + v.fileSizeBytes, 0);
  const totalVaultMB = (totalVaultBytes / (1024 * 1024)).toFixed(1);

  // Filtered Reminders
  const filteredReminders = reminders.filter((r) => {
    // If a specific day from Weekly Analysis is selected:
    if (selectedWeeklyDayTimestamp !== null) {
      const dayStart = new Date(selectedWeeklyDayTimestamp);
      dayStart.setHours(0, 0, 0, 0);
      const dayEndTs = new Date(selectedWeeklyDayTimestamp);
      dayEndTs.setHours(23, 59, 59, 999);
      if (r.dueTimestamp < dayStart.getTime() || r.dueTimestamp > dayEndTs.getTime()) {
        return false;
      }
    }

    if (reminderFilter === 'today') {
      return r.dueTimestamp >= now && r.dueTimestamp <= dayEnd.getTime();
    }
    if (reminderFilter === 'active') {
      return r.status === 'active' || r.status === 'snoozed';
    }
    if (reminderFilter === 'completed') {
      return r.status === 'completed';
    }
    if (reminderFilter === 'missed') {
      return r.status === 'missed';
    }
    return true;
  });

  const priorityStyles = {
    low: 'bg-[#2563EB]/15 text-[#93C5FD] border-[#2563EB]/30',
    normal: 'bg-[#2563EB]/25 text-[#60A5FA] border-[#2563EB]/50',
    high: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    urgent: 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-sm',
  };

  const getRelativeCountdown = (timestamp: number, status: ReminderStatus): string => {
    if (status === 'completed') return 'Completed';
    const diff = timestamp - Date.now();
    if (diff <= 0) return 'Past due';
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `in ${hours}h ${mins % 60}m`;
    const days = Math.floor(hours / 24);
    return `in ${days}d ${hours % 24}h`;
  };

  if (isInitializing) {
    return (
      <SplashScreen
        statusMessage={initStatusMessage}
        onComplete={() => setIsInitializing(false)}
      />
    );
  }

  // Strict Name-based Identity Access Gate
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // 4-Second Welcome Transition Screen whenever a user logs in or resets and logs in as another name
  if (welcomeUser) {
    return (
      <WelcomeTransitionScreen
        userName={welcomeUser}
        onComplete={() => setWelcomeUser(null)}
      />
    );
  }

  const isLight = activeTheme === 'light';

  return (
    <div
      className={`min-h-screen ${
        isLight ? 'bg-[#F8FAFC] text-[#0F172A]' : 'bg-[#03060B] text-[#F1F5F9]'
      } flex flex-col font-sans selection:bg-[#CCFF00] selection:text-[#03060B] pb-24 sm:pb-12 transition-colors duration-200`}
    >
      {/* Hidden audio element for voice playback */}
      <audio
        ref={audioDashboardPlayerRef}
        onEnded={() => setActivePlayingVoiceId(null)}
        className="hidden"
      />

      {/* Top Application Bar */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-xl border-b ${
          isLight ? 'bg-white/80 border-black/5' : 'bg-[#03060B]/90 border-[#2563EB]/25'
        } px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors`}
      >
        <div className="flex items-center gap-3">
          {/* Zircon Brand Gem Badge (Electric Cobalt + Acid Lime) */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#1D4ED8] to-[#2563EB] border border-[#2563EB]/50 flex items-center justify-center shadow-lg shadow-[#2563EB]/30 group">
            <Gem className="w-5 h-5 text-[#CCFF00] group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(204,255,0,0.6)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`font-black text-lg tracking-tight ${
                  isLight
                    ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-[#1D4ED8]'
                    : 'bg-gradient-to-r from-white via-[#93C5FD] to-[#CCFF00]'
                } bg-clip-text text-transparent`}
              >
                Zircon
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-[#2563EB]/20 text-[#CCFF00] border border-[#2563EB]/40 rounded-md">
                Local-First
              </span>
            </div>
            <div className="text-[11px] text-[#93C5FD] dark:text-[#93C5FD]/80 font-medium">
              Autonomous Reminders & Document Vault
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* AI Chatbot Assistant Trigger */}
          <button
            onClick={() => setIsChatbotOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#2563EB]/40 bg-[#070D18]/90 text-xs font-bold transition text-white hover:border-[#CCFF00]/50 cursor-pointer shadow-sm shadow-[#2563EB]/20"
            title="Ask Zircon Local AI Assistant"
          >
            <Bot className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span className="hidden sm:inline">AI Chat</span>
          </button>

          {/* Theme Changing Switcher (Light / Dark) */}
          <button
            onClick={handleToggleTheme}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              isLight
                ? 'bg-white border-black/10 text-slate-700 hover:border-black/20 shadow-sm'
                : 'bg-[#070D18]/90 border-[#2563EB]/40 text-slate-300 hover:text-white hover:border-[#2563EB]/70'
            }`}
            title={`Switch to ${isLight ? 'Dark' : 'Light'} theme`}
          >
            {isLight ? (
              <>
                <Moon className="w-4 h-4 text-slate-700" />
                <span className="hidden sm:inline font-medium">Dark Mode</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-[#CCFF00]" />
                <span className="hidden sm:inline font-medium">Light Mode</span>
              </>
            )}
          </button>

          {/* Health Diagnostics Trigger with Access Switch Indicator */}
          <button
            onClick={() => setIsHealthModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              isLight
                ? 'bg-white border-black/10 text-slate-700 hover:border-black/20 shadow-sm'
                : 'bg-[#070D18]/90 border-[#2563EB]/40 text-slate-200 hover:border-[#CCFF00]/50'
            }`}
            title={`System Health Diagnostics (${healthAccessEnabled ? 'Access ON' : 'Access OFF'})`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                healthAccessEnabled ? 'bg-[#CCFF00] pulse-dot' : 'bg-zinc-500'
              }`}
            />
            <Activity className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span className="hidden sm:inline">Health{healthAccessEnabled ? '' : ' (Off)'}</span>
          </button>

          {/* System Settings Trigger */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isLight
                ? 'bg-white border-black/10 text-slate-600 hover:text-slate-900 hover:border-black/20 shadow-sm'
                : 'bg-[#070D18]/90 border-[#2563EB]/40 text-slate-300 hover:text-white hover:border-[#2563EB]/70'
            }`}
            title="System Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Vault Security Status & Lock Trigger (Anonymous - Never shows user name) */}
          <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2.5 border-l border-[#2563EB]/25">
            <button
              onClick={handleLogout}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                isLight
                  ? 'bg-white border-black/10 text-slate-700 hover:text-rose-600 hover:border-rose-300 shadow-sm'
                  : 'bg-[#070D18]/90 border-[#2563EB]/40 text-slate-300 hover:text-rose-400 hover:border-rose-500/50'
              }`}
              title="Lock Vault & Close Session"
            >
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] pulse-dot shrink-0" />
              <Lock className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
              <span className="hidden sm:inline">Lock Vault</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Metric HUD Cards (Midnight Black + Cobalt + Acid Lime) */}
        <section className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {/* 1. Today's Reminders */}
          <div className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#CCFF00]/50 p-4 rounded-3xl space-y-1 transition-all shadow-md shadow-[#2563EB]/10">
            <div className="flex items-center justify-between text-[#93C5FD] text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
              <span>Today</span>
              <Bell className="w-4 h-4 text-[#CCFF00]" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#CCFF00] font-mono">
              {remindersTodayCount}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              Due within 24h
            </div>
          </div>

          {/* 2. Voice Retention Window */}
          <div className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#2563EB]/60 p-4 rounded-3xl space-y-1 transition-all shadow-md shadow-[#2563EB]/10">
            <div className="flex items-center justify-between text-[#93C5FD] text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
              <span>Voice Log</span>
              <Mic className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {oldestUnsavedDaysLeft}d
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              {unexpiredVoices.length} active notes
            </div>
          </div>

          {/* 3. Library Vault Capacity */}
          <div
            onClick={() => setIsVaultModalOpen(true)}
            className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#2563EB]/60 p-4 rounded-3xl cursor-pointer space-y-1 group transition-all shadow-md shadow-[#2563EB]/10"
          >
            <div className="flex items-center justify-between text-[#93C5FD] text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
              <span>PDF Vault</span>
              <FileText className="w-4 h-4 text-[#60A5FA] group-hover:text-[#CCFF00] transition" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {vaultItems.length}
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#93C5FD] truncate font-mono">
              {totalVaultMB} MB / 50MB max
            </div>
          </div>
        </section>

        {/* Primary Quick-Action Buttons */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Action 1: Speak Reminder (Voice Studio) */}
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="bg-gradient-to-tr from-[#1D4ED8]/30 to-[#2563EB]/30 border-2 border-[#2563EB]/50 hover:border-[#CCFF00]/70 p-3.5 sm:p-4 rounded-3xl text-left transition flex flex-col justify-between group cursor-pointer shadow-lg shadow-[#2563EB]/20"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#CCFF00] text-[#03060B] flex items-center justify-center font-black shadow-md shadow-[#CCFF00]/40 group-hover:scale-105 transition-transform mb-2">
              <Mic className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-white">Speak Reminder</div>
              <div className="text-[10px] sm:text-xs text-[#CCFF00] font-semibold">Voice Studio</div>
            </div>
          </button>

          {/* Action 2: Manual Reminder Entry */}
          <button
            onClick={() => {
              setEditingReminder(null);
              setIsManualModalOpen(true);
            }}
            className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#CCFF00]/50 p-3.5 sm:p-4 rounded-3xl text-left transition flex flex-col justify-between group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-[#CCFF00] flex items-center justify-center font-black group-hover:scale-105 transition-transform mb-2">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-white">New Reminder</div>
              <div className="text-[10px] sm:text-xs text-slate-400">Manual entry</div>
            </div>
          </button>

          {/* Action 3: Library Vault Documents */}
          <button
            onClick={() => setIsVaultModalOpen(true)}
            className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#2563EB]/60 p-3.5 sm:p-4 rounded-3xl text-left transition flex flex-col justify-between group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-[#60A5FA] flex items-center justify-center font-black group-hover:scale-105 transition-transform mb-2">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-white">PDF Vault</div>
              <div className="text-[10px] sm:text-xs text-slate-400">&lt; 50MB files</div>
            </div>
          </button>

          {/* Action 4: Zircon Local AI Chatbot */}
          <button
            onClick={() => setIsChatbotOpen(true)}
            className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#CCFF00]/60 p-3.5 sm:p-4 rounded-3xl text-left transition flex flex-col justify-between group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-[#CCFF00] flex items-center justify-center font-black group-hover:scale-105 transition-transform mb-2">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-white">AI Assistant</div>
              <div className="text-[10px] sm:text-xs text-[#CCFF00] font-semibold">Local chat</div>
            </div>
          </button>
        </section>

        {/* Weekly Performance & Workload Analysis Card */}
        <WeeklyAnalysisCard
          reminders={reminders}
          voiceNotes={voiceNotes}
          vaultItems={vaultItems}
          selectedDayTimestamp={selectedWeeklyDayTimestamp}
          onSelectDay={setSelectedWeeklyDayTimestamp}
        />

        {/* Reminders Agenda Feed */}
        <section className="space-y-3">
          {/* Feed Header with Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#CCFF00]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Reminders Agenda
              </h2>
              {selectedWeeklyDayTimestamp !== null && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2563EB]/30 text-[#CCFF00] border border-[#2563EB]/50 flex items-center gap-1">
                  <span>
                    Filtered: {new Date(selectedWeeklyDayTimestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setSelectedWeeklyDayTimestamp(null)}
                    className="hover:text-white font-bold ml-1 cursor-pointer"
                    title="Clear day filter"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['active', 'today', 'all', 'completed', 'missed'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setReminderFilter(tab)}
                  className={`px-3 py-1 text-xs font-semibold rounded-xl capitalize transition shrink-0 cursor-pointer ${
                    reminderFilter === tab
                      ? 'bg-[#CCFF00] text-[#03060B] font-black shadow-md shadow-[#CCFF00]/25'
                      : 'bg-[#070D18]/90 text-slate-400 hover:text-white border border-[#2563EB]/25 hover:border-[#2563EB]/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* List of Reminder Cards */}
          {filteredReminders.length === 0 ? (
            <div className="glass-card p-10 text-center rounded-3xl text-slate-500 dark:text-zinc-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-slate-400 dark:text-zinc-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-800 dark:text-zinc-300">
                No {reminderFilter} reminders found
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                Tap <strong>+ New Reminder</strong> or <strong>Speak Reminder</strong> to schedule local notifications.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredReminders.map((reminder) => {
                const targetDate = new Date(reminder.dueTimestamp);
                const isMissed = reminder.status === 'missed';
                const isCompleted = reminder.status === 'completed';
                const attachedVoice = voiceNotes.find((v) => v.id === reminder.voiceNoteId);

                return (
                  <div
                    key={reminder.id}
                    className={`bg-[#070D18]/90 border border-[#2563EB]/25 hover:border-[#CCFF00]/40 p-4 rounded-3xl transition-all shadow-sm ${
                      isCompleted ? 'opacity-60' : isMissed ? 'border-rose-500/40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Checkbox Complete */}
                      <button
                        type="button"
                        onClick={() => handleToggleReminderDone(reminder)}
                        className={`w-6 h-6 rounded-xl border mt-0.5 flex items-center justify-center transition shrink-0 cursor-pointer ${
                          isCompleted
                            ? 'bg-[#CCFF00] border-[#CCFF00] text-[#03060B] font-black'
                            : 'border-[#2563EB]/40 hover:border-[#CCFF00] bg-[#03060B]'
                        }`}
                        title={isCompleted ? 'Mark active' : 'Mark completed'}
                      >
                        {isCompleted && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                      </button>

                      {/* Reminder Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={`text-sm font-bold ${
                              isCompleted
                                ? 'line-through text-slate-500'
                                : 'text-white'
                            }`}
                          >
                            {reminder.title}
                          </h3>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                              priorityStyles[reminder.priority]
                            }`}
                          >
                            {reminder.priority}
                          </span>
                        </div>

                        {reminder.notes && (
                          <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                            {reminder.notes}
                          </p>
                        )}

                        {/* Timing and Relative Countdown */}
                        <div className="flex items-center gap-3 text-xs text-slate-400 font-medium pt-1">
                          <div className="flex items-center gap-1 text-slate-200">
                            <Calendar className="w-3.5 h-3.5 text-[#CCFF00]" />
                            <span>
                              {targetDate.toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="text-[#2563EB]">·</span>
                            <span className="font-semibold text-white">
                              {targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <span className="text-[#2563EB]">•</span>

                          <span
                            className={`font-mono font-semibold ${
                              isMissed
                                ? 'text-rose-400'
                                : isCompleted
                                ? 'text-slate-500'
                                : 'text-[#CCFF00]'
                            }`}
                          >
                            {getRelativeCountdown(reminder.dueTimestamp, reminder.status)}
                          </span>
                        </div>

                        {/* Attached Voice Note Widget */}
                        {attachedVoice && (
                          <div className="mt-2.5 pt-2 border-t border-[#2563EB]/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => playVoiceNoteAudio(attachedVoice)}
                                className="w-7 h-7 rounded-lg bg-[#2563EB]/25 text-[#CCFF00] hover:bg-[#CCFF00] hover:text-[#03060B] border border-[#2563EB]/40 flex items-center justify-center transition cursor-pointer"
                              >
                                {activePlayingVoiceId === attachedVoice.id ? (
                                  <Pause className="w-3.5 h-3.5" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                )}
                              </button>
                              <span className="text-[11px] text-slate-300">
                                Voice Note ({attachedVoice.durationSeconds}s)
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                attachedVoice.isSaved
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                  : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400'
                              }`}
                            >
                              {attachedVoice.isSaved ? 'Permanent' : '20d retention'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Reminder Actions (Edit, Snooze 15m & Delete) */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Edit Reminder */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditReminder(reminder)}
                          className="p-2 rounded-xl text-slate-400 hover:text-[#00F5A0] hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                          title="Edit reminder date & time"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleSnooze(reminder, 15)}
                            className="p-2 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                            title="Snooze 15 minutes"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteReminder(reminder.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                          title="Delete reminder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Voice Recordings Shelf (20-day retention & permanent bookmarking) */}
        {voiceNotes.length > 0 && (
          <section className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Voice Recordings ({voiceNotes.length})
                </h2>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                Auto-prunes after {config.retentionDays} days unless saved
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {voiceNotes.slice(0, 4).map((note) => {
                const daysLeft = note.expiresAt
                  ? Math.max(0, Math.ceil((note.expiresAt - Date.now()) / (86400 * 1000)))
                  : null;

                return (
                  <div
                    key={note.id}
                    className="glass-card p-3.5 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => playVoiceNoteAudio(note)}
                        className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-zinc-950 flex items-center justify-center transition shrink-0"
                      >
                        {activePlayingVoiceId === note.id ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-zinc-200 truncate">
                          "{note.transcript}"
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                          <span>{note.durationSeconds}s</span>
                          <span>•</span>
                          <span className={note.isSaved ? 'text-amber-500 font-semibold' : 'text-slate-500 dark:text-zinc-400'}>
                            {note.isSaved ? 'Permanent (Saved)' : `${daysLeft}d left`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSaveVoice(note.id)}
                        className={`p-1.5 rounded-lg transition ${
                          note.isSaved
                            ? 'text-amber-500 bg-amber-500/15'
                            : 'text-slate-400 dark:text-zinc-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title={note.isSaved ? 'Permanent: Click to un-save' : 'Save permanently'}
                      >
                        <Bookmark className="w-4 h-4 fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteVoice(note.id)}
                        className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* In-App Active Reminder Trigger Toast / Alert Modal */}
      {activeFiredReminder && (
        <div
          className={`fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-50 glass-card border-2 border-[#00F5A0] rounded-3xl p-4 shadow-2xl animate-in slide-in-from-bottom-5`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#00F5A0] text-zinc-950 flex items-center justify-center font-black animate-bounce">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-[#00F5A0]">
                  Zircon Alarm Due Now
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  {activeFiredReminder.title}
                </h4>
              </div>
            </div>
            <button
              onClick={() => setActiveFiredReminder(null)}
              className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              ✕
            </button>
          </div>

          {activeFiredReminder.notes && (
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 pl-11">
              {activeFiredReminder.notes}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 pl-11">
            <button
              type="button"
              onClick={() => handleSnooze(activeFiredReminder, 15)}
              className="py-1.5 px-3 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-800 dark:text-zinc-200 transition"
            >
              Snooze 15m
            </button>
            <button
              type="button"
              onClick={() => {
                handleToggleReminderDone(activeFiredReminder);
                setActiveFiredReminder(null);
              }}
              className="py-1.5 px-3 rounded-xl bg-[#00F5A0] hover:bg-[#00d68c] text-xs font-bold text-zinc-950 transition"
            >
              Mark Completed
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {isManualModalOpen && (
        <ManualReminderModal
          isOpen={isManualModalOpen}
          onClose={() => {
            setIsManualModalOpen(false);
            setEditingReminder(null);
          }}
          onSave={handleSaveReminder}
          reminderToEdit={editingReminder}
        />
      )}

      {isVoiceModalOpen && (
        <VoiceReminderModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          onSaveVoiceReminder={handleSaveVoiceReminder}
          defaultLanguage={config.voiceLanguage}
        />
      )}

      {isVaultModalOpen && (
        <LibraryVaultModal
          isOpen={isVaultModalOpen}
          onClose={() => setIsVaultModalOpen(false)}
          vaultItems={vaultItems}
          onUploadItem={handleUploadVaultItem}
          onDeleteItem={handleDeleteVaultItem}
        />
      )}

      {isHealthModalOpen && (
        <SystemHealthModal
          isOpen={isHealthModalOpen}
          onClose={() => setIsHealthModalOpen(false)}
          healthAccessEnabled={healthAccessEnabled}
          onToggleHealthAccess={(enabled) => {
            setHealthAccessEnabled(enabled);
            localStorage.setItem('zircon_health_access', String(enabled));
          }}
          onCompleteReset={handleCompleteReset}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          config={config}
          currentUser={currentUser}
          onLogout={handleLogout}
          onFactoryReset={handleFactoryReset}
          onCompleteReset={handleCompleteReset}
          onSaveConfig={async (upd) => {
            const newCfg = await saveSystemConfig(upd);
            setConfig(newCfg);
            if (typeof upd.healthAccessEnabled === 'boolean') {
              setHealthAccessEnabled(upd.healthAccessEnabled);
            }
          }}
          onThemeChange={handleSetSpecificTheme}
          onRefreshData={refreshAllData}
        />
      )}

      {/* Floating Zircon AI Assistant Trigger Button (Electric Cobalt + Acid Lime) */}
      <button
        onClick={() => setIsChatbotOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3 sm:px-4 sm:py-3 rounded-full bg-gradient-to-tr from-[#1D4ED8] to-[#2563EB] shadow-2xl shadow-[#2563EB]/40 flex items-center gap-2.5 group cursor-pointer hover:scale-105 transition-all border-2 border-[#CCFF00]/40"
        title="Ask Zircon Local AI Assistant"
      >
        <div className="relative">
          <Bot className="w-5 h-5 text-[#CCFF00] group-hover:rotate-12 transition-transform" />
          <span className="w-2 h-2 rounded-full bg-[#CCFF00] pulse-dot absolute -top-1 -right-1" />
        </div>
        <span className="hidden sm:inline text-xs font-black text-white">
          Ask Zircon
        </span>
      </button>

      {/* Zircon AI Chatbot Modal */}
      {isChatbotOpen && (
        <ChatbotModal
          isOpen={isChatbotOpen}
          onClose={() => setIsChatbotOpen(false)}
          reminders={reminders}
          voiceNotes={voiceNotes}
          vaultItems={vaultItems}
          retentionDays={config.retentionDays}
          onScheduleReminder={handleSaveReminder}
          onOpenVault={() => {
            setIsChatbotOpen(false);
            setIsVaultModalOpen(true);
          }}
          onOpenHealth={() => {
            setIsChatbotOpen(false);
            setIsHealthModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
