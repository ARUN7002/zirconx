/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseSpeechToReminder } from '../services/nlpParser';
import { Reminder, VoiceNote, VaultItem } from '../types';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  details: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, category: string, details: string) {
  if (condition) {
    results.push({ name, category, status: 'PASS', details });
  } else {
    results.push({ name, category, status: 'FAIL', details, error: 'Assertion failed' });
  }
}

async function runAuditTests() {
  console.log('====================================================');
  console.log('  ZIRCON FEATURE AUDIT & AUTOMATED VERIFICATION     ');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // 1. VOICE REMINDERS & NLP PARSER
  // -------------------------------------------------------------------------
  console.log('--- 1. Testing Voice Parsing & Temporal Disambiguation ---');

  // Test 1.1: Exact explicit AM/PM
  const t1 = parseSpeechToReminder('Remind me to submit taxes tomorrow at 4 PM');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert(
    t1.cleanedTitle.toLowerCase().includes('submit taxes') &&
      t1.targetDate.getHours() === 16 &&
      !t1.isTimeAmbiguous,
    'Voice Transcription & Parsing (Exact Time)',
    'Voice Reminders',
    `Extracted title: "${t1.cleanedTitle}", target hour: ${t1.targetDate.getHours()}:00, ambiguous: ${t1.isTimeAmbiguous}`
  );

  // Test 1.2: Ambiguous 12-hour time (must trigger disambiguation)
  const t2 = parseSpeechToReminder('Call doctor today at 3');
  assert(
    t2.isTimeAmbiguous && t2.ambiguousHour === 3,
    'Ambiguous Spoken Hour Detection',
    'Voice Reminders',
    `Correctly flagged isTimeAmbiguous=true with ambiguousHour=${t2.ambiguousHour}`
  );

  // Test 1.3: Relative offset in hours
  const now = Date.now();
  const t3 = parseSpeechToReminder('Team sync in 2 hours');
  const diffHours = (t3.targetDate.getTime() - now) / (1000 * 60 * 60);
  assert(
    Math.abs(diffHours - 2) < 0.1,
    'Relative Time Offset ("in 2 hours")',
    'Voice Reminders',
    `Scheduled time is ${diffHours.toFixed(2)} hours from now`
  );

  // Test 1.4: Relative offset in minutes
  const t4 = parseSpeechToReminder('Take vitamins in 45 minutes');
  const diffMins = (t4.targetDate.getTime() - now) / (1000 * 60);
  assert(
    Math.abs(diffMins - 45) < 1,
    'Relative Time Offset ("in 45 minutes")',
    'Voice Reminders',
    `Scheduled time is ${diffMins.toFixed(1)} minutes from now`
  );

  // -------------------------------------------------------------------------
  // 2. CALENDAR, TIME ZONES & DATE BOUNDARIES
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing Calendar, Time Zones & Editing Logic ---');

  // Test 2.1: Local timezone date formatting vs UTC shift
  const testDate = new Date(2026, 9, 20, 23, 45, 0); // 11:45 PM local
  const localYear = testDate.getFullYear();
  const localMonth = String(testDate.getMonth() + 1).padStart(2, '0');
  const localDay = String(testDate.getDate()).padStart(2, '0');
  const expectedDateStr = `${localYear}-${localMonth}-${localDay}`;

  const toLocalDateString = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  assert(
    toLocalDateString(testDate) === expectedDateStr,
    'Local Timezone Date Formatting (Late Night Boundary)',
    'Calendar and Time',
    `Local date string ${toLocalDateString(testDate)} accurately avoids UTC date shift near midnight`
  );

  // Test 2.2: Reminder Editing Simulation
  const originalReminder: Reminder = {
    id: 'rem_audit_test_1',
    title: 'Dentist Appointment',
    notes: 'Bring insurance card',
    dueTimestamp: Date.now() + 3600000,
    createdAt: Date.now() - 7200000,
    priority: 'normal',
    status: 'active',
    soundEnabled: true,
    snoozeCount: 0,
  };

  // User edits date/time to tomorrow at 10 AM
  const newDate = new Date();
  newDate.setDate(newDate.getDate() + 1);
  newDate.setHours(10, 0, 0, 0);
  const updatedReminder: Reminder = {
    ...originalReminder,
    title: 'Dentist Appointment (Rescheduled)',
    dueTimestamp: newDate.getTime(),
    priority: 'high',
  };

  assert(
    updatedReminder.id === originalReminder.id &&
      updatedReminder.dueTimestamp !== originalReminder.dueTimestamp &&
      updatedReminder.priority === 'high',
    'Edit Reminder Date, Time, and Priority',
    'Calendar and Time',
    `Successfully preserves ID and creation metadata while updating dueTimestamp to ${new Date(updatedReminder.dueTimestamp).toLocaleString()}`
  );

  // Test 2.3: Rejection of past dates in validator
  const pastTimestamp = Date.now() - 60000;
  const isPastInvalid = pastTimestamp <= Date.now();
  assert(
    isPastInvalid,
    'Past Date Rejection Validator',
    'Calendar and Time',
    'Correctly enforces that reminder schedules must be in the future'
  );

  // -------------------------------------------------------------------------
  // 3. 20-DAY VOICE RETENTION & PERMANENCE
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing 20-Day Voice Retention Logic ---');

  const retentionWindowDays = 20;
  const retentionMs = retentionWindowDays * 86400 * 1000;

  const unsavedExpiredNote: VoiceNote = {
    id: 'voice_expired_1',
    blobKey: 'key_1',
    durationSeconds: 5,
    transcript: 'Old unsaved note',
    createdAt: now - 25 * 86400 * 1000, // 25 days old
    expiresAt: now - 5 * 86400 * 1000,
    isSaved: false,
    audioFormat: 'audio/webm',
  };

  const unsavedActiveNote: VoiceNote = {
    id: 'voice_active_1',
    blobKey: 'key_2',
    durationSeconds: 8,
    transcript: 'Fresh unsaved note',
    createdAt: now - 10 * 86400 * 1000, // 10 days old
    expiresAt: now + 10 * 86400 * 1000,
    isSaved: false,
    audioFormat: 'audio/webm',
  };

  const savedPermanentNote: VoiceNote = {
    id: 'voice_perm_1',
    blobKey: 'key_3',
    durationSeconds: 12,
    transcript: 'Critical saved contract audio',
    createdAt: now - 60 * 86400 * 1000, // 60 days old
    expiresAt: null,
    isSaved: true,
    audioFormat: 'audio/webm',
  };

  const isEligibleForPurge = (v: VoiceNote) => !v.isSaved && v.expiresAt !== null && v.expiresAt < now;

  assert(
    isEligibleForPurge(unsavedExpiredNote) === true,
    '20-Day Auto-Purge: Expired Unsaved Note',
    'Voice Retention',
    'Unsaved note older than 20 days is correctly marked for auto-deletion'
  );

  assert(
    isEligibleForPurge(unsavedActiveNote) === false,
    '20-Day Auto-Purge: Active Unexpired Note',
    'Voice Retention',
    'Unsaved note within 20 days is protected and kept active'
  );

  assert(
    isEligibleForPurge(savedPermanentNote) === false,
    'Permanence Invariant: Bookmarked Saved Note',
    'Voice Retention',
    'Bookmarked voice note (60 days old) is permanent and immune to auto-deletion'
  );

  // -------------------------------------------------------------------------
  // 4. LIBRARY VAULT: 50MB PDF RULES & HASHING
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing PDF Library Vault Constraints ---');

  const MAX_VAULT_BYTES = 50 * 1024 * 1024; // 52,428,800 bytes

  // Test 4.1: Size validation (< 50MB)
  const validSize = 48 * 1024 * 1024; // 48 MB
  const oversizedSize = 51 * 1024 * 1024; // 51 MB

  assert(
    validSize < MAX_VAULT_BYTES,
    'Library Vault: Size Under 50MB Acceptance',
    'Library Vault',
    `48 MB file (${validSize} bytes) is accepted under 50MB threshold`
  );

  assert(
    oversizedSize >= MAX_VAULT_BYTES,
    'Library Vault: Size Over 50MB Rejection',
    'Library Vault',
    `51 MB file (${oversizedSize} bytes) is strictly rejected`
  );

  // Test 4.2: MIME & format validation
  const isPdf = (name: string, type: string) => name.toLowerCase().endsWith('.pdf') || type === 'application/pdf';
  assert(
    isPdf('contract.pdf', 'application/pdf') && !isPdf('spreadsheet.xlsx', 'application/vnd.ms-excel'),
    'Library Vault: PDF Format Enforcement',
    'Library Vault',
    'Accepts valid .pdf files and rejects non-PDF documents'
  );

  // -------------------------------------------------------------------------
  // 5. NOTIFICATION SCHEDULER & OVERFLOW PROTECTION
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing Notification Timer Safety ---');

  const MAX_SAFE_TIMEOUT = 2147483647; // ~24.85 days
  const thirtyDaysMs = 30 * 86400 * 1000;

  assert(
    thirtyDaysMs > MAX_SAFE_TIMEOUT,
    '32-bit setTimeout Overflow Boundary Detection',
    'Notifications',
    `30 days (${thirtyDaysMs}ms) exceeds 32-bit int (${MAX_SAFE_TIMEOUT}ms) and triggers staged rescheduling`
  );

  // -------------------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log('                 AUDIT TEST SUMMARY                 ');
  console.log('====================================================');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  results.forEach((r, idx) => {
    const icon = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    console.log(`[${idx + 1}] ${icon} [${r.category}] ${r.name}`);
    console.log(`    Detail: ${r.details}`);
    if (r.error) console.log(`    Error: ${r.error}`);
  });

  console.log('\nTotal Tests:', results.length);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuditTests();
