/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';

export type ReminderStatus = 'active' | 'completed' | 'snoozed' | 'missed';

export type ModuleState = 'closed' | 'open' | 'active' | 'processing' | 'saved' | 'error';

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  dueTimestamp: number; // Epoch milliseconds in device local timezone
  createdAt: number;
  priority: PriorityLevel;
  status: ReminderStatus;
  voiceNoteId?: string;
  soundEnabled: boolean;
  snoozeCount: number;
}

export interface VoiceNote {
  id: string;
  blobKey: string;
  durationSeconds: number;
  transcript: string;
  createdAt: number;
  expiresAt: number | null; // null if isSaved === true; otherwise createdAt + (retentionDays * 86400000)
  isSaved: boolean; // if true: permanent and immune to auto-cleanup
  audioFormat: string;
  audioDataUrl?: string; // base64 or blob url for playback
}

export interface VaultItem {
  id: string;
  fileName: string;
  fileSizeBytes: number; // Invariant: must be < 52,428,800 bytes (50 MB)
  mimeType: string; // 'application/pdf'
  blobKey: string;
  fileHash: string; // SHA-256
  createdAt: number;
  isPermanent: boolean; // Invariant: true, never auto-deleted
  dataUrl?: string; // base64 / blob URL for local viewing
}

export interface SystemConfig {
  retentionDays: number; // default: 20
  voiceLanguage: string; // default: 'en-US'
  notificationChime: 'bell' | 'alert' | 'gentle';
  autoCleanupIntervalHours: number; // default: 12
  lastCleanupTimestamp: number;
  theme: 'dark' | 'light' | 'system';
  voiceAnnouncementEnabled?: boolean; // Text-to-speech spoken reminder announcement
}

export interface SubsystemHealth {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: string;
  actionLabel?: string;
  actionId?: string;
}

export interface ParsedSpeechResult {
  rawTranscript: string;
  cleanedTitle: string;
  targetDate: Date;
  isTimeAmbiguous: boolean;
  ambiguousHour?: number;
  suggestedAmHour?: number;
  suggestedPmHour?: number;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  actionType?: 'reminder_created' | 'health_report' | 'vault_summary' | 'cleanup_report' | 'general';
  actionData?: any;
}

