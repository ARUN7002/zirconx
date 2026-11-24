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
  Monitor,
  Smartphone,
  SlidersHorizontal,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Reminder, VoiceNote, VaultItem, SystemConfig, ReminderStatus, DisplayMode } from './types';
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
import { MobileBottomNav } from './components/MobileBottomNav';

export default function App() {
  // Splash & Initialization State
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatusMessage, setInitStatusMessage] = useState('Verifying Zircon security gate...');

  // Active Authenticated User (Open to anyone by name, strictly isolated per account)
  const [currentUser, setCurrentUser] = useState<string | null>(() => getActiveUser());

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

  // Display Mode: 'auto' (responsive) | 'mobile' (dedicated mobile version) | 'desktop' (workstation)
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zircon_display_mode') as DisplayMode | null;
      if (saved === 'auto' || saved === 'mobile' || saved === 'desktop') return saved;
    }
    return 'auto';
  });

  // Phone Frame simulation toggle when displayMode === 'mobile' on desktop screens
  const [isPhoneFrameSimulated, setIsPhoneFrameSimulated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zircon_phone_frame_simulated');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  // Window width tracking for responsive auto-detection
  const [windowWidth, setWindowWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1280;
  });

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute effective display layout
  const isEffectiveMobile = displayMode === 'mobile' || (displayMode === 'auto' && windowWidth < 1024);
  const isDesktopChassis = displayMode === 'mobile' && windowWidth >= 768 && isPhoneFrameSimulated;

  const handleChangeDisplayMode = (mode: DisplayMode) => {
    setDisplayMode(mode);
    localStorage.setItem('zircon_display_mode', mode);
    saveSystemConfig({ displayMode: mode }).catch(console.error);
  };

  const handleTogglePhoneFrame = () => {
    const next = !isPhoneFrameSimulated;
    setIsPhoneFrameSimulated(next);
    localStorage.setItem('zircon_phone_frame_simulated', String(next));
  };

  // Mobile Bottom Navigation active tab
  const [mobileActiveTab, setMobileActiveTab] = useState<'agenda' | 'weekly' | 'vault'>('agenda');

  // 3.5-Second Welcome Transition on Login, Name Change, or Every Page Entry
  const [welcomeUser, setWelcomeUser] = useState<string | null>(() => getActiveUser());

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

  // Login Success Handler (Open to any name, strictly isolated per account)
  const handleLoginSuccess = async (userName: string) => {
    notificationManager.cancelAll();
    setActiveUser(userName);
    setCurrentUser(userName);
    setWelcomeUser(userName); // Trigger 3.5-second Welcome "[Name]" Screen

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
    if (fetchedConfig.displayMode) {
      const local = localStorage.getItem('zircon_display_mode') as DisplayMode | null;
      if (!local) {
        setDisplayMode(fetchedConfig.displayMode);
      }
    }
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

  // Name-based Identity Access Gate (Open to everyone)
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // 3.5-Second Welcome Transition Screen after loading, on login, or every page entry
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
          {/* Display Version Switcher (Auto / Desktop / Mobile) */}
          <div className="flex items-center bg-[#070D18]/90 border border-[#2563EB]/40 rounded-xl p-0.5 text-xs shadow-sm shadow-[#2563EB]/15">
            <button
              type="button"
              onClick={() => handleChangeDisplayMode('auto')}
              className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer ${
                displayMode === 'auto'
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Auto Responsive: Automatically adapts to screen dimensions"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span className="hidden xl:inline text-[11px]">Auto</span>
            </button>
            <button
              type="button"
              onClick={() => handleChangeDisplayMode('desktop')}
              className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer ${
                displayMode === 'desktop'
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Desktop Workstation Version: Expansive dual-column dashboard"
            >
              <Monitor className="w-3 h-3" />
              <span className="hidden sm:inline text-[11px]">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => handleChangeDisplayMode('mobile')}
              className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer ${
                displayMode === 'mobile'
                  ? 'bg-[#CCFF00] text-[#03060B] shadow-sm font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Mobile Smartphone Version: Dedicated thumb-friendly interface"
            >
              <Smartphone className="w-3 h-3" />
              <span className="hidden sm:inline text-[11px]">Mobile</span>
            </button>
          </div>

          {/* AI Chatbot Assistant Trigger */}
          <button
            onClick={() => setIsChatbotOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#2563EB]/40 bg-[#070D18]/90 text-xs font-bold transition text-white hover:border-[#CCFF00]/50 cursor-pointer shadow-sm shadow-[#2563EB]/20"
            title="Ask Zircon Local AI Assistant"
          >
            <Bot className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span className="hidden sm:inline">AI Chat</span>
          </button>

          {/* Theme Changing Switcher (Light / Dark) */}
          <button
            onClick={handleToggleTheme}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
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
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
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
          <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2 border-l border-[#2563EB]/25">
            <button
              onClick={handleLogout}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                isLight
                  ? 'bg-white border-black/10 text-slate-700 hover:text-rose-600 hover:border-rose-300 shadow-sm'
                  : 'bg-[#070D18]/90 border-[#2563EB]/40 text-slate-300 hover:text-rose-400 hover:border-rose-500/50'
              }`}
              title="Lock Vault & Close Session"
            >
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] pulse-dot shrink-0" />
              <Lock className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>
      </header>

      {/* Simulator Control Strip when Mobile Mode is viewed on Desktop */}
      {isDesktopChassis && (
        <div className="bg-[#070D18]/95 border-b border-[#2563EB]/30 px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#CCFF00] pulse-dot shrink-0" />
            <span className="font-black text-[#CCFF00] tracking-wide uppercase text-[11px]">
              Mobile Device Preview
            </span>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
              (390px × 844px Smartphone Canvas)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePhoneFrame}
              className="px-2.5 py-1 rounded-xl border border-[#2563EB]/40 bg-[#03060B] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              title="Toggle smartphone chassis frame bezel"
            >
              <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Chassis: {isPhoneFrameSimulated ? 'Frame ON' : 'Edge-to-Edge'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleChangeDisplayMode('desktop')}
              className="px-3 py-1 rounded-xl bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:brightness-110 shadow-sm shadow-[#2563EB]/30 transition"
              title="Switch to expansive desktop dual-column workstation"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Switch to Desktop</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DEDICATED MOBILE VERSION OF DISPLAY (Thumb-Zone & Smartphone Dimensioned) */}
      {/* ========================================================================= */}
      {isEffectiveMobile ? (
        isDesktopChassis ? (
          /* Desktop Smartphone Simulator Wrapper */
          <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-[#020408] bg-radial from-[#070D18] via-[#03060B] to-[#010204] min-h-[calc(100vh-120px)]">
            <div className="w-[390px] h-[844px] max-h-[calc(100vh-140px)] rounded-[50px] border-[10px] border-zinc-800 shadow-[0_25px_80px_rgba(37,99,235,0.3)] relative overflow-hidden bg-[#03060B] flex flex-col ring-1 ring-white/10">
              {/* Dynamic Island Notch */}
              <div className="w-28 h-6 bg-black rounded-full mx-auto mt-2 mb-1 shrink-0 flex items-center justify-between px-3">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-700/60" />
                <div className="w-2 h-2 rounded-full bg-[#2563EB]/50" />
              </div>
              {/* Simulated Mobile Status Bar */}
              <div className="flex items-center justify-between px-6 py-0.5 text-[11px] font-mono font-semibold text-slate-400 shrink-0">
                <span>9:41</span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span>5G</span>
                  <div className="w-4 h-2 rounded-sm border border-slate-400 p-0.5 flex items-center">
                    <div className="w-full h-full bg-[#CCFF00] rounded-xs" />
                  </div>
                </div>
              </div>

              {/* Scrollable Mobile Viewport */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-3.5 py-3 space-y-4 pb-24">
                {/* Mobile Active Tab View Content */}
                {mobileActiveTab === 'agenda' && (
                  <>
                    {/* Compact Mobile HUD Metrics */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#070D18]/90 border border-[#2563EB]/30 p-2.5 rounded-2xl space-y-0.5 text-center shadow-sm">
                        <div className="flex items-center justify-center gap-1 text-[#93C5FD] text-[10px] font-semibold uppercase">
                          <Bell className="w-3 h-3 text-[#CCFF00]" />
                          <span>Today</span>
                        </div>
                        <div className="text-lg font-black text-[#CCFF00] font-mono">
                          {remindersTodayCount}
                        </div>
                        <div className="text-[9px] text-slate-400">Due 24h</div>
                      </div>

                      <div className="bg-[#070D18]/90 border border-[#2563EB]/30 p-2.5 rounded-2xl space-y-0.5 text-center shadow-sm">
                        <div className="flex items-center justify-center gap-1 text-[#93C5FD] text-[10px] font-semibold uppercase">
                          <Mic className="w-3 h-3 text-[#3B82F6]" />
                          <span>Voice</span>
                        </div>
                        <div className="text-lg font-black text-white font-mono">
                          {oldestUnsavedDaysLeft}d
                        </div>
                        <div className="text-[9px] text-slate-400">{unexpiredVoices.length} notes</div>
                      </div>

                      <div
                        onClick={() => setIsVaultModalOpen(true)}
                        className="bg-[#070D18]/90 border border-[#2563EB]/30 p-2.5 rounded-2xl space-y-0.5 text-center shadow-sm cursor-pointer active:scale-95 transition"
                      >
                        <div className="flex items-center justify-center gap-1 text-[#93C5FD] text-[10px] font-semibold uppercase">
                          <FileText className="w-3 h-3 text-[#60A5FA]" />
                          <span>Vault</span>
                        </div>
                        <div className="text-lg font-black text-white font-mono">
                          {vaultItems.length}
                        </div>
                        <div className="text-[9px] text-[#93C5FD] font-mono">{totalVaultMB}MB</div>
                      </div>
                    </div>

                    {/* Mobile Quick Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setIsVoiceModalOpen(true)}
                        className="bg-gradient-to-tr from-[#1D4ED8]/30 to-[#2563EB]/30 border border-[#2563EB]/50 p-3 rounded-2xl text-left flex items-center gap-2.5 cursor-pointer active:scale-95 transition shadow-sm"
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#CCFF00] text-[#03060B] flex items-center justify-center font-black shrink-0">
                          <Mic className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">Voice Studio</div>
                          <div className="text-[10px] text-[#CCFF00] font-semibold truncate">Speak reminder</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setEditingReminder(null);
                          setIsManualModalOpen(true);
                        }}
                        className="bg-[#070D18]/90 border border-[#2563EB]/30 p-3 rounded-2xl text-left flex items-center gap-2.5 cursor-pointer active:scale-95 transition shadow-sm"
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-[#CCFF00] flex items-center justify-center font-black shrink-0">
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">New Reminder</div>
                          <div className="text-[10px] text-slate-400 truncate">Manual entry</div>
                        </div>
                      </button>
                    </div>

                    {/* Mobile Reminders Agenda Section */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5 text-[#CCFF00]" />
                          <span>Agenda</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#2563EB]/25 text-[#93C5FD]">
                            {filteredReminders.length}
                          </span>
                        </div>

                        {/* Filter pills */}
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                          {(['active', 'today', 'all', 'completed', 'missed'] as const).map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setReminderFilter(tab)}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-lg capitalize transition shrink-0 cursor-pointer ${
                                reminderFilter === tab
                                  ? 'bg-[#CCFF00] text-[#03060B]'
                                  : 'bg-[#070D18]/80 text-slate-400 border border-[#2563EB]/20'
                              }`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Reminder Card List */}
                      {filteredReminders.length === 0 ? (
                        <div className="glass-card p-6 text-center rounded-2xl text-slate-400 space-y-1.5">
                          <CheckCircle2 className="w-8 h-8 text-zinc-600 mx-auto" />
                          <div className="text-xs font-semibold text-zinc-300">
                            No {reminderFilter} reminders
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Tap + or the center microphone to record.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredReminders.map((reminder) => {
                            const targetDate = new Date(reminder.dueTimestamp);
                            const isMissed = reminder.status === 'missed';
                            const isCompleted = reminder.status === 'completed';
                            const attachedVoice = voiceNotes.find((v) => v.id === reminder.voiceNoteId);

                            return (
                              <div
                                key={reminder.id}
                                className={`bg-[#070D18]/90 border border-[#2563EB]/25 p-3 rounded-2xl transition-all shadow-sm ${
                                  isCompleted ? 'opacity-60' : isMissed ? 'border-rose-500/40' : ''
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  {/* Checkbox Complete */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleReminderDone(reminder)}
                                    className={`w-7 h-7 rounded-xl border flex items-center justify-center transition shrink-0 cursor-pointer ${
                                      isCompleted
                                        ? 'bg-[#CCFF00] border-[#CCFF00] text-[#03060B] font-black'
                                        : 'border-[#2563EB]/40 bg-[#03060B]'
                                    }`}
                                  >
                                    {isCompleted && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                                  </button>

                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <h3
                                        className={`text-xs font-bold truncate ${
                                          isCompleted ? 'line-through text-slate-500' : 'text-white'
                                        }`}
                                      >
                                        {reminder.title}
                                      </h3>
                                      <span
                                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                                          priorityStyles[reminder.priority]
                                        }`}
                                      >
                                        {reminder.priority}
                                      </span>
                                    </div>

                                    {reminder.notes && (
                                      <p className="text-[11px] text-slate-300 line-clamp-1">
                                        {reminder.notes}
                                      </p>
                                    )}

                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                                      <span>
                                        {targetDate.toLocaleDateString(undefined, {
                                          month: 'short',
                                          day: 'numeric',
                                        })}{' '}
                                        · {targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
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

                                    {attachedVoice && (
                                      <div className="mt-1.5 pt-1.5 border-t border-[#2563EB]/20 flex items-center justify-between">
                                        <button
                                          type="button"
                                          onClick={() => playVoiceNoteAudio(attachedVoice)}
                                          className="flex items-center gap-1.5 text-[10px] text-[#CCFF00] font-semibold cursor-pointer"
                                        >
                                          {activePlayingVoiceId === attachedVoice.id ? (
                                            <Pause className="w-3 h-3" />
                                          ) : (
                                            <Play className="w-3 h-3 fill-current" />
                                          )}
                                          <span>Play Voice Note ({attachedVoice.durationSeconds}s)</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Quick Actions */}
                                  <div className="flex flex-col gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditReminder(reminder)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#CCFF00] cursor-pointer"
                                      title="Edit reminder"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteReminder(reminder.id)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                                      title="Delete reminder"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Mobile Weekly Tab */}
                {mobileActiveTab === 'weekly' && (
                  <div className="space-y-3">
                    <WeeklyAnalysisCard
                      reminders={reminders}
                      voiceNotes={voiceNotes}
                      vaultItems={vaultItems}
                      selectedDayTimestamp={selectedWeeklyDayTimestamp}
                      onSelectDay={setSelectedWeeklyDayTimestamp}
                    />

                    {selectedWeeklyDayTimestamp !== null && (
                      <div className="bg-[#070D18]/90 border border-[#2563EB]/30 p-3 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span>
                            {new Date(selectedWeeklyDayTimestamp).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <button
                            onClick={() => setSelectedWeeklyDayTimestamp(null)}
                            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear Day Filter
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {filteredReminders.length} reminder(s) scheduled for this day.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mobile Vault Tab */}
                {mobileActiveTab === 'vault' && (
                  <div className="space-y-3">
                    <div className="bg-[#070D18]/90 border border-[#2563EB]/40 p-4 rounded-3xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-[#60A5FA]" />
                          <h3 className="text-sm font-bold text-white">PDF Vault</h3>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#CCFF00]">
                          {totalVaultMB} MB / 50MB
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Secure offline PDF documents stored directly in IndexedDB sandbox.
                      </p>
                      <button
                        onClick={() => setIsVaultModalOpen(true)}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#2563EB]/25"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Open Document Vault ({vaultItems.length})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Home Indicator */}
              <div className="w-32 h-1 bg-white/30 rounded-full mx-auto my-1 shrink-0" />

              {/* Mobile Bottom Navigation Bar (Inside Simulator Frame) */}
              <MobileBottomNav
                activeTab={mobileActiveTab}
                onSelectTab={setMobileActiveTab}
                onOpenVoice={() => setIsVoiceModalOpen(true)}
                onOpenManual={() => {
                  setEditingReminder(null);
                  setIsManualModalOpen(true);
                }}
                onOpenVault={() => setIsVaultModalOpen(true)}
                onOpenChat={() => setIsChatbotOpen(true)}
                onOpenHealth={() => setIsHealthModalOpen(true)}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onLogout={handleLogout}
                remindersCount={remindersTodayCount}
                vaultCount={vaultItems.length}
                activeTheme={activeTheme}
                onToggleTheme={handleToggleTheme}
                displayMode={displayMode}
                onChangeDisplayMode={handleChangeDisplayMode}
                healthAccessEnabled={healthAccessEnabled}
              />
            </div>
          </div>
        ) : (
          /* Real Device Full-Width Mobile View */
          <main className="flex-1 max-w-lg w-full mx-auto px-4 py-4 space-y-4 pb-28">
            {mobileActiveTab === 'agenda' && (
              <>
                {/* Compact Mobile HUD Metrics */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-[#070D18]/90 border border-[#2563EB]/30 p-3 rounded-2xl space-y-0.5 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-1 text-[#93C5FD] text-[11px] font-semibold uppercase">
                      <Bell className="w-3.5 h-3.5 text-[#CCFF00]" />
                      <span>Today</span>
                    </div>
                    <div className="text-xl font-black text-[#CCFF00] font-mono">
                      {remindersTodayCount}
                    </div>
                    <div className="text-[10px] text-slate-400">Due 24h</div>
                  </div>

                  <div className="bg-[#070D18]/90 border border-[#2563EB]/30 p-3 rounded-2xl space-y-0.5 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-1 text-[#93C5FD] text-[11px] font-semibold uppercase">
                      <Mic className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>Voice</span>
                    </div>
                    <div className="text-xl font-black text-white font-mono">
                      {oldestUnsavedDaysLeft}d
                    </div>
                    <div className="text-[10px] text-slate-400">{unexpiredVoices.length} notes</div>
                  </div>

                  <div
                    onClick={() => setIsVaultModalOpen(true)}
                    className="bg-[#070D18]/90 border border-[#2563EB]/30 p-3 rounded-2xl space-y-0.5 text-center shadow-sm cursor-pointer active:scale-95 transition"
                  >
                    <div className="flex items-center justify-center gap-1 text-[#93C5FD] text-[11px] font-semibold uppercase">
                      <FileText className="w-3.5 h-3.5 text-[#60A5FA]" />
                      <span>Vault</span>
                    </div>
                    <div className="text-xl font-black text-white font-mono">
                      {vaultItems.length}
                    </div>
                    <div className="text-[10px] text-[#93C5FD] font-mono">{totalVaultMB}MB</div>
                  </div>
                </div>

                {/* Mobile Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setIsVoiceModalOpen(true)}
                    className="bg-gradient-to-tr from-[#1D4ED8]/30 to-[#2563EB]/30 border-2 border-[#2563EB]/50 p-3.5 rounded-2xl text-left flex items-center gap-3 cursor-pointer active:scale-95 transition shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-[#CCFF00] text-[#03060B] flex items-center justify-center font-black shrink-0 shadow-sm shadow-[#CCFF00]/30">
                      <Mic className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">Voice Studio</div>
                      <div className="text-[10px] text-[#CCFF00] font-semibold truncate">Speak reminder</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setEditingReminder(null);
                      setIsManualModalOpen(true);
                    }}
                    className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 p-3.5 rounded-2xl text-left flex items-center gap-3 cursor-pointer active:scale-95 transition shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-[#CCFF00] flex items-center justify-center font-black shrink-0">
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">New Reminder</div>
                      <div className="text-[10px] text-slate-400 truncate">Manual entry</div>
                    </div>
                  </button>
                </div>

                {/* Mobile Reminders Agenda Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wider">
                      <Clock className="w-4 h-4 text-[#CCFF00]" />
                      <span>Reminders Agenda</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#2563EB]/25 text-[#93C5FD]">
                        {filteredReminders.length}
                      </span>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                      {(['active', 'today', 'all', 'completed', 'missed'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setReminderFilter(tab)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-xl capitalize transition shrink-0 cursor-pointer ${
                            reminderFilter === tab
                              ? 'bg-[#CCFF00] text-[#03060B]'
                              : 'bg-[#070D18]/80 text-slate-400 border border-[#2563EB]/20'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reminder Card List */}
                  {filteredReminders.length === 0 ? (
                    <div className="glass-card p-8 text-center rounded-3xl text-slate-400 space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-zinc-600 mx-auto" />
                      <div className="text-xs font-semibold text-zinc-300">
                        No {reminderFilter} reminders found
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Tap + New Reminder or speak into the microphone to set an alert.
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
                            className={`bg-[#070D18]/90 border border-[#2563EB]/25 p-3.5 rounded-2xl transition-all shadow-sm ${
                              isCompleted ? 'opacity-60' : isMissed ? 'border-rose-500/40' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Checkbox Complete */}
                              <button
                                type="button"
                                onClick={() => handleToggleReminderDone(reminder)}
                                className={`w-8 h-8 rounded-xl border flex items-center justify-center transition shrink-0 cursor-pointer ${
                                  isCompleted
                                    ? 'bg-[#CCFF00] border-[#CCFF00] text-[#03060B] font-black'
                                    : 'border-[#2563EB]/40 bg-[#03060B]'
                                }`}
                              >
                                {isCompleted && <CheckCircle2 className="w-5 h-5 stroke-[3]" />}
                              </button>

                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h3
                                    className={`text-xs font-bold truncate ${
                                      isCompleted ? 'line-through text-slate-500' : 'text-white'
                                    }`}
                                  >
                                    {reminder.title}
                                  </h3>
                                  <span
                                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                                      priorityStyles[reminder.priority]
                                    }`}
                                  >
                                    {reminder.priority}
                                  </span>
                                </div>

                                {reminder.notes && (
                                  <p className="text-[11px] text-slate-300 line-clamp-2">
                                    {reminder.notes}
                                  </p>
                                )}

                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                                  <span>
                                    {targetDate.toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })}{' '}
                                    · {targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
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

                                {attachedVoice && (
                                  <div className="mt-2 pt-2 border-t border-[#2563EB]/20 flex items-center justify-between">
                                    <button
                                      type="button"
                                      onClick={() => playVoiceNoteAudio(attachedVoice)}
                                      className="flex items-center gap-1.5 text-xs text-[#CCFF00] font-semibold cursor-pointer"
                                    >
                                      {activePlayingVoiceId === attachedVoice.id ? (
                                        <Pause className="w-3.5 h-3.5" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                      )}
                                      <span>Play Voice Note ({attachedVoice.durationSeconds}s)</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Quick Actions */}
                              <div className="flex flex-col gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditReminder(reminder)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#CCFF00] cursor-pointer"
                                  title="Edit reminder"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReminder(reminder.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
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
                </div>
              </>
            )}

            {/* Mobile Weekly Tab */}
            {mobileActiveTab === 'weekly' && (
              <div className="space-y-4">
                <WeeklyAnalysisCard
                  reminders={reminders}
                  voiceNotes={voiceNotes}
                  vaultItems={vaultItems}
                  selectedDayTimestamp={selectedWeeklyDayTimestamp}
                  onSelectDay={setSelectedWeeklyDayTimestamp}
                />
              </div>
            )}

            {/* Mobile Vault Tab */}
            {mobileActiveTab === 'vault' && (
              <div className="space-y-4">
                <div className="bg-[#070D18]/90 border border-[#2563EB]/40 p-5 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-6 h-6 text-[#60A5FA]" />
                      <div>
                        <h3 className="text-base font-bold text-white">Document Vault</h3>
                        <p className="text-xs text-slate-400">Offline indexed sandbox</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#CCFF00] bg-[#2563EB]/25 px-2.5 py-1 rounded-xl border border-[#2563EB]/40">
                      {totalVaultMB} MB / 50MB
                    </span>
                  </div>

                  <button
                    onClick={() => setIsVaultModalOpen(true)}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#2563EB]/30"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Manage Vault Documents ({vaultItems.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Bottom Navigation Bar (Fixed to device screen) */}
            <MobileBottomNav
              activeTab={mobileActiveTab}
              onSelectTab={setMobileActiveTab}
              onOpenVoice={() => setIsVoiceModalOpen(true)}
              onOpenManual={() => {
                setEditingReminder(null);
                setIsManualModalOpen(true);
              }}
              onOpenVault={() => setIsVaultModalOpen(true)}
              onOpenChat={() => setIsChatbotOpen(true)}
              onOpenHealth={() => setIsHealthModalOpen(true)}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              onLogout={handleLogout}
              remindersCount={remindersTodayCount}
              vaultCount={vaultItems.length}
              activeTheme={activeTheme}
              onToggleTheme={handleToggleTheme}
              displayMode={displayMode}
              onChangeDisplayMode={handleChangeDisplayMode}
              healthAccessEnabled={healthAccessEnabled}
            />
          </main>
        )
      ) : (
        /* ========================================================================= */
        /* 2. EXPANSIVE DESKTOP WORKSTATION DISPLAY (Dual-Column Panoramic Grid)      */
        /* ========================================================================= */
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
          {/* Top Quick Actions Bar */}
          <section className="grid grid-cols-4 gap-4">
            {/* Action 1: Speak Reminder (Voice Studio) */}
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="bg-gradient-to-tr from-[#1D4ED8]/30 to-[#2563EB]/30 border-2 border-[#2563EB]/50 hover:border-[#CCFF00]/70 p-4 rounded-3xl text-left transition flex items-center gap-3.5 group cursor-pointer shadow-lg shadow-[#2563EB]/20"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#CCFF00] text-[#03060B] flex items-center justify-center font-black shadow-md shadow-[#CCFF00]/40 group-hover:scale-105 transition-transform shrink-0">
                <Mic className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">Speak Reminder</div>
                <div className="text-xs text-[#CCFF00] font-semibold truncate">Voice Studio 20d</div>
              </div>
            </button>

            {/* Action 2: Manual Reminder Entry */}
            <button
              onClick={() => {
                setEditingReminder(null);
                setIsManualModalOpen(true);
              }}
              className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#CCFF00]/50 p-4 rounded-3xl text-left transition flex items-center gap-3.5 group cursor-pointer shadow-sm"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-[#CCFF00] flex items-center justify-center font-black group-hover:scale-105 transition-transform shrink-0">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">New Reminder</div>
                <div className="text-xs text-slate-400 truncate">Manual Entry Form</div>
              </div>
            </button>

            {/* Action 3: Library Vault Documents */}
            <button
              onClick={() => setIsVaultModalOpen(true)}
              className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#2563EB]/60 p-4 rounded-3xl text-left transition flex items-center gap-3.5 group cursor-pointer shadow-sm"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-[#60A5FA] flex items-center justify-center font-black group-hover:scale-105 transition-transform shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">PDF Vault</div>
                <div className="text-xs text-slate-400 truncate">&lt; 50MB files ({vaultItems.length})</div>
              </div>
            </button>

            {/* Action 4: Zircon Local AI Chatbot */}
            <button
              onClick={() => setIsChatbotOpen(true)}
              className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#CCFF00]/60 p-4 rounded-3xl text-left transition flex items-center gap-3.5 group cursor-pointer shadow-sm"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#2563EB]/25 border border-[#2563EB]/50 text-[#CCFF00] flex items-center justify-center font-black group-hover:scale-105 transition-transform shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">AI Assistant</div>
                <div className="text-xs text-[#CCFF00] font-semibold truncate">Local Intelligence</div>
              </div>
            </button>
          </section>

          {/* Dual-Column Workstation Layout */}
          <div className="grid grid-cols-12 gap-6 items-start">
            {/* Left Column: Agenda & Feed (7 cols on lg, 8 on xl) */}
            <div className="col-span-12 lg:col-span-7 xl:col-span-8 space-y-4">
              <section className="bg-[#070D18]/70 border border-[#2563EB]/30 rounded-3xl p-5 space-y-4 shadow-lg shadow-[#2563EB]/5">
                {/* Feed Header with Filter Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2563EB]/20 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-[#CCFF00]" />
                    <h2 className="text-base font-bold uppercase tracking-wider text-white">
                      Reminders Agenda
                    </h2>
                    {selectedWeeklyDayTimestamp !== null && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2563EB]/30 text-[#CCFF00] border border-[#2563EB]/50 flex items-center gap-1.5">
                        <span>
                          Filtered: {new Date(selectedWeeklyDayTimestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <button
                          onClick={() => setSelectedWeeklyDayTimestamp(null)}
                          className="hover:text-white font-bold cursor-pointer"
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
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl capitalize transition shrink-0 cursor-pointer ${
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
                  <div className="glass-card p-12 text-center rounded-3xl text-slate-400 space-y-2.5">
                    <CheckCircle2 className="w-12 h-12 text-zinc-600 mx-auto" />
                    <div className="text-base font-semibold text-zinc-200">
                      No {reminderFilter} reminders scheduled
                    </div>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Click <strong>+ New Reminder</strong> or <strong>Speak Reminder</strong> above to add one.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                          <div className="flex items-start justify-between gap-4">
                            {/* Checkbox Complete */}
                            <button
                              type="button"
                              onClick={() => handleToggleReminderDone(reminder)}
                              className={`w-7 h-7 rounded-xl border mt-0.5 flex items-center justify-center transition shrink-0 cursor-pointer ${
                                isCompleted
                                  ? 'bg-[#CCFF00] border-[#CCFF00] text-[#03060B] font-black'
                                  : 'border-[#2563EB]/40 hover:border-[#CCFF00] bg-[#03060B]'
                              }`}
                              title={isCompleted ? 'Mark active' : 'Mark completed'}
                            >
                              {isCompleted && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                            </button>

                            {/* Reminder Content */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h3
                                  className={`text-sm font-bold ${
                                    isCompleted ? 'line-through text-slate-500' : 'text-white'
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
                                <p className="text-xs text-slate-300 leading-relaxed">
                                  {reminder.notes}
                                </p>
                              )}

                              {/* Timing and Relative Countdown */}
                              <div className="flex items-center gap-3 text-xs text-slate-400 font-medium pt-1">
                                <div className="flex items-center gap-1.5 text-slate-200">
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
                                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    {attachedVoice.isSaved ? 'Permanent' : '20d retention'}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Reminder Actions (Edit, Snooze 15m & Delete) */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditReminder(reminder)}
                                className="p-2 rounded-xl text-slate-400 hover:text-[#CCFF00] hover:bg-[#2563EB]/20 transition cursor-pointer"
                                title="Edit reminder date & time"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              {!isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => handleSnooze(reminder, 15)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                                  title="Snooze 15 minutes"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteReminder(reminder.id)}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
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
            </div>

            {/* Right Column: HUD Metrics, Weekly Matrix, Voice Notes & Vault (5 cols on lg, 4 on xl) */}
            <div className="col-span-12 lg:col-span-5 xl:col-span-4 space-y-6">
              {/* Metric HUD Cards */}
              <section className="grid grid-cols-3 gap-3">
                {/* 1. Today's Reminders */}
                <div className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#CCFF00]/50 p-3.5 rounded-3xl space-y-1 transition-all shadow-md shadow-[#2563EB]/10">
                  <div className="flex items-center justify-between text-[#93C5FD] text-[10px] font-semibold uppercase tracking-wider">
                    <span>Today</span>
                    <Bell className="w-3.5 h-3.5 text-[#CCFF00]" />
                  </div>
                  <div className="text-xl font-black text-[#CCFF00] font-mono">
                    {remindersTodayCount}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">Due 24h</div>
                </div>

                {/* 2. Voice Retention Window */}
                <div className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#2563EB]/60 p-3.5 rounded-3xl space-y-1 transition-all shadow-md shadow-[#2563EB]/10">
                  <div className="flex items-center justify-between text-[#93C5FD] text-[10px] font-semibold uppercase tracking-wider">
                    <span>Voice</span>
                    <Mic className="w-3.5 h-3.5 text-[#3B82F6]" />
                  </div>
                  <div className="text-xl font-black text-white font-mono">
                    {oldestUnsavedDaysLeft}d
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{unexpiredVoices.length} notes</div>
                </div>

                {/* 3. Library Vault Capacity */}
                <div
                  onClick={() => setIsVaultModalOpen(true)}
                  className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 hover:border-[#2563EB]/60 p-3.5 rounded-3xl cursor-pointer space-y-1 group transition-all shadow-md shadow-[#2563EB]/10"
                >
                  <div className="flex items-center justify-between text-[#93C5FD] text-[10px] font-semibold uppercase tracking-wider">
                    <span>Vault</span>
                    <FileText className="w-3.5 h-3.5 text-[#60A5FA] group-hover:text-[#CCFF00] transition" />
                  </div>
                  <div className="text-xl font-black text-white font-mono">
                    {vaultItems.length}
                  </div>
                  <div className="text-[10px] text-[#93C5FD] truncate font-mono">{totalVaultMB}MB</div>
                </div>
              </section>

              {/* Weekly Performance & Workload Matrix */}
              <WeeklyAnalysisCard
                reminders={reminders}
                voiceNotes={voiceNotes}
                vaultItems={vaultItems}
                selectedDayTimestamp={selectedWeeklyDayTimestamp}
                onSelectDay={setSelectedWeeklyDayTimestamp}
              />

              {/* PDF Vault Desktop Quick Panel */}
              <section className="bg-[#070D18]/90 border border-[#2563EB]/30 rounded-3xl p-5 space-y-3.5 shadow-md shadow-[#2563EB]/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#2563EB]/20 border border-[#2563EB]/40 text-[#60A5FA] flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Document Vault</h3>
                      <div className="text-[11px] text-slate-400">{vaultItems.length} files stored</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsVaultModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#2563EB]/25 hover:bg-[#2563EB] text-[#CCFF00] hover:text-white text-xs font-bold transition cursor-pointer border border-[#2563EB]/50"
                  >
                    Open Vault
                  </button>
                </div>

                {/* Storage Meter */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Indexed Storage</span>
                    <span className="text-[#CCFF00] font-bold">{totalVaultMB} MB / 50 MB</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-[#2563EB] to-[#CCFF00] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (totalVaultBytes / (50 * 1024 * 1024)) * 100)}%` }}
                    />
                  </div>
                </div>
              </section>

              {/* Voice Recordings Shelf */}
              {voiceNotes.length > 0 && (
                <section className="space-y-3 bg-[#070D18]/80 border border-[#2563EB]/30 rounded-3xl p-4 shadow-md shadow-[#2563EB]/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-[#3B82F6]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Voice Recordings ({voiceNotes.length})
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {config.retentionDays}d retention
                    </span>
                  </div>

                  <div className="space-y-2">
                    {voiceNotes.slice(0, 4).map((note) => {
                      const daysLeft = note.expiresAt
                        ? Math.max(0, Math.ceil((note.expiresAt - Date.now()) / (86400 * 1000)))
                        : null;

                      return (
                        <div
                          key={note.id}
                          className="bg-[#03060B] border border-[#2563EB]/20 p-2.5 rounded-2xl flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => playVoiceNoteAudio(note)}
                              className="w-7 h-7 rounded-lg bg-[#2563EB]/25 text-[#CCFF00] hover:bg-[#CCFF00] hover:text-[#03060B] flex items-center justify-center transition shrink-0 cursor-pointer"
                            >
                              {activePlayingVoiceId === note.id ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-200 truncate">
                                "{note.transcript}"
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                                <span>{note.durationSeconds}s</span>
                                <span>•</span>
                                <span className={note.isSaved ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                                  {note.isSaved ? 'Permanent' : `${daysLeft}d left`}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleSaveVoice(note.id)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                note.isSaved
                                  ? 'text-amber-400 bg-amber-500/15'
                                  : 'text-slate-400 hover:text-amber-400'
                              }`}
                              title={note.isSaved ? 'Un-save' : 'Save permanently'}
                            >
                              <Bookmark className="w-3.5 h-3.5 fill-current" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteVoice(note.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition cursor-pointer"
                              title="Delete voice note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        </main>
      )}

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
