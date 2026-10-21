/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  X,
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Sun,
  Moon,
  Bookmark,
  Volume2,
} from 'lucide-react';
import { parseSpeechToReminder } from '../services/nlpParser';
import { ParsedSpeechResult, Reminder, VoiceNote } from '../types';

interface VoiceReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveVoiceReminder: (reminder: Reminder, voiceNote: VoiceNote) => Promise<void>;
  defaultLanguage?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: Array<Array<{ transcript: string; confidence: number }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export const VoiceReminderModal: React.FC<VoiceReminderModalProps> = ({
  isOpen,
  onClose,
  onSaveVoiceReminder,
  defaultLanguage = 'en-US',
}) => {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSpeechEngineSupported, setIsSpeechEngineSupported] = useState(true);

  // Audio stream & recorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  // Final audio artifact
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Parsing & Resolution states
  const [parseResult, setParseResult] = useState<ParsedSpeechResult | null>(null);
  const [showAmPmDialog, setShowAmPmDialog] = useState(false);
  const [showFinalPreview, setShowFinalPreview] = useState(false);
  const [finalTitle, setFinalTitle] = useState('');
  const [finalDate, setFinalDate] = useState<Date | null>(null);
  const [savePermanently, setSavePermanently] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startVoiceSession();
    }
    return () => {
      cleanupVoiceSession();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  if (!isOpen) return null;

  const startVoiceSession = async () => {
    setErrorMsg(null);
    setLiveTranscript('');
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is unsupported in this environment');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
    } catch (err: unknown) {
      console.error('Microphone error:', err);
      const errorObj = err as { name?: string; message?: string };
      if (errorObj?.name === 'NotAllowedError' || errorObj?.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone access was denied. Please allow microphone permissions in your browser or device settings.');
      } else if (errorObj?.name === 'NotFoundError' || errorObj?.name === 'DevicesNotFoundError') {
        setErrorMsg('No microphone input hardware was detected on your system.');
      } else {
        setErrorMsg(`Microphone error: ${errorObj?.message || 'Access unavailable'}. Please verify device permissions in System Health.`);
      }
      return;
    }

    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      setIsSpeechEngineSupported(true);
      try {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = defaultLanguage;

        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setLiveTranscript(currentTranscript);
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition warning:', e.error);
          if (e.error === 'not-allowed') {
            setErrorMsg('Speech recognition service permission denied by browser.');
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Could not launch speech recognition:', e);
      }
    } else {
      setIsSpeechEngineSupported(false);
    }
  };

  const stopVoiceSession = () => {
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    setTimeout(() => {
      processTranscription();
    }, 300);
  };

  const cleanupVoiceSession = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const processTranscription = () => {
    const textToParse = liveTranscript.trim() || 'Quick Reminder';
    const parsed = parseSpeechToReminder(textToParse);
    setParseResult(parsed);
    setFinalTitle(parsed.cleanedTitle);
    setFinalDate(parsed.targetDate);

    if (parsed.isTimeAmbiguous) {
      setShowAmPmDialog(true);
    } else {
      setShowFinalPreview(true);
    }
  };

  const resolveAmPm = (choice: 'AM' | 'PM') => {
    if (!parseResult || !finalDate) return;
    const resolvedDate = new Date(finalDate.getTime());
    let hour = parseResult.ambiguousHour || 12;

    if (choice === 'PM' && hour < 12) {
      hour += 12;
    } else if (choice === 'AM' && hour === 12) {
      hour = 0;
    }

    resolvedDate.setHours(hour, resolvedDate.getMinutes(), 0, 0);

    if (resolvedDate.getTime() <= Date.now()) {
      resolvedDate.setDate(resolvedDate.getDate() + 1);
    }

    setFinalDate(resolvedDate);
    setShowAmPmDialog(false);
    setShowFinalPreview(true);
  };

  const handleFinalSave = async () => {
    if (!finalDate || !finalTitle) return;
    setIsSubmitting(true);

    try {
      const now = Date.now();
      const voiceId = 'vrec_' + Math.random().toString(36).substring(2, 9);
      const reminderId = 'rem_' + Math.random().toString(36).substring(2, 9);

      let audioDataUrl = '';
      if (audioBlob) {
        audioDataUrl = await new Promise((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      }

      const voiceNote: VoiceNote = {
        id: voiceId,
        blobKey: voiceId,
        durationSeconds: recordingSeconds,
        transcript: liveTranscript || finalTitle,
        createdAt: now,
        expiresAt: savePermanently ? null : now + 20 * 86400 * 1000,
        isSaved: savePermanently,
        audioFormat: audioBlob?.type || 'audio/webm',
        audioDataUrl,
      };

      const reminder: Reminder = {
        id: reminderId,
        title: finalTitle,
        notes: `Voice dictation: "${liveTranscript || finalTitle}"`,
        dueTimestamp: finalDate.getTime(),
        createdAt: now,
        priority: 'high',
        status: 'active',
        voiceNoteId: voiceId,
        soundEnabled: true,
        snoozeCount: 0,
      };

      await onSaveVoiceReminder(reminder, voiceNote);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error scheduling voice reminder.');
      setIsSubmitting(false);
    }
  };

  const toggleAudioPlayback = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleAttemptClose = () => {
    if (isRecording) {
      stopVoiceSession();
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md glass-card rounded-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00F5A0] pulse-dot" />
            <h2 className="text-xs font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wider">
              {isRecording ? 'Zircon Listening...' : showFinalPreview ? 'Confirm Voice Reminder' : 'Zircon Voice Studio'}
            </h2>
          </div>
          <button
            onClick={handleAttemptClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ACTIVE RECORDING VIEW */}
          {isRecording && (
            <div className="flex flex-col items-center justify-center py-6 space-y-6 text-center select-none">
              {/* Animated pulsating microphone aura with Zircon glow */}
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-[#00F5A0]/10 border-2 border-[#00F5A0]/30 flex items-center justify-center pulse-dot" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-[#00F5A0]/20 border border-[#00F5A0]/50 flex items-center justify-center shadow-[0_0_25px_rgba(0,245,160,0.4)]">
                    <Mic className="w-9 h-9 text-[#00F5A0] animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Recording Duration Meter */}
              <div className="font-mono text-2xl font-black text-emerald-800 dark:text-[#00F5A0] tracking-wider">
                00:{String(recordingSeconds).padStart(2, '0')}
              </div>

              {/* Live Audio Visualizer Bars */}
              <div className="flex items-center gap-1.5 h-8">
                {[12, 24, 36, 18, 30, 42, 28, 16, 34, 20, 26, 40].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-[#00F5A0] rounded-full animate-pulse"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${(i * 0.1).toFixed(1)}s`,
                      animationDuration: '0.8s',
                    }}
                  />
                ))}
              </div>

              {/* Fallback Notice if Speech Recognition is unavailable */}
              {!isSpeechEngineSupported && (
                <div className="w-full p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-400 text-xs text-left">
                  ⚠️ Speech-to-text is not supported in this browser engine. Audio is being captured locally, and you can name the reminder on the next screen.
                </div>
              )}

              {/* Streaming Transcript */}
              <div className="w-full min-h-[72px] p-4 bg-white/50 dark:bg-zinc-950/70 border border-black/5 dark:border-white/10 rounded-2xl text-slate-700 dark:text-zinc-300 text-sm italic text-left">
                {liveTranscript ? (
                  <span>"{liveTranscript}"</span>
                ) : (
                  <span className="text-slate-400 dark:text-zinc-500 not-italic">
                    Say: "Remind me to submit the tax report tomorrow at 4" or "Call doctor today at 3:30"...
                  </span>
                )}
              </div>

              {/* Primary Stop Recording Button */}
              <button
                type="button"
                onClick={stopVoiceSession}
                className="w-full py-4 px-6 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-black text-sm tracking-wide uppercase transition shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Finish & Process</span>
              </button>
            </div>
          )}

          {/* AM / PM DISAMBIGUATION MODAL */}
          {showAmPmDialog && parseResult && (
            <div className="space-y-4 py-2 animate-in fade-in zoom-in-95">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Time Disambiguation Required</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                  You specified <strong className="text-amber-500 font-mono">at {parseResult.ambiguousHour}</strong>.
                  Did you mean morning or afternoon?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => resolveAmPm('AM')}
                  className="p-4 rounded-2xl bg-white/50 dark:bg-zinc-950/70 border border-black/10 dark:border-white/10 hover:border-amber-400/60 hover:bg-amber-500/5 transition text-left space-y-2 group"
                >
                  <Sun className="w-6 h-6 text-amber-500 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-zinc-100">{parseResult.ambiguousHour}:00 AM</div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">Early Morning</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => resolveAmPm('PM')}
                  className="p-4 rounded-2xl bg-white/50 dark:bg-zinc-950/70 border border-black/10 dark:border-white/10 hover:border-[#00F5A0]/60 hover:bg-[#00F5A0]/5 transition text-left space-y-2 group"
                >
                  <Moon className="w-6 h-6 text-[#00F5A0] group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-zinc-100">{parseResult.ambiguousHour}:00 PM</div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">Afternoon / Evening</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* FINAL PREVIEW BEFORE SAVING */}
          {showFinalPreview && finalDate && (
            <div className="space-y-4 animate-in fade-in zoom-in-95">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Extracted Reminder Title
                </label>
                <input
                  type="text"
                  value={finalTitle}
                  onChange={(e) => setFinalTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-white/70 dark:bg-zinc-950/80 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-zinc-100 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#00F5A0]/50"
                />
              </div>

              {/* Scheduled Date/Time Highlight Card */}
              <div className="p-4 bg-white/50 dark:bg-zinc-950/80 border border-[#00F5A0]/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                  <span className="font-mono text-emerald-800 dark:text-[#00F5A0] font-semibold">Deterministic Local Trigger</span>
                  <span className="px-2 py-0.5 rounded bg-[#00F5A0]/15 text-emerald-800 dark:text-[#00F5A0] font-bold text-[10px] border border-[#00F5A0]/30">
                    Exact Alarm
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-slate-800 dark:text-zinc-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#00F5A0]" />
                    <span className="font-semibold">
                      {finalDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Clock className="w-4 h-4 text-[#00F5A0]" />
                    <span className="font-bold text-emerald-800 dark:text-[#00F5A0]">
                      {finalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audio Playback Player */}
              {audioUrl && (
                <div className="flex items-center justify-between p-3.5 bg-white/50 dark:bg-zinc-950/70 border border-black/5 dark:border-white/10 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleAudioPlayback}
                      className="w-10 h-10 rounded-xl bg-[#00F5A0]/20 text-emerald-800 dark:text-[#00F5A0] hover:bg-[#00F5A0] hover:text-zinc-950 flex items-center justify-center transition"
                    >
                      {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-[#00F5A0]" />
                        Attached Voice Note
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {recordingSeconds}s duration · PCM / WebM
                      </div>
                    </div>
                  </div>

                  <audio
                    ref={audioPlayerRef}
                    src={audioUrl}
                    onEnded={() => setIsPlayingAudio(false)}
                    className="hidden"
                  />
                </div>
              )}

              {/* 20-Day Retention Invariant & Permanent Save Toggle */}
              <div className="p-3.5 bg-white/50 dark:bg-zinc-950/70 border border-black/5 dark:border-white/10 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bookmark className={`w-4 h-4 ${savePermanently ? 'text-amber-500' : 'text-slate-400 dark:text-zinc-400'}`} />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-zinc-200">
                        {savePermanently ? 'Save Permanently' : 'Standard 20-Day Retention'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {savePermanently
                          ? 'Immune to auto-cleanup. Never deleted.'
                          : 'Auto-pruned after 20 days unless bookmarked.'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSavePermanently(!savePermanently)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors ${
                      savePermanently ? 'bg-amber-500' : 'bg-slate-300 dark:bg-zinc-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white dark:bg-zinc-950 transition-transform ${
                        savePermanently ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {showFinalPreview && (
          <div className="p-4 border-t border-white/10 dark:border-white/10 flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setShowFinalPreview(false);
                startVoiceSession();
              }}
              className="py-3 px-4 rounded-2xl bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700 font-semibold text-sm transition"
            >
              Re-record
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleFinalSave}
              className="flex-1 py-3 px-4 rounded-2xl bg-[#00F5A0] hover:bg-[#00d68c] text-zinc-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#00F5A0]/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Persisting...' : 'Confirm & Schedule'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
