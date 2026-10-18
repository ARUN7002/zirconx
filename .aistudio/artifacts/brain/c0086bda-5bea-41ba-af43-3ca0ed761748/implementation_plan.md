# Local-First Reminder & Library Vault System Architecture (MVP Specification)

## Title & Summary
**Chronicle Vault**: A zero-cloud, 100% offline local-first daily reminder engine and secure permanent document vault. It features manual and voice-to-reminder scheduling with natural language date/time parsing, local exact alarms/notifications, 20-day auto-pruning audio storage (with one-touch permanent preservation), a sandboxed 50 MB PDF Library Vault, and comprehensive device health diagnostics.

---

## 1. System Decomposition & State Machine

```
State Machine Progression:
[PARSED] ──> [PLANNED] ──> [PROTOTYPED] ──> [TESTED] ──> [VERDICT] ──> [LOCKED] ──> [EXTINCT]
```

### Maximum 5-Box Functional Flow
```
┌────────────────────────────────────────────────────────────────────────┐
│ [1. USER INPUT BOX]                                                    │
│  - Manual touch inputs (Title, Date, Time, Priority)                   │
│  - Voice Stream (Web Audio / MediaRecorder PCM/WebM stream)            │
│  - PDF File Import (< 50 MB binary payload)                            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ [2. LOCAL PROCESSING & TRANSLATION ENGINE]                             │
│  - Offline Speech-to-Text & Rule-based NLP Temporal Parser             │
│  - AM/PM Disambiguation & Confirmation Interceptor                     │
│  - PDF Metadata Validator & 50MB Size / Magic-Byte Inspector           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
            ┌──────────────────────┴──────────────────────┐
            ▼                                             ▼
┌───────────────────────────────┐     ┌──────────────────────────────────┐
│ [3. LOCAL STORAGE SUBSYSTEM]  │     │ [4. SCHEDULER & HEALTH ENGINE]   │
│  - IndexedDB (Relational/Meta)│     │  - Exact Alarm / Service Worker  │
│  - OPFS / IndexedDB Blobs     │     │  - Background Cleanup Cron Worker│
│    (Voice & PDF Vault)        │     │  - Subsystem Health Verifier     │
└───────────────┬───────────────┘     └───────────────────┬──────────────┘
                │                                         │
                └──────────────────────┬──────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ [5. AUDIBLE, VISUAL & VAULT OUTPUTS]                                   │
│  - Persistent Local Notification & Ring / Vibration                    │
│  - Rendered PDF Reader (Canvas / PDF.js sandboxed preview)             │
│  - Dashboard State: [Closed | Open | Active | Processing | Saved | Err]│
└────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ [FAILURE MODES INTERCEPTED]                                            │
│  - Mic / Notification permission denied -> Inline Health repair flows  │
│  - Over-50MB PDF upload -> Immediate byte-level rejection toast        │
│  - Ambiguous time ("Meet at 7") -> Modal AM/PM confirmation trigger    │
│  - App restart / process kill -> Cold-boot reconciliation loop         │
│  - Storage quota saturated -> Quota warning & space reclaim prompt     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## A. Product Summary
Chronicle Vault is an autonomous, privacy-preserving mobile utility designed for daily tasks and document security without external network dependencies. Users create reminders through direct tactile input or continuous hands-free voice dictation with zero recording interruption. Reminders dispatch deterministic, exact local notifications regardless of app foreground/background state. An integrated Library Vault holds vital documents (contracts, medical records, tickets) permanently up to 50 MB in PDF format, while audio recordings follow a strict 20-day lifecycle unless marked permanent.

---

## B. Core System Law
1. **Local-First Supremacy**: No packet leaves the device. All schemas, binary blobs, speech recognition, and scheduling logic execute on-device.
2. **Zero Inferred Ambiguity**: Never assume AM or PM when context is unresolved. Always prompt.
3. **Retention Invariance**:
   - `saved = false` audio lives exactly 20 days (1,728,000 seconds) from capture timestamp, then purges.
   - `saved = true` audio never expires.
   - Library PDFs never expire and are immune to background cleanup.
4. **Hard Size Limit**: Files $\ge$ 52,428,800 bytes (50 MB) are dropped at the input threshold with zero memory leakage.
5. **Fail-Visible Health**: System faults (denied alarms, disabled mic, missing audio codec, restricted storage) are actively diagnosed on the dashboard and Health Screen with one-tap recovery routes.

---

## C. System Architecture & Component Mapping

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────┐  │
│  │ Splash Screen │  │ Dashboard     │  │ Voice Capture │  │ PDF Vault│  │
│  │ (Blink Anim)  │  │ & Feed        │  │ Modal / Sheet │  │ Viewer   │  │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └────┬─────┘  │
└──────────┼──────────────────┼──────────────────┼───────────────┼────────┘
           │                  │                  │               │
┌──────────▼──────────────────▼──────────────────▼───────────────▼────────┐
│                        APPLICATION CONTROLLERS                          │
│  ┌───────────────────────┐  ┌────────────────────────────────────────┐  │
│  │ ReminderCoordinator   │  │ VoicePipelineManager                   │  │
│  │  - Draft validation   │  │  - MediaRecorder stream lock           │  │
│  │  - State machine      │  │  - Web Speech / Vosk offline STT       │  │
│  │  - Final preview      │  │  - Lexical temporal engine             │  │
│  └───────────┬───────────┘  └───────────────────┬────────────────────┘  │
│              │                                  │                       │
│  ┌───────────▼───────────┐  ┌───────────────────▼────────────────────┐  │
│  │ LibraryVaultManager   │  │ DiagnosticEngine                       │  │
│  │  - Byte-size check    │  │  - Permissions query                   │  │
│  │  - SHA-256 dedupe     │  │  - Storage quota & disk health         │  │
│  │  - Sandboxed viewer   │  │  - Notification subsystem probe        │  │
│  └───────────┬───────────┘  └───────────────────┬────────────────────┘  │
└──────────────┼──────────────────────────────────┼───────────────────────┘
               │                                  │
┌──────────────▼──────────────────────────────────▼───────────────────────┐
│                     PLATFORM ABSTRACTION & STORAGE                      │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Notification & Alarm Adapter                                      │  │
│  │  - Web Notification / Service Worker / Web Audio chime            │  │
│  │  - Native Capacitor LocalNotifications / AlarmManager boundary    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────┐         ┌───────────────────────────────┐  │
│  │ IndexedDB Database      │         │ File Storage (OPFS / Blobs)   │  │
│  │  - reminders store      │         │  - /vault_documents/*.pdf     │  │
│  │  - voice_notes store    │         │  - /voice_recordings/*.webm   │  │
│  │  - vault_items store    │         │  - Retention sweep thread     │  │
│  │  - system_config store  │         │                               │  │
│  └─────────────────────────┘         └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## D. Dashboard Layout

- **Header Region**: App title badge, Real-time Status Indicator (Green dot: All systems operational / Amber dot: Permissions degraded), and quick navigation to Settings & System Health.
- **Hero Metrics Bar**:
  - `Today's Reminders`: Count of pending reminders due within 24h.
  - `Voice Retention`: Count of unexpired audio notes (days until oldest expires).
  - `Library Vault`: Count and total size of secured PDFs (e.g., `4 files · 18.2 MB / 50 MB per file max`).
