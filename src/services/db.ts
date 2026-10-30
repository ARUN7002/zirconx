/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Reminder, VoiceNote, VaultItem, SystemConfig, ChatMessage, AUTHORIZED_USERS, AuthorizedUserName } from '../types';

export { AUTHORIZED_USERS };
export type { AuthorizedUserName };

export function normalizeAuthorizedUser(input: string): AuthorizedUserName | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  const match = AUTHORIZED_USERS.find((u) => u.toLowerCase() === trimmed);
  return match || null;
}

const DB_VERSION = 2;

let currentActiveUser: AuthorizedUserName | null = null;
let currentDbName = '';
let dbInstance: IDBDatabase | null = null;

export function getActiveUser(): AuthorizedUserName | null {
  if (currentActiveUser) return currentActiveUser;
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem('zircon_active_user');
  if (saved) {
    const valid = normalizeAuthorizedUser(saved);
    if (valid) {
      currentActiveUser = valid;
      return valid;
    }
  }
  return null;
}

export function setActiveUser(user: AuthorizedUserName | null): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
  currentActiveUser = user;
  currentDbName = '';
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('zircon_active_user', user);
    } else {
      localStorage.removeItem('zircon_active_user');
    }
  }
}

export function getUserDatabaseName(userName: string | null): string {
  if (userName) {
    return `ZirconVault_${userName}`;
  }
  return 'ZirconVault_Guest';
}

export async function getDB(): Promise<IDBDatabase> {
  const activeUser = getActiveUser();
  const targetDbName = getUserDatabaseName(activeUser);

  if (dbInstance && currentDbName === targetDbName) {
    return dbInstance;
  }

  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(targetDbName, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Reminders Store
      if (!db.objectStoreNames.contains('reminders')) {
        const reminderStore = db.createObjectStore('reminders', { keyPath: 'id' });
        reminderStore.createIndex('dueTimestamp', 'dueTimestamp', { unique: false });
        reminderStore.createIndex('status', 'status', { unique: false });
        reminderStore.createIndex('priority', 'priority', { unique: false });
      }

      // 2. Voice Notes Store
      if (!db.objectStoreNames.contains('voice_notes')) {
        const voiceStore = db.createObjectStore('voice_notes', { keyPath: 'id' });
        voiceStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        voiceStore.createIndex('isSaved', 'isSaved', { unique: false });
      }

      // 3. Vault Items Store (Permanent PDFs < 50MB)
      if (!db.objectStoreNames.contains('vault_items')) {
        const vaultStore = db.createObjectStore('vault_items', { keyPath: 'id' });
        vaultStore.createIndex('fileHash', 'fileHash', { unique: false });
        vaultStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 4. System Config Store
      if (!db.objectStoreNames.contains('system_config')) {
        db.createObjectStore('system_config', { keyPath: 'key' });
      }

      // 5. Chat History Store
      if (!db.objectStoreNames.contains('chat_history')) {
        const chatStore = db.createObjectStore('chat_history', { keyPath: 'id' });
        chatStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = async (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      currentDbName = targetDbName;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// System Config defaults
const DEFAULT_CONFIG: SystemConfig = {
  retentionDays: 20,
  voiceLanguage: 'en-US',
  notificationChime: 'bell',
  autoCleanupIntervalHours: 12,
  lastCleanupTimestamp: 0,
  theme: 'dark',
};

export async function getSystemConfig(): Promise<SystemConfig> {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction('system_config', 'readonly');
    const store = tx.objectStore('system_config');
    const req = store.get('main_config');
    req.onsuccess = () => {
      if (req.result && req.result.value) {
        resolve({ ...DEFAULT_CONFIG, ...req.result.value });
      } else {
        resolve(DEFAULT_CONFIG);
      }
    };
    req.onerror = () => resolve(DEFAULT_CONFIG);
  });
}

export async function saveSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  const current = await getSystemConfig();
  const updated: SystemConfig = { ...current, ...config };
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('system_config', 'readwrite');
    const store = tx.objectStore('system_config');
    const req = store.put({ key: 'main_config', value: updated });
    req.onsuccess = () => resolve(updated);
    req.onerror = () => reject(req.error);
  });
}

