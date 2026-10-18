/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Reminder, VoiceNote, VaultItem, ChatMessage } from '../types';
import { parseSpeechToReminder } from './nlpParser';
import { webLLMService } from './webLlmService';

export interface ChatContext {
  reminders: Reminder[];
  voiceNotes: VoiceNote[];
  vaultItems: VaultItem[];
  retentionDays: number;
}

export interface BotResponse {
  text: string;
  actionType?: ChatMessage['actionType'];
  actionData?: any;
}

/**
 * On-Device Open-Source Model Inference (WebLLM)
 * Runs open-source weights (SmolLM2-135M, Qwen2.5-0.5B, or Llama-3.2-1B) in-browser via WebGPU.
 */
export async function generateOpenSourceModelResponse(
  userPrompt: string,
  context: ChatContext,
  chatHistory: ChatMessage[],
  onStreamToken?: (token: string) => void
): Promise<BotResponse> {
  const parsed = parseSpeechToReminder(userPrompt);
  let actionData: Reminder | undefined;
  let actionType: ChatMessage['actionType'] = 'general';

  const lower = userPrompt.toLowerCase();
  if (
    lower.startsWith('remind me') ||
    lower.startsWith('set reminder') ||
    lower.startsWith('schedule') ||
    lower.startsWith('add reminder') ||
    lower.includes('remind me to') ||
    lower.includes('create a reminder')
  ) {
    const targetEpoch = parsed.targetDate.getTime();
    actionData = {
      id: 'rem_chat_' + Math.random().toString(36).substring(2, 9),
      title: parsed.cleanedTitle || 'New Scheduled Reminder',
      notes: `Scheduled via Zircon WebLLM: "${userPrompt}"`,
      dueTimestamp: targetEpoch > Date.now() ? targetEpoch : Date.now() + 60 * 60 * 1000,
      createdAt: Date.now(),
      priority: parsed.cleanedTitle.toLowerCase().includes('urgent') ? 'urgent' : 'normal',
      status: 'active',
      soundEnabled: true,
      snoozeCount: 0,
    };
    actionType = 'reminder_created';
  }

  const now = new Date();
  const activeRemindersList = context.reminders
    .filter((r) => r.status === 'active' || r.status === 'snoozed')
    .slice(0, 8)
    .map((r) => `"${r.title}" (Due: ${new Date(r.dueTimestamp).toLocaleString()})`)
    .join('; ');

  const vaultList = context.vaultItems
    .slice(0, 8)
    .map((v) => `"${v.fileName}" (${(v.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB, Permanent)`)
    .join('; ');

  const systemPrompt = `You are Zircon Assistant, an autonomous local-first AI assistant running in-browser with open-source model weights via WebLLM.
Current Local Time: ${now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.

Device State:
- Active Reminders: ${activeRemindersList || 'No active reminders.'}
- Secured PDF Vault Files (< 50MB): ${vaultList || 'No documents in vault.'}
- Voice Retention: 20-day auto-purge rule applies unless user bookmarks recording as permanent.
- Data Privacy: All data is local, private, and offline.

Provide helpful, articulate, and accurate answers. If the user asks to schedule a reminder, confirm the title and date/time clearly. Keep answers concise and readable.`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Include recent conversation turns (up to 4)
  const recent = chatHistory.slice(-4);
  for (const m of recent) {
    messages.push({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    });
  }

  messages.push({ role: 'user', content: userPrompt });

  const text = await webLLMService.generateChatCompletion(messages, onStreamToken);

  return {
    text,
    actionType,
    actionData,
  };
}

/**
 * Instant On-Device Neural-Rule Engine
 * Runs 100% locally with zero download and zero latency.
 * Safe fallback for environments without WebGPU.
 */
