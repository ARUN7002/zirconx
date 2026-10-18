/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Reminder } from '../types';
import { playChime } from './audioChime';
import { updateReminderStatus } from './db';

type NotificationCallback = (reminder: Reminder) => void;

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

  public scheduleReminder(reminder: Reminder, chimeType: 'bell' | 'alert' | 'gentle' = 'bell'): void {
    // Clear existing timer if any
    if (this.scheduledTimeouts.has(reminder.id)) {
      window.clearTimeout(this.scheduledTimeouts.get(reminder.id));
      this.scheduledTimeouts.delete(reminder.id);
    }

    if (reminder.status !== 'active') return;

    const now = Date.now();
    const delay = reminder.dueTimestamp - now;

    if (delay <= 0) {
      // Due right now or in the past
      return;
    }

    const timerId = window.setTimeout(async () => {
      this.triggerReminder(reminder, chimeType);
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

  public async triggerReminder(reminder: Reminder, chimeType: 'bell' | 'alert' | 'gentle' = 'bell'): Promise<void> {
    // 1. Play offline audio chime
    if (reminder.soundEnabled) {
      playChime(chimeType);
    }

    // 2. Trigger hardware vibration if supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 300]);
      } catch {
        // Ignore vibration errors if restricted
      }
    }

    // 3. Dispatch system notification if granted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(reminder.title, {
          body: reminder.notes || `Zircon reminder due now (${new Date(reminder.dueTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          icon: '/favicon.ico',
          tag: reminder.id,
          requireInteraction: true,
        });
      } catch (err) {
        console.warn('Could not display system notification:', err);
      }
    }

    // 4. Update status in database if appropriate
    await updateReminderStatus(reminder.id, 'active');

    // 5. Notify in-app UI listeners
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
      navigator.vibrate([150, 100, 150]);
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Zircon: System Test', {
        body: 'Diagnostics check passed! Local notification and audio chime are functional.',
      });
      return true;
    }
    return false;
  }
}

export const notificationManager = new NotificationManager();
