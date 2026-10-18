/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Calendar, Clock, Bell, AlertCircle, CheckCircle2, ChevronRight, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { PriorityLevel, Reminder } from '../types';

interface ManualReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Reminder) => Promise<void>;
}

export const ManualReminderModal: React.FC<ManualReminderModalProps> = ({ isOpen, onClose, onSave }) => {
  if (!isOpen) return null;

  // Form states
  const now = new Date();
  const defaultDate = new Date(now.getTime() + 60 * 60 * 1000);
  const defaultDateStr = defaultDate.toISOString().split('T')[0];
  const defaultTimeStr = `${String(defaultDate.getHours()).padStart(2, '0')}:${String(defaultDate.getMinutes()).padStart(2, '0')}`;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dateStr, setDateStr] = useState(defaultDateStr);
  const [timeStr, setTimeStr] = useState(defaultTimeStr);
  const [priority, setPriority] = useState<PriorityLevel>('normal');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Flow states
  const [showPreview, setShowPreview] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Compute target timestamp
  const calculateTargetTimestamp = (): number => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0).getTime();
  };

  const handleProceedToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter a reminder title.');
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
      const newReminder: Reminder = {
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

      await onSave(newReminder);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save reminder.');
      setIsSaving(false);
    }
  };

  const targetEpoch = calculateTargetTimestamp();
  const targetDateObj = new Date(targetEpoch);
  const formattedDate = targetDateObj.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = targetDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const diffMinutes = Math.max(0, Math.round((targetEpoch - Date.now()) / (60 * 1000)));
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMins = diffMinutes % 60;
  const countdownText =
    diffHours > 24
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
      <div className="w-full max-w-lg glass-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00F5A0]/15 border border-[#00F5A0]/30 flex items-center justify-center text-[#00F5A0]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                {showPreview ? 'Confirm Zircon Reminder' : 'New Zircon Reminder'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {showPreview ? 'Review scheduled local trigger' : 'Manual schedule entry'}
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

              {/* Date & Time Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#00F5A0]" />
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/70 dark:bg-zinc-950/80 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#00F5A0]/50 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#00F5A0]" />
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/70 dark:bg-zinc-950/80 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#00F5A0]/50 text-sm"
                  />
                </div>
              </div>

              {/* Priority Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'normal', 'high', 'urgent'] as PriorityLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setPriority(level)}
                      className={`py-2 px-1 text-xs font-semibold rounded-xl border capitalize transition text-center ${
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
                  className={`w-11 h-6 rounded-full p-1 transition-colors ${
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
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700 font-semibold text-sm transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="reminder-form"
                className="flex-1 py-3 px-4 rounded-2xl bg-[#00F5A0] hover:bg-[#00d68c] text-zinc-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#00F5A0]/20"
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
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700 font-semibold text-sm transition"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmSave}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#00F5A0] hover:bg-[#00d68c] text-zinc-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#00F5A0]/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Scheduling...' : 'Confirm & Schedule'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