- **Primary Quick-Action Cards**:
  - `+ New Reminder` (Tactile form modal).
  - `Speak Reminder` (Full-screen non-interrupted voice studio).
  - `Library Vault` (Document browser & PDF import).
- **Active Agenda Timeline**: Chronological reminder cards with state indicators (`active`, `processing`, `saved`, `dismissed`). Quick actions to snooze (15m), complete, or edit.
- **Recent Voice Logs**: Audios with retention countdown badges (`19d remaining` or `Permanent (Saved)`), wave audio player, and transcript toggle.

---

## E. Screen List & Module States

1. **Splash Screen**: Brand watermark with minimal smooth pulse/blink animation; initiates cold-boot DB check, registers service worker, reconciles missed alarms.
2. **Dashboard Screen**: Main hub with operational summary, timeline, and quick-action triggers.
3. **Manual Reminder Screen / Drawer**: Title, notes, date picker, exact time selector, priority tags, sound toggle, final preview card, and save button.
4. **Voice Recording Studio**: Dedicated modal lock preventing gesture drops; live audio visualizer, real-time transcript streaming, AM/PM resolution dialog, and final preview.
5. **Library Vault Screen**: PDF grid/list, storage meter, file upload drag-and-drop zone with <50 MB validation, SHA-256 duplicate warning, and built-in PDF viewer.
6. **System Health Screen**: Visual telemetry matrix testing 6 subsystems (Notifications, Microphone, Speech Engine, Storage, Alarms, Background Worker) with `Run Full Diagnostic` button and repair actions.
7. **Settings Screen**: Voice retention duration (default 20 days), transcription language selector (English default), notification chime sound, dark/light theme, emergency export/backup, and purge controls.

