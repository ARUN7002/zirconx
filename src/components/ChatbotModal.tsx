/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Mic,
  MicOff,
  ChevronRight,
  Cpu,
  Download,
  AlertCircle,
  ChevronDown,
  Layers,
  Zap,
} from 'lucide-react';
import { ChatMessage, Reminder, VoiceNote, VaultItem } from '../types';
import { getAllChatMessages, saveChatMessage, clearChatHistory } from '../services/db';
import {
  generateLocalBotResponse,
  generateOpenSourceModelResponse,
  ChatContext,
} from '../services/localChatbotEngine';
import {
  webLLMService,
  AVAILABLE_OPENSOURCE_MODELS,
  WebLLMModelOption,
} from '../services/webLlmService';

interface ChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: Reminder[];
  voiceNotes: VoiceNote[];
  vaultItems: VaultItem[];
  retentionDays: number;
  onScheduleReminder: (reminder: Reminder) => Promise<void>;
  onOpenVault: () => void;
  onOpenHealth: () => void;
}

export const ChatbotModal: React.FC<ChatbotModalProps> = ({
  isOpen,
  onClose,
  reminders,
  voiceNotes,
  vaultItems,
  retentionDays,
  onScheduleReminder,
  onOpenVault,
  onOpenHealth,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Model Engine Selection: 'instant' or open-source model ID from AVAILABLE_OPENSOURCE_MODELS
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    return localStorage.getItem('zircon_llm_model') || 'instant';
  });
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelProgressText, setModelProgressText] = useState<string | null>(null);
  const [modelProgressPercent, setModelProgressPercent] = useState<number>(0);
  const [webGpuAvailable, setWebGpuAvailable] = useState<boolean>(true);

  // Streaming text placeholder during active WebLLM generation
  const [streamingText, setStreamingText] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Check WebGPU hardware and load chat history
  useEffect(() => {
    if (isOpen) {
      loadChatHistory();
      setWebGpuAvailable(webLLMService.checkWebGPUSupport());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, isTyping, streamingText]);

  if (!isOpen) return null;

  const loadChatHistory = async () => {
    const history = await getAllChatMessages();
    setMessages(history);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectModel = async (modelId: string) => {
    setSelectedModelId(modelId);
    localStorage.setItem('zircon_llm_model', modelId);
    setIsModelSelectorOpen(false);

    if (modelId === 'instant') {
      return;
    }

    // Check if open-source model needs download / load
    if (!webLLMService.isLoaded(modelId)) {
      if (!webGpuAvailable) {
        alert(
          'WebGPU is not available in this browser. Falling back to the Instant On-Device Neural Engine.'
        );
        setSelectedModelId('instant');
        return;
      }

      setIsModelLoading(true);
      setModelProgressPercent(5);
      setModelProgressText('Initializing WebGPU engine & checking cache...');

      try {
        await webLLMService.getEngine(modelId, (report) => {
          setModelProgressText(report.text);
          const percent = Math.round(report.progress * 100);
          setModelProgressPercent(percent);
        });

        // Add notice to chat
        const loadedNotice: ChatMessage = {
          id: 'msg_model_loaded_' + Date.now(),
          sender: 'assistant',
          text: `⚡ **${modelId}** successfully loaded into in-browser WebGPU memory! Model weights are cached locally for offline inference.`,
          timestamp: Date.now(),
          actionType: 'general',
        };
        await saveChatMessage(loadedNotice);
        setMessages((prev) => [...prev, loadedNotice]);
      } catch (err) {
        console.error('Failed to load open-source model:', err);
        alert(
          `Could not load ${modelId}: ${
            err instanceof Error ? err.message : 'Unknown error'
          }. Reverting to Instant On-Device Engine.`
        );
        setSelectedModelId('instant');
      } finally {
        setIsModelLoading(false);
        setModelProgressText(null);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    setInputText('');

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    await saveChatMessage(userMsg);
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setStreamingText('');

    const context: ChatContext = {
      reminders,
      voiceNotes,
      vaultItems,
      retentionDays,
    };

    try {
      let finalBotText = '';
      let actionType: ChatMessage['actionType'] = 'general';
      let actionData: any = undefined;

      // 1. OPEN-SOURCE WEBLLM ENGINE INFERENCE
      if (selectedModelId !== 'instant' && webGpuAvailable) {
        // Ensure engine is loaded
        if (!webLLMService.isLoaded(selectedModelId)) {
          setIsModelLoading(true);
          await webLLMService.getEngine(selectedModelId, (report) => {
            setModelProgressText(report.text);
            setModelProgressPercent(Math.round(report.progress * 100));
          });
          setIsModelLoading(false);
          setModelProgressText(null);
        }

        const botRes = await generateOpenSourceModelResponse(
          text,
          context,
          messages,
          (delta) => {
            setStreamingText((prev) => prev + delta);
          }
        );

        finalBotText = botRes.text;
        actionType = botRes.actionType;
        actionData = botRes.actionData;
      } else {
        // 2. INSTANT ON-DEVICE NEURAL-RULE ENGINE (0 MB, fast, CPU/WASM safe)
        await new Promise((r) => setTimeout(r, 350));
        const botRes = await generateLocalBotResponse(text, context);
        finalBotText = botRes.text;
        actionType = botRes.actionType;
        actionData = botRes.actionData;
      }

      const botMsg: ChatMessage = {
        id: 'msg_bot_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        sender: 'assistant',
        text: finalBotText,
        timestamp: Date.now(),
        actionType,
        actionData,
      };

      await saveChatMessage(botMsg);
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Chatbot error:', err);
      // Fallback to instant engine if open-source model fails
      const fallback = await generateLocalBotResponse(text, context);
      const botMsg: ChatMessage = {
        id: 'msg_bot_' + Date.now().toString(36),
        sender: 'assistant',
        text: fallback.text,
        timestamp: Date.now(),
        actionType: fallback.actionType,
        actionData: fallback.actionData,
      };
      await saveChatMessage(botMsg);
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsTyping(false);
      setStreamingText('');
    }
  };

  const handleConfirmActionReminder = async (reminder: Reminder, msgId: string) => {
    try {
      await onScheduleReminder(reminder);

      const confirmMsg: ChatMessage = {
        id: 'msg_conf_' + Date.now(),
        sender: 'assistant',
        text: `🎯 Confirmed! **"${reminder.title}"** is now actively armed in your local notification schedule.`,
        timestamp: Date.now(),
      };
      await saveChatMessage(confirmMsg);
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearHistory = async () => {
    await clearChatHistory();
    setMessages([]);
    setShowClearConfirm(false);
  };

  const toggleSpeechInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? prev + ' ' + transcript : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (e) {
      console.warn(e);
      setIsListening(false);
    }
  };

  const quickPrompts = [
    'What are my reminders today?',
    'Remind me to call the accountant tomorrow at 3 PM',
    'What documents are in my vault?',
    'How does voice retention work?',
  ];

  const currentModelLabel =
    selectedModelId === 'instant'
      ? 'Instant Neural Engine (0 MB)'
      : AVAILABLE_OPENSOURCE_MODELS.find((m) => m.id === selectedModelId)?.name || selectedModelId;

  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
      return (
        <div key={lineIdx} className={line.startsWith('• ') || line.startsWith('- ') ? 'pl-2' : ''}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-bold text-slate-900 dark:text-zinc-100">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return (
                <em key={pIdx} className="italic text-slate-700 dark:text-zinc-300">
                  {part.slice(1, -1)}
                </em>
              );
            }
            return part;
          })}
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl glass-card rounded-3xl overflow-hidden flex flex-col h-[92vh] sm:h-[84vh] border border-white/10 dark:border-white/10 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl glow-action flex items-center justify-center text-[#00F5A0] shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Zircon AI Assistant</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00F5A0]/15 text-emerald-800 dark:text-[#00F5A0] border border-[#00F5A0]/30 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] pulse-dot" />
                  Local AI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                100% Offline · In-Browser Open-Source Model
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Model Switcher Bar */}
        <div className="px-5 py-2 bg-white/40 dark:bg-zinc-950/70 border-b border-white/10 dark:border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
            <Cpu className="w-3.5 h-3.5 text-[#00F5A0]" />
            <span className="font-semibold text-slate-800 dark:text-zinc-300">Model Engine:</span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
              className="px-2.5 py-1 rounded-xl bg-white/80 dark:bg-zinc-900 border border-black/10 dark:border-white/15 hover:border-[#00F5A0]/50 text-slate-800 dark:text-zinc-200 font-bold text-[11px] flex items-center gap-1.5 transition shadow-sm"
            >
              <Zap className="w-3 h-3 text-[#00F5A0]" />
              <span className="truncate max-w-[160px] sm:max-w-[200px]">{currentModelLabel}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {/* Model Selector Dropdown Menu */}
            {isModelSelectorOpen && (
              <div className="absolute right-0 top-8 z-50 w-72 glass-card rounded-2xl p-2.5 shadow-2xl border border-white/15 dark:border-white/15 space-y-1.5 animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-2 pb-1 border-b border-white/10">
                  Select Inference Engine
                </div>

                {/* Option: Instant Engine */}
                <button
                  type="button"
                  onClick={() => handleSelectModel('instant')}
                  className={`w-full p-2 rounded-xl text-left transition flex items-start gap-2 ${
                    selectedModelId === 'instant'
                      ? 'bg-[#00F5A0]/15 border border-[#00F5A0]/40 text-emerald-800 dark:text-[#00F5A0]'
                      : 'hover:bg-white/40 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-[#00F5A0] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs">Instant Neural Engine</div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                      Zero download (0 MB) · Instant response on any CPU/device
                    </div>
                  </div>
                </button>

                {/* Open-Source WebLLM Models */}
                {AVAILABLE_OPENSOURCE_MODELS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleSelectModel(model.id)}
                    className={`w-full p-2 rounded-xl text-left transition flex items-start gap-2 ${
                      selectedModelId === model.id
                        ? 'bg-[#00F5A0]/15 border border-[#00F5A0]/40 text-emerald-800 dark:text-[#00F5A0]'
                        : 'hover:bg-white/40 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <Download className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>{model.name}</span>
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-black/10 dark:bg-zinc-800 text-zinc-400">
                          {model.size}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                        {model.description}
                      </div>
                    </div>
                  </button>
                ))}

                <div className="text-[9px] text-slate-400 dark:text-zinc-500 px-2 pt-1 border-t border-white/10 font-mono">
                  {webGpuAvailable ? '✓ WebGPU Ready for in-browser weights' : '⚠ WebGPU not detected on this browser'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loading / Weights Download Progress Banner */}
        {isModelLoading && (
          <div className="px-5 py-3 bg-[#00F5A0]/10 border-b border-[#00F5A0]/25 space-y-1.5 animate-in slide-in-from-top-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-[#00F5A0] animate-bounce" />
                Loading Open-Source Model Weights into WebGPU...
              </span>
              <span className="font-mono font-bold text-emerald-800 dark:text-[#00F5A0]">
                {modelProgressPercent}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00F5A0] to-teal-400 transition-all duration-200"
                style={{ width: `${Math.max(5, modelProgressPercent)}%` }}
              />
            </div>
            {modelProgressText && (
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                {modelProgressText}
              </div>
            )}
          </div>
        )}

        {/* Clear History Confirm Banner */}
        {showClearConfirm && (
          <div className="px-5 py-2.5 bg-rose-500/15 border-b border-rose-500/30 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300 animate-in slide-in-from-top-1">
            <span>Clear all stored chat history from IndexedDB?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearHistory}
                className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold text-[11px]"
              >
                Clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2 py-1 text-slate-600 dark:text-zinc-400 hover:underline text-[11px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Chat Messages Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-slate-500 dark:text-zinc-400">
              <div className="w-14 h-14 rounded-2xl glow-action flex items-center justify-center text-[#00F5A0]">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                  How can I help you today?
                </h3>
                <p className="text-xs max-w-xs mx-auto">
                  Ask me about your daily schedule, schedule new reminders, or inspect your PDF vault.
                </p>
              </div>

              {/* Quick suggestions */}
              <div className="w-full max-w-sm space-y-1.5 pt-2 text-left">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(prompt)}
                    className="w-full p-2.5 rounded-xl bg-white/50 dark:bg-zinc-950/60 border border-black/5 dark:border-white/10 hover:border-[#00F5A0]/40 text-xs text-slate-700 dark:text-zinc-300 transition flex items-center justify-between group"
                  >
                    <span>"{prompt}"</span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#00F5A0] transition" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-1 ${
                      isUser
                        ? 'bg-[#00F5A0] text-zinc-950 font-bold'
                        : 'bg-white/70 dark:bg-zinc-800 border border-black/10 dark:border-white/10 text-[#00F5A0]'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`max-w-[85%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-[#00F5A0] text-zinc-950 font-medium rounded-tr-sm shadow-md shadow-[#00F5A0]/15'
                          : 'bg-white/60 dark:bg-zinc-900/90 border border-black/5 dark:border-white/10 text-slate-800 dark:text-zinc-200 rounded-tl-sm shadow-sm'
                      }`}
                    >
                      {renderFormattedContent(msg.text)}

                      {/* Interactive Action Widget: Reminder Created */}
                      {msg.actionType === 'reminder_created' && msg.actionData && (
                        <div className="mt-3 p-3 rounded-xl bg-white/70 dark:bg-zinc-950/80 border border-[#00F5A0]/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-slate-900 dark:text-zinc-100">
                              {msg.actionData.title}
                            </span>
                            <span className="text-[10px] font-mono text-[#00F5A0] font-semibold">
                              {new Date(msg.actionData.dueTimestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleConfirmActionReminder(msg.actionData, msg.id)}
                            className="w-full py-2 px-3 rounded-lg bg-[#00F5A0] hover:bg-[#00d68c] text-zinc-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm & Arm Alarm</span>
                          </button>
                        </div>
                      )}

                      {/* Quick shortcut if vault mentioned */}
                      {msg.actionType === 'vault_summary' && (
                        <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/10">
                          <button
                            type="button"
                            onClick={onOpenVault}
                            className="text-[11px] text-[#00F5A0] font-bold hover:underline flex items-center gap-1"
                          >
                            <span>Open Library Vault Browser</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Quick shortcut if health mentioned */}
                      {msg.actionType === 'health_report' && (
                        <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/10">
                          <button
                            type="button"
                            onClick={onOpenHealth}
                            className="text-[11px] text-[#00F5A0] font-bold hover:underline flex items-center gap-1"
                          >
                            <span>Open Diagnostics Probe Monitor</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div
                      className={`text-[10px] text-slate-400 dark:text-zinc-500 font-mono ${
                        isUser ? 'text-right' : 'text-left'
                      }`}
                    >
                      {timeStr}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Real-time Streaming Token Bubble */}
          {streamingText && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-1 bg-white/70 dark:bg-zinc-800 border border-black/10 dark:border-white/10 text-[#00F5A0]">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="max-w-[85%] p-3.5 rounded-2xl bg-white/60 dark:bg-zinc-900/90 border border-[#00F5A0]/30 text-slate-800 dark:text-zinc-200 text-xs leading-relaxed whitespace-pre-wrap">
                {renderFormattedContent(streamingText)}
                <span className="inline-block w-1.5 h-3 bg-[#00F5A0] ml-1 animate-pulse" />
              </div>
            </div>
          )}

          {/* Typing Indicator */}
          {isTyping && !streamingText && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 pl-9">
              <Bot className="w-3.5 h-3.5 text-[#00F5A0] animate-spin" />
              <span>
                {selectedModelId === 'instant'
                  ? 'Zircon Neural Engine thinking...'
                  : `Generating via ${currentModelLabel}...`}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 border-t border-white/10 dark:border-white/10 bg-white/40 dark:bg-zinc-950/60">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={toggleSpeechInput}
              className={`p-2.5 rounded-xl border transition ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                  : 'bg-white/60 dark:bg-zinc-900 border-black/10 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-[#00F5A0]'
              }`}
              title={isListening ? 'Listening... click to stop' : 'Speak to Zircon'}
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? 'Listening to speech...' : 'Ask Zircon or schedule a task...'}
              className="flex-1 px-4 py-2.5 bg-white/70 dark:bg-zinc-900/90 border border-black/10 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#00F5A0]/50 transition"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-[#00F5A0] hover:bg-[#00d68c] disabled:opacity-40 disabled:hover:bg-[#00F5A0] text-zinc-950 font-bold transition shadow-sm cursor-pointer"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5 px-1 font-mono">
            <span>Conversations saved to IndexedDB</span>
            <span className="text-emerald-700 dark:text-[#00F5A0] font-semibold">
              {selectedModelId === 'instant' ? '⚡ 0 MB Instant Engine' : '⚡ WebLLM Open-Source'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
