/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  Clock,
  Bell,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  Sparkles,
  Check,
} from 'lucide-react';
import { PriorityLevel, Reminder } from '../types';

interface ManualReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Reminder) => Promise<void>;
  reminderToEdit?: Reminder | null;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const ManualReminderModal: React.FC<ManualReminderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  reminderToEdit,
}) => {
  const isEditing = Boolean(reminderToEdit);

  // Form states
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('normal');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Date fields: Day (DD), Month (MM), Year (YYYY) - fully editable with mobile numeric keypad
  const [dayStr, setDayStr] = useState('');
  const [monthStr, setMonthStr] = useState('');
  const [yearStr, setYearStr] = useState('');

  // Time fields: 12-hour (1-12), Minute (00-59), and AM/PM bar
  const [hour12Str, setHour12Str] = useState('');
  const [minuteStr, setMinuteStr] = useState('');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');

  // Mini Calendar Popover State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarViewYear, setCalendarViewYear] = useState(new Date().getFullYear());
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date().getMonth());

  // Flow states
  const [showPreview, setShowPreview] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Input refs for intuitive auto-advancing on mobile keypad
  const monthInputRef = useRef<HTMLInputElement | null>(null);
  const yearInputRef = useRef<HTMLInputElement | null>(null);
  const minuteInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize state whenever opened or reminderToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    if (reminderToEdit) {
      const d = new Date(reminderToEdit.dueTimestamp);
      setTitle(reminderToEdit.title);
      setNotes(reminderToEdit.notes || '');

      const day = d.getDate();
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      setDayStr(String(day).padStart(2, '0'));
      setMonthStr(String(month).padStart(2, '0'));
      setYearStr(String(year));

      const rawHours = d.getHours();
      const isPm = rawHours >= 12;
      const h12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
      setAmpm(isPm ? 'PM' : 'AM');
      setHour12Str(String(h12).padStart(2, '0'));
      setMinuteStr(String(d.getMinutes()).padStart(2, '0'));

      setPriority(reminderToEdit.priority);
      setSoundEnabled(reminderToEdit.soundEnabled ?? true);
      setCalendarViewYear(year);
      setCalendarViewMonth(month - 1);
    } else {
      // Default: 1 hour in the future
      const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
      setTitle('');
      setNotes('');

      const day = defaultDate.getDate();
      const month = defaultDate.getMonth() + 1;
      const year = defaultDate.getFullYear();
      setDayStr(String(day).padStart(2, '0'));
      setMonthStr(String(month).padStart(2, '0'));
      setYearStr(String(year));

      const rawHours = defaultDate.getHours();
      const isPm = rawHours >= 12;
      const h12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
      setAmpm(isPm ? 'PM' : 'AM');
      setHour12Str(String(h12).padStart(2, '0'));
      setMinuteStr(String(defaultDate.getMinutes()).padStart(2, '0'));

      setPriority('normal');
      setSoundEnabled(true);
      setCalendarViewYear(year);
      setCalendarViewMonth(month - 1);
    }

    setShowPreview(false);
    setErrorMsg(null);
    setIsCalendarOpen(false);
  }, [isOpen, reminderToEdit]);

  // Keep hooks unconditional
  if (!isOpen) return null;

  // Compute target timestamp using device local calendar
  const calculateTargetTimestamp = (): number => {
    const d = parseInt(dayStr, 10);
    const m = parseInt(monthStr, 10);
    const y = parseInt(yearStr, 10);
    let h = parseInt(hour12Str, 10);
    const min = parseInt(minuteStr, 10);

    if (isNaN(d) || isNaN(m) || isNaN(y) || isNaN(h) || isNaN(min)) {
      return NaN;
    }
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) {
      return NaN;
    }
    const daysInMonth = new Date(y, m, 0).getDate();
    if (d > daysInMonth) {
      return NaN;
    }
    if (h < 1 || h > 12 || min < 0 || min > 59) {
      return NaN;
    }

    if (ampm === 'AM') {
      if (h === 12) h = 0;
    } else {
      if (h < 12) h += 12;
    }

    return new Date(y, m - 1, d, h, min, 0).getTime();
  };

  // Mobile Keypad Handlers with auto-advance
  const handleDayChange = (val: string) => {
    setErrorMsg(null);
    const digits = val.replace(/\D/g, '').slice(0, 2);
    setDayStr(digits);
    // If user typed 2 digits or a number >= 4, advance to month
    if (digits.length === 2 || (digits.length === 1 && parseInt(digits, 10) >= 4)) {
      monthInputRef.current?.focus();
    }
  };

  const handleMonthChange = (val: string) => {
    setErrorMsg(null);
    const digits = val.replace(/\D/g, '').slice(0, 2);
    setMonthStr(digits);
    // If user typed 2 digits or a number >= 2, advance to year
    if (digits.length === 2 || (digits.length === 1 && parseInt(digits, 10) >= 2)) {
      yearInputRef.current?.focus();
    }
  };

  const handleYearChange = (val: string) => {
    setErrorMsg(null);
    const digits = val.replace(/\D/g, '').slice(0, 4);
    setYearStr(digits);
    if (digits.length === 4) {
      setCalendarViewYear(parseInt(digits, 10));
    }
  };

  const handleHourChange = (val: string) => {
    setErrorMsg(null);
    const digits = val.replace(/\D/g, '').slice(0, 2);
    setHour12Str(digits);
    if (digits.length === 2 || (digits.length === 1 && parseInt(digits, 10) >= 2)) {
      minuteInputRef.current?.focus();
    }
  };

  const handleMinuteChange = (val: string) => {
    setErrorMsg(null);
    const digits = val.replace(/\D/g, '').slice(0, 2);
    setMinuteStr(digits);
  };

  // Mini Calendar Navigation
  const handlePrevMonth = () => {
    if (calendarViewMonth === 0) {
      setCalendarViewMonth(11);
      setCalendarViewYear((prev) => prev - 1);
    } else {
      setCalendarViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarViewMonth === 11) {
      setCalendarViewMonth(0);
      setCalendarViewYear((prev) => prev + 1);
    } else {
      setCalendarViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectCalendarDay = (day: number) => {
    setDayStr(String(day).padStart(2, '0'));
    setMonthStr(String(calendarViewMonth + 1).padStart(2, '0'));
    setYearStr(String(calendarViewYear));
    setIsCalendarOpen(false);
    setErrorMsg(null);
  };

  // Quick Date presets
  const applyDatePreset = (daysOffset: number) => {
    const d = new Date(Date.now() + daysOffset * 86400000);
    setDayStr(String(d.getDate()).padStart(2, '0'));
    setMonthStr(String(d.getMonth() + 1).padStart(2, '0'));
    setYearStr(String(d.getFullYear()));
    setCalendarViewYear(d.getFullYear());
    setCalendarViewMonth(d.getMonth());
    setErrorMsg(null);
  };

  // Quick Time presets
  const applyTimePreset = (h12: number, min: number, period: 'AM' | 'PM') => {
    setHour12Str(String(h12).padStart(2, '0'));
    setMinuteStr(String(min).padStart(2, '0'));
    setAmpm(period);
    setErrorMsg(null);
  };

  const applyRelativeMinutes = (mins: number) => {
    const d = new Date(Date.now() + mins * 60 * 1000);
    setDayStr(String(d.getDate()).padStart(2, '0'));
    setMonthStr(String(d.getMonth() + 1).padStart(2, '0'));
    setYearStr(String(d.getFullYear()));
    const rawHours = d.getHours();
    const isPm = rawHours >= 12;
    const h12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
    setAmpm(isPm ? 'PM' : 'AM');
    setHour12Str(String(h12).padStart(2, '0'));
    setMinuteStr(String(d.getMinutes()).padStart(2, '0'));
    setErrorMsg(null);
  };

  // Mini Calendar Matrix Calculations
  const firstDayOfMonthIndex = new Date(calendarViewYear, calendarViewMonth, 1).getDay();
  const totalDaysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
  const today = new Date();

  // Validate and Proceed to Preview
  const handleProceedToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter a reminder title.');
      return;
    }

    const d = parseInt(dayStr, 10);
    const m = parseInt(monthStr, 10);
    const y = parseInt(yearStr, 10);
    const h = parseInt(hour12Str, 10);
    const min = parseInt(minuteStr, 10);

    if (isNaN(d) || isNaN(m) || isNaN(y) || m < 1 || m > 12 || d < 1 || d > 31 || y < 2000) {
      setErrorMsg('Please enter a valid date (Day 01-31, Month 01-12, Year e.g. 2026).');
      return;
    }
    const daysInMonth = new Date(y, m, 0).getDate();
    if (d > daysInMonth) {
      setErrorMsg(`Invalid date: month ${m} only has ${daysInMonth} days.`);
      return;
    }

    if (isNaN(h) || isNaN(min) || h < 1 || h > 12 || min < 0 || min > 59) {
      setErrorMsg('Please enter a valid time (Hour 01-12, Minute 00-59).');
      return;
    }

    const targetTime = calculateTargetTimestamp();
    if (isNaN(targetTime)) {
      setErrorMsg('Please select a valid date and time.');
      return;
    }

    if (targetTime <= Date.now()) {
      setErrorMsg('Scheduled time must be in the future. Please pick an upcoming date or time.');
      return;
    }

    setShowPreview(true);
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    try {
      const targetTime = calculateTargetTimestamp();

      const reminderData: Reminder = reminderToEdit
        ? {
            ...reminderToEdit,
            title: title.trim(),
            notes: notes.trim() || undefined,
            dueTimestamp: targetTime,
            priority,
            status: 'active', // Reactivate when rescheduled
            soundEnabled,
          }
        : {
            id: 'rem_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
            title: title.trim(),
            notes: notes.trim() || undefined,
            dueTimestamp: targetTime,
            createdAt: Date.now(),
            priority,
            status: 'active',
            soundEnabled,
            snoozeCount: 0,
          };

      await onSave(reminderData);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save reminder.');
      setIsSaving(false);
    }
  };

  const targetEpoch = calculateTargetTimestamp();
  const isValidEpoch = !isNaN(targetEpoch);
  const targetDateObj = isValidEpoch ? new Date(targetEpoch) : new Date();
  const formattedDate = isValidEpoch
    ? targetDateObj.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Invalid Date';
  const formattedTime = isValidEpoch
    ? targetDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Invalid Time';

  const diffMinutes = isValidEpoch ? Math.max(0, Math.round((targetEpoch - Date.now()) / (60 * 1000))) : 0;
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMins = diffMinutes % 60;
  const countdownText = !isValidEpoch
    ? 'Select upcoming time'
    : diffHours > 24
    ? `in ${Math.floor(diffHours / 24)} days, ${diffHours % 24} hours`
    : diffHours > 0
    ? `in ${diffHours} hr ${remainingMins} min`
    : `in ${diffMinutes} minutes`;

  const priorityColors = {
    low: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    normal: 'bg-blue-950/80 text-blue-300 border-blue-800/80',
    high: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
    urgent: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00F5A0]/15 border border-[#00F5A0]/30 flex items-center justify-center text-[#00F5A0]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                {showPreview
                  ? isEditing
                    ? 'Confirm Updated Schedule'
                    : 'Confirm Zircon Reminder'
                  : isEditing
                  ? 'Edit Reminder Schedule'
                  : 'New Zircon Reminder'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {showPreview
                  ? 'Review scheduled local trigger'
                  : isEditing
                  ? 'Edit title, date, time, or priority'
                  : 'Manual schedule with mobile keypad'}
              </p>
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-2xl text-rose-200 text-xs leading-relaxed animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!showPreview ? (
            /* Input Form */
            <form id="reminder-form" onSubmit={handleProceedToPreview} className="space-y-4">
              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Reminder Title <span className="text-[#00F5A0] dark:text-[#00F5A0]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Submit quarterly tax documents..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-white/70 dark:bg-zinc-950/80 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#00F5A0]/50 transition text-sm"
                  autoFocus
                />
              </div>

              {/* Notes input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Notes / Details (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Add specific instructions, reference numbers..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/70 dark:bg-zinc-950/80 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#00F5A0]/50 transition text-sm resize-none"
                />
              </div>

              {/* DATE SECTION: Manual Mobile Keypad Input + Sidebar Mini Calendar Icon */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#00F5A0]" />
                    Date (Day - Month - Year)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                    className="text-[11px] font-bold text-emerald-700 dark:text-[#00F5A0] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>{isCalendarOpen ? 'Hide Calendar' : 'Open Mini Calendar'}</span>
                  </button>
                </div>

                {/* Date Input Bar with individual touchable number slots + mini calendar trigger */}
                <div className="flex items-center bg-white/70 dark:bg-zinc-950/80 border border-black/10 dark:border-white/10 rounded-2xl focus-within:ring-2 focus-within:ring-[#00F5A0]/50 transition overflow-hidden">
                  {/* Day (DD) - Tap directly to edit with mobile keypad */}
                  <div className="flex-1 flex flex-col items-center py-2 px-2 border-r border-black/5 dark:border-white/5">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500">Day</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      placeholder="DD"
                      value={dayStr}
                      onChange={(e) => handleDayChange(e.target.value)}
                      className="w-full text-center font-mono font-bold text-base text-slate-900 dark:text-zinc-100 bg-transparent focus:outline-none focus:text-[#00F5A0]"
                    />
                  </div>

                  {/* Month (MM) */}
                  <div className="flex-1 flex flex-col items-center py-2 px-2 border-r border-black/5 dark:border-white/5">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500">Month</span>
                    <input
                      ref={monthInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      placeholder="MM"
                      value={monthStr}
                      onChange={(e) => handleMonthChange(e.target.value)}
                      className="w-full text-center font-mono font-bold text-base text-slate-900 dark:text-zinc-100 bg-transparent focus:outline-none focus:text-[#00F5A0]"
                    />
                  </div>

                  {/* Year (YYYY) */}
                  <div className="flex-1.5 flex flex-col items-center py-2 px-2">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500">Year</span>
                    <input
                      ref={yearInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder="YYYY"
                      value={yearStr}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className="w-full text-center font-mono font-bold text-base text-slate-900 dark:text-zinc-100 bg-transparent focus:outline-none focus:text-[#00F5A0]"
                    />
                  </div>

                  {/* Mini Calendar Icon on Side Bar */}
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                    className={`px-4 py-4.5 border-l border-black/10 dark:border-white/10 flex items-center justify-center transition-all cursor-pointer ${
                      isCalendarOpen
                        ? 'bg-[#00F5A0] text-zinc-950 font-black shadow-inner'
                        : 'bg-slate-100 dark:bg-zinc-900/90 text-slate-600 dark:text-zinc-300 hover:text-[#00F5A0]'
                    }`}
                    title="Toggle interactive mini calendar picker"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold shrink-0">Quick:</span>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(0)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-[#00F5A0] border border-transparent transition text-[11px] font-medium shrink-0"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(1)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-[#00F5A0] border border-transparent transition text-[11px] font-medium shrink-0"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(7)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-[#00F5A0] border border-transparent transition text-[11px] font-medium shrink-0"
                  >
                    In 1 Week
                  </button>
                </div>

                {/* INTERACTIVE MINI CALENDAR POPUP */}
                {isCalendarOpen && (
                  <div className="p-4 bg-white/95 dark:bg-zinc-950/95 border border-[#00F5A0]/40 rounded-2xl shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                    {/* Month & Year Navigation Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 transition cursor-pointer"
                        title="Previous Month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <div className="text-center">
                        <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                          {MONTH_NAMES[calendarViewMonth]} {calendarViewYear}
                        </span>
                        <div className="text-[10px] text-emerald-600 dark:text-[#00F5A0] font-mono">
                          Touch date to select
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 transition cursor-pointer"
                        title="Next Month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {DAYS_OF_WEEK.map((w) => (
                        <span key={w} className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase">
                          {w}
                        </span>
                      ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {/* Leading empty slots */}
                      {Array.from({ length: firstDayOfMonthIndex }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-8" />
                      ))}

                      {/* Day Numbers */}
                      {Array.from({ length: totalDaysInMonth }, (_, i) => i + 1).map((day) => {
                        const isSelected =
                          parseInt(yearStr, 10) === calendarViewYear &&
                          parseInt(monthStr, 10) === calendarViewMonth + 1 &&
                          parseInt(dayStr, 10) === day;

                        const isCurrentDay =
                          today.getFullYear() === calendarViewYear &&
                          today.getMonth() === calendarViewMonth &&
                          today.getDate() === day;

                        return (
                          <button
                            key={`day-${day}`}
                            type="button"
                            onClick={() => handleSelectCalendarDay(day)}
                            className={`h-8 rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#00F5A0] text-zinc-950 font-black shadow-md scale-105'
                                : isCurrentDay
                                ? 'border border-[#00F5A0] text-[#00F5A0] hover:bg-[#00F5A0]/10'
                                : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>

                    {/* Bottom controls */}
                    <div className="pt-2 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setCalendarViewYear(today.getFullYear());
                          setCalendarViewMonth(today.getMonth());
                          handleSelectCalendarDay(today.getDate());
                        }}
                        className="text-[11px] font-semibold text-emerald-700 dark:text-[#00F5A0] hover:underline"
                      >
                        Select Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCalendarOpen(false)}
                        className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* TIME SECTION: 12-Hour Numeric Input with AM / PM Side Bar */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#00F5A0]" />
                  Time (12-Hour) & AM / PM Bar
                </label>

                <div className="flex items-center gap-2">
                  {/* Hours and Minutes Box with mobile numeric keypad support */}
                  <div className="flex-1 flex items-center bg-white/70 dark:bg-zinc-950/80 border border-black/10 dark:border-white/10 rounded-2xl focus-within:ring-2 focus-within:ring-[#00F5A0]/50 transition overflow-hidden">
                    {/* Hour (1-12) */}
                    <div className="flex-1 flex flex-col items-center py-2 px-2 border-r border-black/5 dark:border-white/5">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500">Hour</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        placeholder="09"
                        value={hour12Str}
                        onChange={(e) => handleHourChange(e.target.value)}
                        className="w-full text-center font-mono font-bold text-base text-slate-900 dark:text-zinc-100 bg-transparent focus:outline-none focus:text-[#00F5A0]"
                      />
                    </div>

                    <span className="text-slate-400 dark:text-zinc-600 font-bold text-lg select-none px-1">:</span>

                    {/* Minute (00-59) */}
                    <div className="flex-1 flex flex-col items-center py-2 px-2">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500">Minute</span>
                      <input
                        ref={minuteInputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        placeholder="00"
                        value={minuteStr}
                        onChange={(e) => handleMinuteChange(e.target.value)}
                        className="w-full text-center font-mono font-bold text-base text-slate-900 dark:text-zinc-100 bg-transparent focus:outline-none focus:text-[#00F5A0]"
                      />
                    </div>
                  </div>

                  {/* AM / PM Toggle Side Bar */}
                  <div className="flex p-1 bg-white/70 dark:bg-zinc-950/80 border border-black/10 dark:border-white/10 rounded-2xl select-none shrink-0 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setAmpm('AM')}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        ampm === 'AM'
                          ? 'bg-[#00F5A0] text-zinc-950 shadow-md ring-1 ring-[#00F5A0] scale-102'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmpm('PM')}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        ampm === 'PM'
                          ? 'bg-[#00F5A0] text-zinc-950 shadow-md ring-1 ring-[#00F5A0] scale-102'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>

                {/* Quick Time Shortcuts */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold shrink-0">Time:</span>
                  <button
                    type="button"
                    onClick={() => applyRelativeMinutes(15)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-[#00F5A0] border border-transparent transition text-[11px] font-medium shrink-0"
                  >
                    +15 min
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRelativeMinutes(60)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-[#00F5A0] border border-transparent transition text-[11px] font-medium shrink-0"
                  >
                    +1 hour
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTimePreset(9, 0, 'AM')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-[#00F5A0] border border-transparent transition text-[11px] font-medium shrink-0"
                  >
                    9:00 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTimePreset(2, 0, 'PM')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-[#00F5A0] border border-transparent transition text-[11px] font-medium shrink-0"
                  >
                    2:00 PM
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTimePreset(6, 0, 'PM')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-[#00F5A0] border border-transparent transition text-[11px] font-medium shrink-0"
                  >
                    6:00 PM
                  </button>
                </div>
              </div>

              {/* Priority Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Priority Level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'normal', 'high', 'urgent'] as PriorityLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setPriority(level)}
                      className={`py-2 px-1 text-xs font-semibold rounded-xl border capitalize transition text-center cursor-pointer ${
                        priority === level
                          ? priorityColors[level] + ' ring-1 ring-[#00F5A0]'
                          : 'bg-white/40 dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 border-black/5 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound and Alert Options */}
              <div className="flex items-center justify-between p-3.5 bg-white/50 dark:bg-zinc-950/70 border border-black/5 dark:border-white/10 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-[#00F5A0]" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-zinc-500" />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200">Audible Alarm Chime</div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">Play offline synthesized tone</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                    soundEnabled ? 'bg-[#00F5A0]' : 'bg-slate-300 dark:bg-zinc-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white dark:bg-zinc-950 transition-transform ${
                      soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Real-time Schedule Summary Banner */}
              <div className="p-3 bg-white/40 dark:bg-zinc-950/60 border border-[#00F5A0]/20 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                  <Clock className="w-3.5 h-3.5 text-[#00F5A0]" />
                  <span className="font-semibold">{formattedDate} at {formattedTime}</span>
                </div>
                <span className="font-mono text-[11px] text-emerald-700 dark:text-[#00F5A0] font-bold bg-[#00F5A0]/10 px-2 py-0.5 rounded">
                  {countdownText}
                </span>
              </div>
            </form>
          ) : (
            /* Final Preview Mode */
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 bg-white/60 dark:bg-zinc-950/80 border border-[#00F5A0]/40 rounded-2xl space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${priorityColors[priority]}`}>
                    {priority} priority
                  </span>
                  <span className="text-xs font-mono text-emerald-800 dark:text-[#00F5A0] font-semibold bg-[#00F5A0]/15 border border-[#00F5A0]/30 px-2 py-0.5 rounded-md">
                    {countdownText}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">{title}</h3>
                  {notes && <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">{notes}</p>}
                </div>

                <div className="pt-2 border-t border-black/5 dark:border-zinc-800/80 flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#00F5A0]" />
                    <span>{formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-[#00F5A0]">
                    <Clock className="w-4 h-4 text-[#00F5A0]" />
                    <span>{formattedTime}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-white/40 dark:bg-zinc-950/60 border border-black/5 dark:border-white/10 rounded-xl text-xs text-slate-600 dark:text-zinc-400">
                <Sparkles className="w-4 h-4 text-[#00F5A0] shrink-0" />
                <span>
                  Reminder will trigger deterministically on this device. No network required.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 dark:border-white/10 flex items-center gap-3">
          {!showPreview ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700 font-semibold text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="reminder-form"
                className="flex-1 py-3 px-4 rounded-2xl bg-[#00F5A0] hover:bg-[#00d68c] text-zinc-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#00F5A0]/20 cursor-pointer"
              >
                <span>Review Preview</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowPreview(false)}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700 font-semibold text-sm transition cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmSave}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#00F5A0] hover:bg-[#00d68c] text-zinc-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#00F5A0]/20 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSaving
                    ? isEditing
                      ? 'Updating...'
                      : 'Scheduling...'
                    : isEditing
                    ? 'Save Changes'
                    : 'Confirm & Schedule'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