### Finite States for Every Module
`CLOSED` $\rightarrow$ `OPEN` $\rightarrow$ `ACTIVE` $\rightarrow$ `PROCESSING` $\rightarrow$ `SAVED` $\leftrightarrow$ `ERROR`

---

## F. Step-by-Step Workflows

### Manual Reminder Workflow
1. User taps `+ New Reminder` on Dashboard (`OPEN`).
2. User enters title, optional notes, date, and time (`ACTIVE`).
3. User selects priority level and alarm ringtone preference.
4. System validates inputs: verifies date/time is in the future. If in the past, shows validation error (`ERROR`).
5. System displays **Final Preview Modal**: title, exact trigger timestamp, countdown string (`PROCESSING`).
6. User clicks `Confirm & Schedule`.
7. Controller writes record to IndexedDB `reminders` table and registers alarm with notification scheduler (`SAVED`).
8. Toast notification appears; modal closes (`CLOSED`).

### Voice Reminder Workflow
1. User taps `Speak Reminder` on Dashboard (`OPEN`).
2. System acquires microphone stream; initiates MediaRecorder and SpeechRecognition (`ACTIVE`). Screen lock flag activated to prevent accidental gesture dismissal.
3. User speaks: *"Remind me to submit the tax audit report tomorrow at 4"*.
4. Live transcript displays on-screen. User taps `Stop & Process` (`PROCESSING`).
5. Audio stream is buffered into a Blob. STT transcript is analyzed by Temporal Parser:
   - "tomorrow" $\rightarrow$ computes device local date + 1 day.
   - "at 4" $\rightarrow$ Ambiguous time detected! (Neither AM nor PM stated).
6. **AM/PM Disambiguation Dialog** interrupts:
   - *"Did you mean 4:00 AM or 4:00 PM?"*
   - Buttons: `4:00 AM (Early Morning)` | `4:00 PM (Afternoon)`.
7. User selects `4:00 PM`.
8. Final Confirmation Preview surfaces:
   - Title: *Submit the tax audit report*
   - Scheduled: *Tomorrow at 4:00 PM (16:00)*
   - Audio Attached: *0:08s (Saved to Voice Notes - 20 days retention)*
9. User reviews and taps `Schedule Reminder`.
10. System persists audio to blob store, saves metadata in IndexedDB, schedules notification, and renders card on Dashboard (`SAVED`).

### Voice Retention & Save Workflow
1. Audio recordings default to `is_saved: false` with `expires_at = created_at + (20 * 86400 * 1000)`.
2. UI displays badge: *"Expires in X days"*.
3. User can tap the Bookmark / Heart icon next to any voice recording at any time:
   - Flips `is_saved = true`, clears `expires_at = null`.
   - Badge updates to *"Permanent"*.
4. Cleanup engine skips all records where `is_saved == true`.

### Library Vault Workflow
1. User enters Library Vault (`OPEN`).
2. User taps `Import PDF` or drags a file into the upload dropzone (`ACTIVE`).
3. Client-side validator checks:
   - `file.size < 52428800` bytes (50 MB). If $\ge 50$ MB, aborts immediately with error banner: *"File exceeds maximum 50 MB limit"* (`ERROR`).
   - MIME type and first 4 magic bytes verify `%PDF-` header.
   - Computes SHA-256 hash. If hash matches existing vault item, warns user: *"Document already exists in Vault"*.
4. Valid PDF binary is stored in private OPFS / IndexedDB Blob storage (`PROCESSING`).
5. Document record written to `vault_items` table with title, page count, byte size, and timestamp (`SAVED`).
6. Document is permanently stored and will never auto-delete unless the user explicitly performs a double-confirmation delete action.

