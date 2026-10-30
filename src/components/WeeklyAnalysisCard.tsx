/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  Mic,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Filter,
  X,
} from 'lucide-react';
import { Reminder, VoiceNote, VaultItem } from '../types';

interface WeeklyAnalysisCardProps {
  reminders: Reminder[];
  voiceNotes: VoiceNote[];
  vaultItems: VaultItem[];
  selectedDayTimestamp: number | null;
  onSelectDay: (timestamp: number | null) => void;
}

interface DayData {
  dayName: string;
  dayShort: string;
  dateNumber: number;
  dateKey: string;
  timestamp: number;
  isToday: boolean;
  totalCount: number;
  completedCount: number;
  activeCount: number;
  urgentCount: number;
}

export const WeeklyAnalysisCard: React.FC<WeeklyAnalysisCardProps> = ({
  reminders,
  voiceNotes,
  vaultItems,
  selectedDayTimestamp,
  onSelectDay,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine current week range (Monday 00:00:00 to Sunday 23:59:59)
  const now = new Date();
  const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
  const distanceToMonday = (currentDay + 6) % 7; // days to subtract to get Monday

  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Build the 7 days of this week
  const weekDays: DayData[] = [];
  const dayNamesShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayNamesFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    d.setHours(0, 0, 0, 0);

    const nextD = new Date(d);
    nextD.setDate(d.getDate() + 1);

    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    // Find reminders falling on this date
    const dayReminders = reminders.filter(
      (r) => r.dueTimestamp >= d.getTime() && r.dueTimestamp < nextD.getTime()
    );

    const completed = dayReminders.filter((r) => r.status === 'completed').length;
    const active = dayReminders.filter((r) => r.status === 'active' || r.status === 'snoozed').length;
    const urgent = dayReminders.filter((r) => r.priority === 'urgent' || r.priority === 'high').length;

    weekDays.push({
      dayName: dayNamesFull[i],
      dayShort: dayNamesShort[i],
      dateNumber: d.getDate(),
      dateKey: d.toDateString(),
      timestamp: d.getTime(),
      isToday,
      totalCount: dayReminders.length,
      completedCount: completed,
      activeCount: active,
      urgentCount: urgent,
    });
  }

  // Week-wide aggregations
  const weekReminders = reminders.filter(
    (r) => r.dueTimestamp >= monday.getTime() && r.dueTimestamp <= sunday.getTime()
  );
  const weekTotal = weekReminders.length;
  const weekCompleted = weekReminders.filter((r) => r.status === 'completed').length;
  const weekActive = weekReminders.filter((r) => r.status === 'active' || r.status === 'snoozed').length;
  const weekUrgent = weekReminders.filter((r) => r.priority === 'urgent' || r.priority === 'high').length;
  const completionRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 100;

  // Voice notes recorded this week
  const weekVoices = voiceNotes.filter(
    (v) => v.createdAt >= monday.getTime() && v.createdAt <= sunday.getTime()
  );

  // Highest volume day for bar chart scaling
  const maxDayCount = Math.max(1, ...weekDays.map((d) => d.totalCount));

  // Date range formatted label
  const rangeLabel = `${monday.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${sunday.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  // Smart Insight Generator
  const generateInsight = () => {
    if (weekTotal === 0) {
      return 'No scheduled reminders for this calendar week yet. Tap Speak Reminder or New Reminder to plan your upcoming days.';
    }
    const busiestDay = weekDays.reduce((prev, curr) => (curr.totalCount > prev.totalCount ? curr : prev), weekDays[0]);
    if (weekCompleted === weekTotal) {
      return `Outstanding! 100% of this week's scheduled tasks (${weekCompleted}/${weekTotal}) are completed.`;
    }
    if (busiestDay.totalCount > 0) {
      return `Peak schedule density occurs on ${busiestDay.dayName} with ${busiestDay.totalCount} tasks (${busiestDay.activeCount} still active). ${weekUrgent} high-priority deadlines tracked this week.`;
    }
    return `${weekActive} active reminders pending across this week. Voice retention and PDF document storage operating normally.`;
  };

  return (
    <section className="bg-[#070D18]/90 border-2 border-[#2563EB]/30 rounded-3xl p-4 sm:p-5 shadow-[0_0_30px_rgba(37,99,235,0.15)] space-y-4 transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#2563EB]/20 border border-[#2563EB]/50 flex items-center justify-center text-[#CCFF00] shadow-md shadow-[#2563EB]/20">
            <BarChart3 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Weekly Analysis
              </h2>
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-full bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/40">
                Live Metrics
              </span>
            </div>
            <div className="text-[11px] text-[#93C5FD] font-medium flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3 h-3 text-[#2563EB]" />
              <span>{rangeLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedDayTimestamp !== null && (
            <button
              onClick={() => onSelectDay(null)}
              className="px-2.5 py-1 rounded-xl bg-[#2563EB]/20 hover:bg-[#2563EB]/40 border border-[#2563EB]/50 text-xs font-bold text-[#93C5FD] transition flex items-center gap-1 cursor-pointer"
              title="Clear day filter"
            >
              <X className="w-3 h-3 text-[#CCFF00]" />
              <span>Reset Day</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl bg-white/5 hover:bg-[#2563EB]/20 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
            title={isExpanded ? 'Collapse analysis' : 'Expand analysis'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Metric Score HUD Cards (Grid of 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Metric 1: Completion Efficiency */}
        <div className="p-3 bg-[#03060B]/80 border border-[#2563EB]/30 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Efficiency</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#CCFF00]" />
          </div>
          <div className="text-xl font-black text-[#CCFF00] font-mono">
            {completionRate}%
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {weekCompleted} of {weekTotal} tasks done
          </div>
        </div>

        {/* Metric 2: Weekly Active Volume */}
        <div className="p-3 bg-[#03060B]/80 border border-[#2563EB]/30 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Week Tasks</span>
            <Clock className="w-3.5 h-3.5 text-[#3B82F6]" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {weekTotal}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {weekActive} active pending
          </div>
        </div>

        {/* Metric 3: Urgent / High Priority Load */}
        <div className="p-3 bg-[#03060B]/80 border border-[#2563EB]/30 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>High Priority</span>
            <AlertCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
          </div>
          <div className="text-xl font-black text-[#F59E0B] font-mono">
            {weekUrgent}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            Urgent deadlines
          </div>
        </div>

        {/* Metric 4: Voice Notes This Week */}
        <div className="p-3 bg-[#03060B]/80 border border-[#2563EB]/30 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Voice Audio</span>
            <Mic className="w-3.5 h-3.5 text-[#CCFF00]" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {weekVoices.length}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            Recorded this week
          </div>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* 7-Day Interactive Visual Bar Chart */}
          <div className="p-3.5 bg-[#03060B]/80 border border-[#2563EB]/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#CCFF00]" />
                Day-by-Day Workload Distribution
              </span>
              <span className="text-[10px] text-[#93C5FD] font-normal">
                Click a day bar to isolate reminders
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-2">
              {weekDays.map((d) => {
                const isSelected =
                  selectedDayTimestamp !== null &&
                  Math.abs(selectedDayTimestamp - d.timestamp) < 43200000;
                const barHeightPercent = d.totalCount > 0 ? Math.max(22, Math.round((d.totalCount / maxDayCount) * 100)) : 10;

                return (
                  <button
                    key={d.dayShort}
                    onClick={() => onSelectDay(isSelected ? null : d.timestamp)}
                    className={`flex flex-col items-center justify-end p-2 rounded-xl transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-[#2563EB]/30 border-2 border-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                        : d.isToday
                        ? 'bg-[#2563EB]/15 border border-[#CCFF00]/60'
                        : 'bg-white/5 border border-white/5 hover:border-[#2563EB]/40 hover:bg-[#2563EB]/10'
                    }`}
                  >
                    {/* Count Pill */}
                    <div className="text-[11px] font-mono font-bold mb-1.5 text-white">
                      {d.totalCount > 0 ? (
                        <span className={d.activeCount > 0 ? 'text-[#CCFF00]' : 'text-slate-400'}>
                          {d.totalCount}
                        </span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </div>

                    {/* Bar Track & Fill */}
                    <div className="w-full h-16 sm:h-20 bg-zinc-900/80 rounded-lg flex flex-col justify-end p-0.5 overflow-hidden">
                      <div
                        className={`w-full rounded-md transition-all duration-300 ${
                          d.totalCount === 0
                            ? 'bg-zinc-800 h-1'
                            : d.completedCount === d.totalCount
                            ? 'bg-[#2563EB] shadow-sm'
                            : 'bg-gradient-to-t from-[#1D4ED8] via-[#2563EB] to-[#CCFF00] shadow-[0_0_10px_rgba(204,255,0,0.3)]'
                        }`}
                        style={{ height: `${barHeightPercent}%` }}
                      />
                    </div>

                    {/* Day Label */}
                    <div className="mt-2 text-center">
                      <div
                        className={`text-[11px] font-black uppercase ${
                          d.isToday ? 'text-[#CCFF00]' : 'text-slate-300'
                        }`}
                      >
                        {d.dayShort}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        {d.dateNumber}
                      </div>
                    </div>

                    {/* Today indicator badge */}
                    {d.isToday && (
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#CCFF00] pulse-dot" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Smart Weekly Analytics Summary & Insights */}
          <div className="p-3 bg-[#050B16] border border-[#2563EB]/30 rounded-2xl flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
            <Sparkles className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-white uppercase tracking-wider text-[10px] text-[#93C5FD] block">
                Zircon Smart Insight
              </span>
              <span>{generateInsight()}</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
