/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Reminder, VoiceNote, VaultItem, SystemConfig, ChatMessage } from '../types';

const DB_NAME = 'ChronicleVaultDB';
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

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

// Initialize seed data if database is fresh
export async function seedInitialDataIfEmpty(): Promise<void> {
  const reminders = await getAllReminders();
  if (reminders.length > 0) return;

  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const tomorrow = 24 * oneHour;

  const sampleReminders: Reminder[] = [
    {
      id: 'seed-1',
      title: 'Review Quarterly Tax Filing',
      notes: 'Check deduction forms and upload confirmation PDF into Library Vault',
      dueTimestamp: now + 3 * oneHour,
      createdAt: now - 30 * 60 * 1000,
      priority: 'high',
      status: 'active',
      soundEnabled: true,
      snoozeCount: 0,
    },
    {
      id: 'seed-2',
      title: 'Daily Medication & Hydration',
      notes: 'Take vitamins with dinner',
      dueTimestamp: now + 6 * oneHour,
      createdAt: now - 2 * oneHour,
      priority: 'urgent',
      status: 'active',
      soundEnabled: true,
      snoozeCount: 0,
    },
    {
      id: 'seed-3',
      title: 'Submit Vehicle Insurance Renewal',
      notes: 'Policy doc is securely backed up in the Library Vault',
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
    id: 'seed-voice-1',
    blobKey: 'seed_audio_sample',
    durationSeconds: 7.4,
    transcript: 'Remind me to submit the tax audit report tomorrow at 4 PM',
    createdAt: now - 2 * 86400 * 1000, // 2 days ago
    expiresAt: now + 18 * 86400 * 1000, // 18 days remaining
    isSaved: false,
    audioFormat: 'audio/webm',
  };
  await saveVoiceNote(sampleVoiceNote);

  // Sample permanent PDF in Library Vault (under 50 MB)
  const samplePdfContent = '%PDF-1.4 sample secure document content for local vault';
  const sampleBlob = new Blob([samplePdfContent], { type: 'application/pdf' });
  const sampleHash = await computeFileHash(sampleBlob);

  const sampleVaultItem: VaultItem = {
    id: 'seed-vault-1',
    fileName: 'vehicle_insurance_policy_2026.pdf',
    fileSizeBytes: 2480000, // ~2.48 MB (well under 50 MB)
    mimeType: 'application/pdf',
    blobKey: 'vault_sample_insurance',
    fileHash: sampleHash,
    createdAt: now - 86400 * 1000,
    isPermanent: true,
  };
  await saveVaultItem(sampleVaultItem);

  // Initial welcome message in chat history
  const chatMessages = await getAllChatMessages();
  if (chatMessages.length === 0) {
    await saveChatMessage({
      id: 'msg-welcome',
      sender: 'assistant',
      text: "👋 Welcome to **Zircon AI Assistant**! I am your 100% offline on-device companion. I can help you schedule reminders, search your 50MB PDF Library Vault, review system health, and answer questions without internet. Try typing:\n\n• *'What are my reminders today?'*\n• *'Remind me to call the accountant tomorrow at 3 PM'*\n• *'What documents are in my vault?'*\n• *'Check system health'*",
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