### System Health Diagnostic Workflow
1. User navigates to System Health (`OPEN`).
2. User taps `Run Diagnostic Probe` (`ACTIVE`).
3. Engine runs automated checks sequentially (`PROCESSING`):
   - Notification permission state (`granted` vs `denied` vs `default`).
   - MediaDevices microphone hardware and permission availability.
   - SpeechRecognition API availability (WebKitSpeechRecognition / offline engine).
   - StorageManager `navigator.storage.estimate()` (bytes used, bytes available, persistent storage granted).
   - Local alarm clock / Service Worker message channel test ping.
4. Each subsystem renders a status row: Green (Healthy), Amber (Degraded/Permission needed), Red (Fatal).
5. For any Amber or Red item, an inline action button is rendered (e.g. `Enable Notifications`, `Request Microphone Access`, `Request Persistent Storage`).

---

## G. Local Database Schema & Storage

### Schema Design (IndexedDB: Database `ChronicleVaultDB`, Version 1)

```sql
-- Logical representation of Object Stores:

-- Store: reminders
CREATE TABLE reminders (
    id TEXT PRIMARY KEY,               -- UUIDv4
    title TEXT NOT NULL,
    notes TEXT,
    due_timestamp INTEGER NOT NULL,    -- Epoch milliseconds in local device timezone
    created_at INTEGER NOT NULL,
    priority TEXT DEFAULT 'normal',    -- 'low' | 'normal' | 'high' | 'urgent'
    status TEXT DEFAULT 'active',      -- 'active' | 'completed' | 'snoozed' | 'missed'
    voice_note_id TEXT,                -- Foreign key to voice_notes.id (optional)
    sound_enabled BOOLEAN DEFAULT true,
    snooze_count INTEGER DEFAULT 0
);
CREATE INDEX idx_reminders_due ON reminders(due_timestamp, status);

-- Store: voice_notes
CREATE TABLE voice_notes (
    id TEXT PRIMARY KEY,               -- UUIDv4
    blob_key TEXT NOT NULL,            -- Storage identifier in OPFS / Blob store
    duration_seconds REAL NOT NULL,
    transcript TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,                -- Epoch ms: created_at + 20 days (null if is_saved == true)
    is_saved BOOLEAN DEFAULT false,    -- If true: never auto-deletes
    audio_format TEXT DEFAULT 'webm'   -- 'webm' | 'ogg' | 'wav'
);
CREATE INDEX idx_voice_expiry ON voice_notes(expires_at, is_saved);

-- Store: vault_items
CREATE TABLE vault_items (
    id TEXT PRIMARY KEY,               -- UUIDv4
    file_name TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,  -- Strict constraint < 52,428,800 bytes
    mime_type TEXT DEFAULT 'application/pdf',
    blob_key TEXT NOT NULL,            -- Key in OPFS / Blob store
    file_hash TEXT NOT NULL,           -- SHA-256 for integrity & deduplication
    page_count INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    is_permanent BOOLEAN DEFAULT true  -- Invariant: true, immune to cleanup
);
CREATE INDEX idx_vault_hash ON vault_items(file_hash);

-- Store: system_config
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value ANY NOT NULL
);
```

### Local File Storage Hierarchy (OPFS / Sandboxed App Storage)
```
/chronicle_vault_sandbox/
├── vault_documents/              <-- Permanent PDF Documents (< 50MB)
│   ├── doc_e4a8b1...pdf
│   └── doc_9c12f0...pdf
├── voice_recordings/             <-- Voice audio files
│   ├── audio_77180a...webm       <-- Ephemeral: expires in 20 days
│   └── audio_11b32d...webm       <-- Saved: permanent
└── temp/                         <-- Transient decoding buffers
```

---

## H. Notification & Alarm Scheduling Logic

1. **Precision Timing**: Reminders calculate absolute device Epoch milliseconds: `target_epoch = new Date(year, month, day, hours, minutes, 0).getTime()`.
2. **Platform Layer Support**:
   - Web / PWA: Uses Notification API backed by active Web Worker timers + Service Worker `showNotification` with vibration pattern `[200, 100, 200]`.
   - Native / Mobile Wrapper: Bridges to exact alarm manager (`Capacitor.Plugins.LocalNotifications` with `allowWhileIdle: true`).