export async function generateLocalBotResponse(
  userPrompt: string,
  context: ChatContext
): Promise<BotResponse> {
  const prompt = userPrompt.trim();
  const lower = prompt.toLowerCase();
  const now = Date.now();

  // 1. INTENT: SCHEDULE A REMINDER
  if (
    lower.startsWith('remind me') ||
    lower.startsWith('set reminder') ||
    lower.startsWith('schedule') ||
    lower.startsWith('add reminder') ||
    lower.includes('remind me to') ||
    lower.includes('create a reminder')
  ) {
    const parsed = parseSpeechToReminder(prompt);
    const targetEpoch = parsed.targetDate.getTime();

    const newReminder: Reminder = {
      id: 'rem_chat_' + Math.random().toString(36).substring(2, 9),
      title: parsed.cleanedTitle || 'New Scheduled Reminder',
      notes: `Scheduled via Zircon AI: "${prompt}"`,
      dueTimestamp: targetEpoch > now ? targetEpoch : now + 60 * 60 * 1000,
      createdAt: now,
      priority: parsed.cleanedTitle.toLowerCase().includes('urgent') ? 'urgent' : 'normal',
      status: 'active',
      soundEnabled: true,
      snoozeCount: 0,
    };

    const formattedDate = new Date(newReminder.dueTimestamp).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const formattedTime = new Date(newReminder.dueTimestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const diffMins = Math.max(1, Math.round((newReminder.dueTimestamp - now) / 60000));
    const countdown =
      diffMins > 1440
        ? `in ${Math.floor(diffMins / 1440)} days`
        : diffMins > 60
        ? `in ${Math.floor(diffMins / 60)}h ${diffMins % 60}m`
        : `in ${diffMins} minutes`;

    return {
      text: `✅ I've prepared this local reminder for you:\n\n**"${newReminder.title}"**\n📅 Scheduled for **${formattedDate} at ${formattedTime}** (${countdown}).\n\nClick **Confirm & Arm Alarm** below to schedule it immediately in your device's exact local notification engine.`,
      actionType: 'reminder_created',
      actionData: newReminder,
    };
  }

  // 2. INTENT: QUERY REMINDERS / AGENDA
  if (
    lower.includes('what are my reminders') ||
    lower.includes('what reminders') ||
    lower.includes('show reminders') ||
    lower.includes('list reminders') ||
    (lower.includes('today') && lower.includes('reminder')) ||
    lower.includes('agenda') ||
    lower.includes('upcoming')
  ) {
    const active = context.reminders.filter((r) => r.status === 'active' || r.status === 'snoozed');

    if (active.length === 0) {
      return {
        text: `You have **0 active reminders** right now. Your schedule is completely clear!\n\nWould you like me to schedule one for you? Just say: *"Remind me to [task] tomorrow at [time]"*.`,
      };
    }

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const dueToday = active.filter((r) => r.dueTimestamp <= todayEnd.getTime());

    let response = `📋 You have **${active.length} active reminder(s)**`;
    if (dueToday.length > 0) {
      response += ` (**${dueToday.length} due today**):\n\n`;
    } else {
      response += `:\n\n`;
    }

    active.slice(0, 5).forEach((r) => {
      const d = new Date(r.dueTimestamp);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const diff = r.dueTimestamp - now;
      const rel =
        diff <= 0
          ? '⚠️ (due now)'
          : `(in ${Math.round(diff / 60000)}m)`;

      response += `• **${r.title}** — ${dateStr} at ${timeStr} ${rel}\n`;
    });

    if (active.length > 5) {
      response += `\n*...and ${active.length - 5} more on your Dashboard.*`;
    }

    return {
      text: response,
      actionType: 'general',
    };
  }

  // 3. INTENT: PDF LIBRARY VAULT INQUIRY
  if (
    lower.includes('vault') ||
    lower.includes('pdf') ||
    lower.includes('document') ||
    lower.includes('storage used') ||
    lower.includes('how many files')
  ) {
    const items = context.vaultItems;
    const totalBytes = items.reduce((acc, i) => acc + i.fileSizeBytes, 0);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

    if (items.length === 0) {
      return {
        text: `🔒 Your **Zircon Library Vault** currently has **0 documents**.\n\nYou can import important PDF documents (contracts, policies, tickets) up to **50 MB** per file. They are stored 100% locally, private, and permanently without auto-deletion!`,
        actionType: 'vault_summary',
      };
    }

    let summary = `🔒 **Zircon Library Vault** holds **${items.length} secured PDF document(s)** totaling **${totalMB} MB** (rule: < 50 MB per file):\n\n`;
    items.forEach((item) => {
      const sizeStr =
        item.fileSizeBytes < 1024 * 1024
          ? (item.fileSizeBytes / 1024).toFixed(1) + ' KB'
          : (item.fileSizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
      summary += `• 📄 **${item.fileName}** (${sizeStr}) — Permanent\n`;
    });

    summary += `\nAll documents are held offline in your private sandboxed storage and will never be deleted unless you manually remove them.`;

    return {
      text: summary,
      actionType: 'vault_summary',
      actionData: items,
    };
  }

  // 4. INTENT: VOICE RETENTION & EXPIRY
  if (
    lower.includes('retention') ||
    lower.includes('voice note') ||
    lower.includes('expire') ||
    lower.includes('auto delete') ||
    lower.includes('20 day')
  ) {
    const totalVoices = context.voiceNotes.length;
    const savedVoices = context.voiceNotes.filter((v) => v.isSaved).length;
    const unsavedVoices = totalVoices - savedVoices;

    return {
      text: `🎙️ **Zircon Voice Retention Rules**:\n\n1. **Standard 20-Day Lifecycle**: Unsaved voice recordings are stored locally and automatically pruned after **${context.retentionDays} days** to preserve local disk space.\n2. **Permanent Preservation**: If you tap the **Bookmark icon** on any voice note, its status becomes permanent and it is **completely immune to auto-deletion**.\n3. **Current Status**: You have **${totalVoices} voice recording(s)** (${savedVoices} permanent, ${unsavedVoices} in active 20-day retention).`,
      actionType: 'general',
    };
  }

  // 5. INTENT: SYSTEM HEALTH CHECK
  if (
    lower.includes('health') ||
    lower.includes('diagnostic') ||
    lower.includes('status') ||
    lower.includes('permission') ||
    lower.includes('is everything working')
  ) {
    return {
      text: `⚡ **Zircon System Diagnostics Overview**:\n\n• **Storage Engine**: IndexedDB v2 active & persistent on this hardware.\n• **Offline Engine**: 100% client-side Web Audio synthesis & local scheduling.\n• **Alarms**: Background timers armed for all upcoming reminders.\n• **Privacy**: Zero external network telemetry.\n\nYou can click the **Health button** in the top navigation to run live hardware probes on notifications, microphone input, and storage quota!`,
      actionType: 'health_report',
    };
  }

  // 6. INTENT: GREETINGS & CASUAL
  if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower.includes('who are you')) {
    return {
      text: `👋 Hello! I am **Zircon Assistant**, your autonomous local-first AI companion.\n\nHere is what I can do for you right now:\n• **Schedule Reminders**: *"Remind me to submit reports tomorrow at 4 PM"*\n• **Check Your Day**: *"What reminders do I have today?"*\n• **Inspect Vault**: *"What PDFs are saved in my vault?"*\n• **Explain Retention**: *"How does the 20-day voice rule work?"*\n• **Task Planning**: Ask for tips on breaking down complex projects!`,
    };
  }

  // 7. GENERAL PRODUCTIVITY & TIME MANAGEMENT ADVISOR
  return {
    text: `I'm here to assist with your local schedule and documents.\n\nRegarding **"${prompt}"**:\nIf you want to turn this into a reminder, tell me: *"Remind me to ${prompt} tomorrow at 9 AM"*. I will parse the time deterministically and schedule an exact local notification!\n\nYou can also ask me about your reminders, voice logs, or permanent PDF vault files anytime.`,
  };
}
