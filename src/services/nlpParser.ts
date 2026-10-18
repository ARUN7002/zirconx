/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedSpeechResult } from '../types';

/**
 * Deterministic Natural Language Date & Time Parser
 * Strictly adheres to device current date and timezone.
 * Detects ambiguous 12-hour spoken times and flags for AM/PM resolution.
 */
export function parseSpeechToReminder(transcript: string): ParsedSpeechResult {
  const normalized = transcript.toLowerCase().trim();
  const now = new Date();
  const targetDate = new Date(now.getTime());

  let isTimeAmbiguous = false;
  let ambiguousHour: number | undefined;
  let suggestedAmHour: number | undefined;
  let suggestedPmHour: number | undefined;

  let matchedDatePhrase = '';
  let matchedTimePhrase = '';

  // 1. DATE PARSING
  // Rule: "tomorrow" -> device current date + 1
  if (normalized.includes('tomorrow')) {
    targetDate.setDate(now.getDate() + 1);
    matchedDatePhrase = 'tomorrow';
  }
  // Rule: "today" -> device current date
  else if (normalized.includes('today')) {
    matchedDatePhrase = 'today';
  }
  // Rule: "in X days"
  else {
    const daysMatch = normalized.match(/in (\d+)\s+days?/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      targetDate.setDate(now.getDate() + days);
      matchedDatePhrase = daysMatch[0];
    } else {
      // Days of the week
      const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (let i = 0; i < weekdays.length; i++) {
        const day = weekdays[i];
        if (normalized.includes(day)) {
          const currentDay = now.getDay();
          let diff = i - currentDay;
          if (diff <= 0) diff += 7; // next occurrence
          targetDate.setDate(now.getDate() + diff);
          matchedDatePhrase = day;
          break;
        }
      }
    }
  }

  // 2. TIME PARSING & AMBIGUITY DETECTION
  // Check relative time: "in X minutes" or "in X hours"
  const relMinutesMatch = normalized.match(/in\s+(\d+)\s+min(?:ute)?s?/);
  const relHoursMatch = normalized.match(/in\s+(\d+)\s+hours?/);

  if (relMinutesMatch) {
    const minutes = parseInt(relMinutesMatch[1], 10);
    targetDate.setMinutes(now.getMinutes() + minutes);
    targetDate.setSeconds(0);
    matchedTimePhrase = relMinutesMatch[0];
  } else if (relHoursMatch) {
    const hours = parseInt(relHoursMatch[1], 10);
    targetDate.setHours(now.getHours() + hours);
    targetDate.setSeconds(0);
    matchedTimePhrase = relHoursMatch[0];
  } else {
    // Check for explicit qualified time: e.g. "at 4:30 pm", "at 8 am", "at 9 o'clock in the morning"
    const explicitTimeRegex = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i;
    const morningEveningRegex = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:o'clock)?\s+in\s+the\s+(morning|afternoon|evening|night)/i;
    const bareTimeRegex = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:o'clock)?\b/i;

    const explicitMatch = normalized.match(explicitTimeRegex);
    const morningEveningMatch = normalized.match(morningEveningRegex);

    if (explicitMatch) {
      let hour = parseInt(explicitMatch[1], 10);
      const minute = explicitMatch[2] ? parseInt(explicitMatch[2], 10) : 0;
      const meridiem = explicitMatch[3].toLowerCase().replace(/\./g, '');

      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;

      targetDate.setHours(hour, minute, 0, 0);
      matchedTimePhrase = explicitMatch[0];
    } else if (morningEveningMatch) {
      let hour = parseInt(morningEveningMatch[1], 10);
      const minute = morningEveningMatch[2] ? parseInt(morningEveningMatch[2], 10) : 0;
      const period = morningEveningMatch[3].toLowerCase();

      if ((period === 'afternoon' || period === 'evening' || period === 'night') && hour < 12) {
        hour += 12;
      }
      if (period === 'morning' && hour === 12) {
        hour = 0;
      }

      targetDate.setHours(hour, minute, 0, 0);
      matchedTimePhrase = morningEveningMatch[0];
    } else {
      // Look for ambiguous time: e.g. "at 4", "at 7:30", "at 10"
      // Search specifically after "at" or end of phrase
      const atMatch = normalized.match(/(?:at\s+)(\d{1,2})(?::(\d{2}))?/i);
      if (atMatch) {
        const rawHour = parseInt(atMatch[1], 10);
        const minute = atMatch[2] ? parseInt(atMatch[2], 10) : 0;

        if (rawHour >= 1 && rawHour <= 12) {
          isTimeAmbiguous = true;
          ambiguousHour = rawHour;
          suggestedAmHour = rawHour === 12 ? 0 : rawHour;
          suggestedPmHour = rawHour === 12 ? 12 : rawHour + 12;

          // Default tentative hour to PM if current hour is past the AM hour
          const defaultHour = now.getHours() >= rawHour ? suggestedPmHour : suggestedAmHour;
          targetDate.setHours(defaultHour, minute, 0, 0);
          matchedTimePhrase = atMatch[0];
        } else if (rawHour > 12 && rawHour <= 23) {
          // Military 24h time is not ambiguous
          targetDate.setHours(rawHour, minute, 0, 0);
          matchedTimePhrase = atMatch[0];
        }
      } else {
        // Fallback default if no time specified: 1 hour from now or 9:00 AM next morning
        if (matchedDatePhrase === 'tomorrow') {
          targetDate.setHours(9, 0, 0, 0);
        } else {
          targetDate.setHours(now.getHours() + 1, 0, 0, 0);
        }
      }
    }
  }

  // If resulting target is in the past, push to next day if applicable
  if (targetDate.getTime() <= now.getTime() && matchedDatePhrase !== 'tomorrow') {
    if (!matchedDatePhrase) {
      // If time like "at 9" was earlier today, set to tomorrow at 9
      targetDate.setDate(targetDate.getDate() + 1);
    }
  }

  // 3. TITLE CLEANING
  // Strip command phrases: "remind me to", "remind me", "please", "schedule", "create reminder"
  let cleanedTitle = transcript
    .replace(/^(?:please\s+)?(?:remind\s+me\s+to|remind\s+me|set\s+a\s+reminder\s+to|set\s+reminder\s+for|schedule\s+a\s+reminder\s+to|schedule|create\s+reminder)/i, '')
    .trim();

  // Strip temporal phrases detected
  if (matchedDatePhrase) {
    const dateReg = new RegExp(`\\b${matchedDatePhrase}\\b`, 'gi');
    cleanedTitle = cleanedTitle.replace(dateReg, '').trim();
  }
  if (matchedTimePhrase) {
    const timeReg = new RegExp(`\\b${matchedTimePhrase}\\b`, 'gi');
    cleanedTitle = cleanedTitle.replace(timeReg, '').trim();
  }

  // Strip dangling prepositions: "at", "for", "on", "by"
  cleanedTitle = cleanedTitle.replace(/\s+(?:at|for|on|by)$/i, '').trim();
  cleanedTitle = cleanedTitle.replace(/^(?:to|for|at)\s+/i, '').trim();

  // If cleaned title became empty, fallback to raw transcript
  if (!cleanedTitle || cleanedTitle.length < 2) {
    cleanedTitle = transcript.trim();
  }

  // Capitalize first character
  cleanedTitle = cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);

  return {
    rawTranscript: transcript,
    cleanedTitle,
    targetDate,
    isTimeAmbiguous,
    ambiguousHour,
    suggestedAmHour,
    suggestedPmHour,
    confidence: 0.95,
  };
}