3. **Reboot & Process Resurrection**:
   - On application startup or Service Worker wake:
     `SELECT * FROM reminders WHERE status = 'active' AND due_timestamp > now()`
   - Every active reminder is re-registered into the scheduler.
4. **Missed Reminders Handling**:
   - `SELECT * FROM reminders WHERE status = 'active' AND due_timestamp <= now()`
   - Flagged as `status = 'missed'`.
   - Generates an immediate silent digest notification: *"You missed X reminders while the device was off"*.

---

## I. Voice Transcription, Date Parsing, & Ambiguity Logic

### Speech Engine
- Uses Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) with fallback to local recording buffer.
- Language configuration: `recognition.lang = config.voice_language || 'en-US'`.
- Continuous streaming with silence detection. Screen touch events outside the record button are ignored to avoid interrupting recording.

### Deterministic Temporal NLP Parser
1. **Target Date Parsing**:
   - Keyword `"today"`: `targetDate = new Date()` (device local timezone).
   - Keyword `"tomorrow"`: `targetDate = new Date(); targetDate.setDate(targetDate.getDate() + 1)`.
   - Keyword `"in X days / hours / minutes"`: Relative math applied to `Date.now()`.
   - Day of week (e.g. `"Friday"`): Computes nearest upcoming Friday.
2. **Time Parsing & Ambiguity Detection**:
   - Explicit 24h or qualified time (e.g. `"4:30 PM"`, `"16:00"`, `"7 in the morning"`): Deterministic `hour = parsedHour`, `minute = parsedMinute`.
   - Ambiguous time (e.g. `"at 4"`, `"at 7:30"`, `"at 11"`):
     - Trigger Flag `isTimeAmbiguous = true`.
     - System pauses scheduling and opens **AM/PM Disambiguation Dialog**:
       *"Did you mean 4:00 AM or 4:00 PM?"*
     - If current time is past the morning slot, the afternoon slot is recommended.
3. **Final Preview Screen**:
   - Clean extracted title (temporal tokens stripped: e.g. "Buy groceries").
   - Explicit Date & Time formatted in user's locale.
   - Audio waveform review player.
   - User must press `Save Reminder` to lock into DB.

---

## J. Voice Auto-Delete & Retention Logic

1. When recorded: `expires_at = now + (retention_days * 86,400,000)`.
2. Every 12 hours (and on app launch), background cleanup job executes:
   ```typescript
   async function runVoiceCleanupJob() {
     const now = Date.now();
     const expiredNotes = await db.getAllFromIndex(
       'voice_notes',
       'idx_voice_expiry',
       IDBKeyRange.upperBound(now)
     );
     for (const note of expiredNotes) {
       if (note.is_saved !== true) {
         await storage.deleteFile(note.blob_key);
         await db.delete('voice_notes', note.id);
       }
     }
   }
   ```
3. If user toggles `Save Voice`:
   - `is_saved` set to `true`.
   - `expires_at` set to `null`.
   - File is exempt from all cleanup sweeps.

---

## K. Library Vault Permanence & 50 MB Invariant

1. **Size Guard**:
   ```typescript
   const MAX_BYTES = 50 * 1024 * 1024; // 52,428,800 bytes
   if (file.size >= MAX_BYTES) {
     throw new Error(`File size (${(file.size / (1024*1024)).toFixed(1)} MB) exceeds 50 MB limit.`);
   }
   ```
2. **Type Guard**: Inspects magic bytes `0x25, 0x50, 0x44, 0x46` (`%PDF`).
3. **Permanence**: `vault_items` table has no `expires_at` column.
4. **Cleanup Immunity**: The cleanup job never queries or accesses `vault_items` or `/vault_documents/`.
5. **Deletion**: Only manual user invocation through a two-step confirm modal deletes the blob from storage.

---

## L. System Health Diagnostics & Permission Recovery

| Subsystem | Check Routine | Success Condition | Error State & Action |
| :--- | :--- | :--- | :--- |
| **Notifications** | `Notification.permission` query | `'granted'` | Prompt user to allow notifications; fallback to in-app audio chimes. |
| **Microphone** | `navigator.mediaDevices.enumerateDevices()` | Audio input hardware present & authorized | Show guide to allow microphone in device browser settings. |
| **Speech Engine** | `'webkitSpeechRecognition' in window \|\| 'SpeechRecognition' in window` | API initialized | Inform user speech engine is available or fallback to typing. |
| **Storage Quota** | `navigator.storage.estimate()` | Free space > 100 MB & quota healthy | If low, warn user and offer cache purge. |
| **Exact Alarms** | Worker loop / Background timer test | Latency < 100ms | Request battery optimization bypass. |
| **Reminder Service**| Query `reminders` table count & past due integrity | DB readable & zero corrupted records | Run table rebuild & re-schedule all pending reminders. |