// Reminders CRUD
export async function getAllReminders(): Promise<Reminder[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readonly');
    const store = tx.objectStore('reminders');
    const req = store.getAll();
    req.onsuccess = () => {
      const reminders = (req.result || []) as Reminder[];
      // Sort: active/snoozed first by dueTimestamp ascending, then completed/missed
      reminders.sort((a, b) => a.dueTimestamp - b.dueTimestamp);
      resolve(reminders);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveReminder(reminder: Reminder): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    const req = store.put(reminder);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteReminder(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updateReminderStatus(
  id: string,
  status: Reminder['status'],
  newDueTimestamp?: number
): Promise<Reminder | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result as Reminder | undefined;
      if (!item) {
        resolve(null);
        return;
      }
      item.status = status;
      if (newDueTimestamp) {
        item.dueTimestamp = newDueTimestamp;
        item.snoozeCount = (item.snoozeCount || 0) + 1;
      }
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve(item);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// Voice Notes CRUD
export async function getAllVoiceNotes(): Promise<VoiceNote[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('voice_notes', 'readonly');
    const store = tx.objectStore('voice_notes');
    const req = store.getAll();
    req.onsuccess = () => {
      const notes = (req.result || []) as VoiceNote[];
      notes.sort((a, b) => b.createdAt - a.createdAt);
      resolve(notes);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveVoiceNote(note: VoiceNote): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('voice_notes', 'readwrite');
    const store = tx.objectStore('voice_notes');
    const req = store.put(note);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function toggleSaveVoiceNote(id: string): Promise<VoiceNote | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('voice_notes', 'readwrite');
    const store = tx.objectStore('voice_notes');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const note = getReq.result as VoiceNote | undefined;
      if (!note) {
        resolve(null);
        return;
      }
      note.isSaved = !note.isSaved;
      if (note.isSaved) {
        note.expiresAt = null; // Saved voice notes NEVER expire!
      } else {
        // Unsaved gets 20 days default from now or creation
        note.expiresAt = Date.now() + 20 * 86400 * 1000;
      }
      const putReq = store.put(note);
      putReq.onsuccess = () => resolve(note);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteVoiceNote(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('voice_notes', 'readwrite');
    const store = tx.objectStore('voice_notes');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Vault Items (PDFs < 50MB) CRUD
export async function getAllVaultItems(): Promise<VaultItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault_items', 'readonly');
    const store = tx.objectStore('vault_items');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []) as VaultItem[];
      items.sort((a, b) => b.createdAt - a.createdAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveVaultItem(item: VaultItem): Promise<void> {
  const MAX_BYTES = 50 * 1024 * 1024; // 52,428,800 bytes
  if (item.fileSizeBytes >= MAX_BYTES) {
    throw new Error(`Vault rule violation: File size exceeds 50 MB limit.`);
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault_items', 'readwrite');
    const store = tx.objectStore('vault_items');
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVaultItem(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault_items', 'readwrite');
    const store = tx.objectStore('vault_items');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Boot Check & Reconciliation Loop
export async function reconcileMissedReminders(): Promise<{ missedCount: number; reconciledCount: number }> {
  const db = await getDB();
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    const req = store.getAll();

    req.onsuccess = () => {
      const reminders = (req.result || []) as Reminder[];
      let missedCount = 0;
      let reconciledCount = 0;

      for (const r of reminders) {
        if (r.status === 'active' || r.status === 'snoozed') {
          if (r.dueTimestamp <= now) {
            r.status = 'missed';
            store.put(r);
            missedCount++;
          } else {
            reconciledCount++;
          }
        }
      }

      resolve({ missedCount, reconciledCount });
    };

    req.onerror = () => reject(req.error);
  });
}

// Auto-cleanup sweep: Purges unsaved voice notes older than retention period (default 20 days)
// Invariant: NEVER touches vault_items or voice notes where isSaved === true.
export async function runAutoCleanupSweep(): Promise<{ purgedCount: number }> {
  const db = await getDB();
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('voice_notes', 'readwrite');
    const store = tx.objectStore('voice_notes');
    const req = store.getAll();

    req.onsuccess = () => {
      const notes = (req.result || []) as VoiceNote[];
      let purgedCount = 0;

      for (const note of notes) {
        if (!note.isSaved && note.expiresAt && note.expiresAt <= now) {
          store.delete(note.id);
          purgedCount++;
        }
      }

      // Update last cleanup timestamp
      saveSystemConfig({ lastCleanupTimestamp: now }).catch(console.error);

      resolve({ purgedCount });
    };

    req.onerror = () => reject(req.error);
  });
}

// SHA-256 Hash generator for duplicate file detection with graceful fallback
export async function computeFileHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback hash for environments without WebCrypto subtle
  const view = new Uint8Array(buffer);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < view.length; i++) {
    h1 = Math.imul(h1 ^ view[i], 2654435761);
    h2 = Math.imul(h2 ^ view[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0') + '_' + file.size;
}

// Storage persistence request
export async function ensureStoragePersistence(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist();
  }
  return false;
}

async function migrateFromLegacyDBIfPresent(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(false);
    const req = indexedDB.open('ChronicleVaultDB', 2);
    req.onerror = () => resolve(false);
    req.onsuccess = async () => {
      const legacyDb = req.result;
      if (!legacyDb.objectStoreNames.contains('reminders')) {
        legacyDb.close();
        return resolve(false);
      }
      try {
        const tx = legacyDb.transaction('reminders', 'readonly');
        const store = tx.objectStore('reminders');
        const getAllReq = store.getAll();
        getAllReq.onsuccess = async () => {
          const legacyReminders = getAllReq.result as Reminder[];
          legacyDb.close();
          if (legacyReminders && legacyReminders.length > 0) {
            for (const r of legacyReminders) {
              await saveReminder(r);
            }
            resolve(true);
          } else {
            resolve(false);
          }
        };
        getAllReq.onerror = () => {
          legacyDb.close();
          resolve(false);
        };
      } catch {
        legacyDb.close();
        resolve(false);
      }
    };
  });
}

// Initialize seed data if database is fresh for active user
export async function seedInitialDataIfEmpty(forUser?: string): Promise<void> {
  const user = forUser || getActiveUser() || 'Arun';
  const reminders = await getAllReminders();
  if (reminders.length > 0) return;

  // If user is Arun and legacy ChronicleVaultDB exists with data, migrate it!
  if (user === 'Arun') {
    try {
      const hasLegacy = await migrateFromLegacyDBIfPresent();
      if (hasLegacy) return;
    } catch {
      // Continue to fresh seed
    }
  }

  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const tomorrow = 24 * oneHour;

  const sampleReminders: Reminder[] = [
    {
      id: `seed-${user.toLowerCase()}-1`,
      title: 'Welcome to your private Zircon Vault',
      notes: 'Strict account isolation active. Reminders, voice notes, and PDF documents stored here are private to your identity and will never leak to another account.',
      dueTimestamp: now + 3 * oneHour,
      createdAt: now - 30 * 60 * 1000,
      priority: 'high',
      status: 'active',
      soundEnabled: true,
      snoozeCount: 0,
    },
    {
      id: `seed-${user.toLowerCase()}-2`,
      title: 'Review Private Document Vault & Alarm Diagnostics',
      notes: 'Test uploading a PDF document up to 50MB into Library Vault or schedule voice alarms.',
      dueTimestamp: now + 6 * oneHour,
      createdAt: now - 2 * oneHour,
      priority: 'urgent',
      status: 'active',
      soundEnabled: true,
      snoozeCount: 0,
    },
    {
      id: `seed-${user.toLowerCase()}-3`,
      title: 'Schedule personal reminder with mobile keypad',
      notes: 'Use the new mobile numeric date/time inputs and mini calendar to schedule upcoming tasks.',
      dueTimestamp: now + tomorrow + 2 * oneHour,
      createdAt: now - 4 * oneHour,
      priority: 'normal',
      status: 'active',
      soundEnabled: true,
      snoozeCount: 0,
    },
  ];

  for (const r of sampleReminders) {
    await saveReminder(r);
  }

  // Sample voice note with 20-day retention
  const sampleVoiceNote: VoiceNote = {
    id: `seed-voice-${user.toLowerCase()}-1`,
    blobKey: 'seed_audio_sample',
    durationSeconds: 7.4,
    transcript: `Remind me to check personal vault tasks tomorrow at 4 PM`,
    createdAt: now - 2 * 86400 * 1000,
    expiresAt: now + 18 * 86400 * 1000,
    isSaved: false,
    audioFormat: 'audio/webm',
  };
  await saveVoiceNote(sampleVoiceNote);

  // Initial welcome message in chat history
  const chatMessages = await getAllChatMessages();
  if (chatMessages.length === 0) {
    await saveChatMessage({
      id: `msg-welcome-${user.toLowerCase()}`,
      sender: 'assistant',
      text: '👋 Welcome to your personal on-device **Zircon AI Terminal**. All your scheduled alarms, voice memos, and PDF documents are strictly isolated on this device. No other user can access your data.\n\n• *\'What are my reminders today?\'*\n• *\'Remind me to review reports tomorrow at 3 PM\'*\n• *\'Check my vault documents\'*\n• *\'Check system health\'*',
      timestamp: Date.now() - 30000,
      actionType: 'general',
    });
  }
}

// Chat History CRUD
export async function getAllChatMessages(): Promise<ChatMessage[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chat_history', 'readonly');
    const store = tx.objectStore('chat_history');
    const req = store.getAll();
    req.onsuccess = () => {
      const messages = (req.result || []) as ChatMessage[];
      messages.sort((a, b) => a.timestamp - b.timestamp);
      resolve(messages);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveChatMessage(msg: ChatMessage): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chat_history', 'readwrite');
    const store = tx.objectStore('chat_history');
    const req = store.put(msg);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearChatHistory(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chat_history', 'readwrite');
    const store = tx.objectStore('chat_history');
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Complete Data Wipe and Terminal Shutdown
export async function factoryResetAndShutdown(): Promise<void> {
  return completeResetEraseAll();
}

// Complete Reset from New: Erase All Memory, Files, Databases, and Storage
export async function completeResetEraseAll(): Promise<void> {
  // 1. Close open DB connection
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
  currentDbName = '';
  currentActiveUser = null;

  // 2. Query all indexedDB databases if supported by browser
  const allDbNames = new Set<string>([
    'ChronicleVaultDB',
    'ZirconVault_Guest',
    ...AUTHORIZED_USERS.map((u) => `ZirconVault_${u}`),
  ]);

  if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
    try {
      const dbs = await indexedDB.databases();
      for (const d of dbs) {
        if (d.name) allDbNames.add(d.name);
      }
    } catch {
      // fallback to pre-defined set
    }
  }

  // Delete all detected databases
  for (const dbName of allDbNames) {
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    } catch {
      // ignore
    }
  }

  // 3. Purge Web Cache API (Cached voice blobs, service caches, etc.)
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    } catch {
      // ignore
    }
  }

  // 4. Purge all localStorage entries
  if (typeof window !== 'undefined') {
    try {
      localStorage.clear();
    } catch {
      localStorage.removeItem('zircon_active_user');
      localStorage.removeItem('zircon_theme');
      localStorage.removeItem('zircon_llm_model');
      localStorage.removeItem('zircon_health_access');
      for (const u of AUTHORIZED_USERS) {
        localStorage.removeItem(`zircon_theme_${u}`);
        localStorage.removeItem(`zircon_llm_model_${u}`);
      }
    }

    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  }
}

