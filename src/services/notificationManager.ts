/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Reminder } from '../types';
import { playChime, speakVoiceAnnouncement } from './audioChime';
import { updateReminderStatus } from './db';

type NotificationCallback = (reminder: Reminder) => void;

// 32-bit integer maximum safe delay for window.setTimeout (~24.85 days)
const MAX_SAFE_DELAY_MS = 2147483647;

class NotificationManager {
  private scheduledTimeouts: Map<string, number> = new Map();
  private listeners: Set<NotificationCallback> = new Set();

  public subscribe(cb: NotificationCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return await Notification.requestPermission();
  }

  public getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  public scheduleReminder(
    reminder: Reminder,
    chimeType: 'bell' | 'alert' | 'gentle' = 'bell',
    voiceAnnouncement = false
  ): void {
    // Clear existing timer if any
    this.cancelReminder(reminder.id);

    if (reminder.status !== 'active') return;

    const now = Date.now();
    const delay = reminder.dueTimestamp - now;

    if (delay <= 0) {
      // Due right now or in the past
      return;
    }

    // Guard against 32-bit integer overflow in setTimeout (> 24.8 days)
    if (delay > MAX_SAFE_DELAY_MS) {
      const interimTimerId = window.setTimeout(() => {
        this.scheduleReminder(reminder, chimeType, voiceAnnouncement);
      }, MAX_SAFE_DELAY_MS);
      this.scheduledTimeouts.set(reminder.id, interimTimerId);
      return;
    }

    const timerId = window.setTimeout(async () => {
      this.triggerReminder(reminder, chimeType, voiceAnnouncement);
      this.scheduledTimeouts.delete(reminder.id);
    }, delay);

    this.scheduledTimeouts.set(reminder.id, timerId);
  }

  public cancelReminder(reminderId: string): void {
    if (this.scheduledTimeouts.has(reminderId)) {
      window.clearTimeout(this.scheduledTimeouts.get(reminderId));
      this.scheduledTimeouts.delete(reminderId);
    }
  }

  public async triggerReminder(
    reminder: Reminder,
    chimeType: 'bell' | 'alert' | 'gentle' = 'bell',
    voiceAnnouncement = false
  ): Promise<void> {
    // 1. Play offline audio chime
    if (reminder.soundEnabled) {
      playChime(chimeType);
    }

    // 2. Optional spoken voice announcement (TTS)
    if (voiceAnnouncement) {
      speakVoiceAnnouncement(`Reminder: ${reminder.title}`);
    }

    // 3. Trigger hardware vibration if supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 300]);
      } catch {
        // Ignore vibration errors if restricted
      }
    }

    // 4. Dispatch system notification (supports Service Worker or Window Notification)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        let dispatchedViaSw = false;
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && 'showNotification' in reg) {
            await reg.showNotification(reminder.title, {
              body: reminder.notes || `Zircon reminder due now (${new Date(reminder.dueTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
              icon: '/favicon.ico',
              tag: reminder.id,
            });
            dispatchedViaSw = true;
          }
        }

        if (!dispatchedViaSw) {
          new Notification(reminder.title, {
            body: reminder.notes || `Zircon reminder due now (${new Date(reminder.dueTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
            icon: '/favicon.ico',
            tag: reminder.id,
            requireInteraction: true,
          });
        }
      } catch (err) {
        console.warn('Could not display system notification:', err);
      }
    }

    // 5. Update status in database
    await updateReminderStatus(reminder.id, 'active');

    // 6. Notify in-app UI listeners (triggers active toast modal)
    this.listeners.forEach((listener) => {
      try {
        listener(reminder);
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Diagnostic test trigger
  public triggerTestNotification(): boolean {
    playChime('bell');
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([150, 100, 150]);
      } catch {
        // ignore
      }
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Zircon: System Test', {
          body: 'Diagnostics check passed! Local notification and audio chime are functional.',
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const notificationManager = new NotificationManager();