---

## M. Technology Stack Recommendation

- **UI Framework**: React 19 + TypeScript (Strict Mode)
- **Styling & Motion**: Tailwind CSS v4 + Framer Motion (fast, clean, dark-mode aware mobile layout with tactile haptic-style transitions)
- **Icons**: Lucide React
- **Local Database**: IndexedDB via native `idb` wrapper (asynchronous, reliable, structured queries, indexed by timestamps)
- **Local Binary Store**: Origin Private File System (OPFS) / IndexedDB Blob Store (100% private sandbox, no external exposure)
- **Speech Engine**: Web Speech API (`SpeechRecognition`) with offline fallback buffer
- **Local Audio**: HTML5 AudioContext with generated high-clarity notification frequencies (works offline without external audio assets)
- **PDF Viewer**: Embedded native canvas / PDF.js rendering pipeline for sandboxed offline preview

---

## N. Future Cloud Migration Boundary (Zero-Leakage Adapter)

```
┌──────────────────────────────────────────────────────────────────┐
│                   LOCAL CORE APPLICATION                         │
│   (UI Views, Business Logic, Temporal Parser, Health Engine)     │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                ISOLATED STORAGE & SYNC ADAPTER                   │
│  interface IStorageAdapter {                                     │
│    getReminders(): Promise<Reminder[]>;                          │
│    saveReminder(r: Reminder): Promise<void>;                     │
│    getVaultItem(id: string): Promise<Blob>;                      │
│    saveVaultItem(item: VaultItem, data: Blob): Promise<void>;    │
│  }                                                               │
└───────────────┬──────────────────────────────────┬───────────────┘
                │                                  │
    [CURRENT MVP IMPLEMENTATION]          [FUTURE OPTIONAL ADAPTER]
                │                                  │
                ▼                                  ▼
┌────────────────────────────────┐ ┌───────────────────────────────┐
│ LocalStorageAdapter            │ │ EncryptedCloudSyncAdapter     │
│  - IndexedDB (Data)            │ │  - End-to-End Encrypted Sync  │
│  - OPFS / Local Blobs (Files)  │ │  - Cloud Firestore / S3 Store │
│  - 100% Offline, Zero Cloud    │ │  - Opt-in Account Auth        │
└────────────────────────────────┘ └───────────────────────────────┘
```
The architecture strictly enforces that the application core interacts exclusively with `IStorageAdapter`. The MVP implementation is 100% `LocalStorageAdapter`. Adding a cloud provider in the future requires only plugging in an implementation of this interface without altering UI components, workflows, or parsing logic.

---

## O. Break List (Top 3 Real-World Failures & Mitigations)

### Break 1: Exact Notification Blocked or App Killed in Background
- **Failure**: OS battery saver kills web worker / timer, causing reminder to miss its exact trigger time.
- **Detection**: On app resume, Diagnostic Engine detects `due_timestamp < Date.now()` on an active reminder.
- **Fix**: Register Service Worker background sync / push event hooks; on cold boot, instantly trigger missed reminder chime with banner: *"Missed reminder while app was closed"*, and prompt user to allow background execution.

### Break 2: Speech Recognition Fails or Voice Is Noisy/Unclear
- **Failure**: STT engine returns empty transcript or confidence below 0.4.
- **Detection**: `recognition.onerror` or `event.results.length === 0`.
- **Fix**: Voice module seamlessly transitions into Manual Edit Mode with the audio recording still preserved, allowing the user to type the title while listening to their audio snippet.

### Break 3: Storage Quota Eviction Threat
- **Failure**: Browser attempts to clear unpersisted IndexedDB/OPFS data during low-disk situations.
- **Detection**: `navigator.storage.persisted()` returns `false`.
- **Fix**: Proactively call `navigator.storage.persist()` on first launch. System Health screen flags unpersisted storage and provides a one-tap button to lock storage from eviction.
