"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/lib/stores/useChatStore";
import { usePrivacyGuard } from "@/lib/hooks/usePrivacyGuard";
import { apiClient } from "@/lib/api/client";
import { STARTER_QUESTIONS } from "@/lib/api/mock/fixtures";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { 
  Paperclip, 
  Send, 
  X, 
  QrCode, 
  Globe, 
  Image as ImageIcon, 
  FileText, 
  ShieldAlert, 
  Sparkles, 
  AlertTriangle, 
  RotateCw,
  HelpCircle,
  Mic,
  Square,
  AlertOctagon
} from "lucide-react";
import { EvidenceType, EvidencePayload } from "@/types/evidence";
import { cn } from "@/lib/utils";

import { useSpeechToText } from "@/lib/speech/useSpeechToText";
import { useTextToSpeech } from "@/lib/speech/useTextToSpeech";
import { Check } from "lucide-react";

interface ComposerProps {
  onSendMessage: (question: string) => void;
  disabled?: boolean;
}

export function Composer({ onSendMessage, disabled }: ComposerProps) {
  const [inputText, setInputText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [detectedPastedText, setDetectedPastedText] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    status: sttStatus,
    interimTranscript,
    error: sttError,
    errorType: sttErrorType,
    isSupported: isSttSupported,
    startListening,
    stopListening,
    cancelListening,
    clearError: clearSttError
  } = useSpeechToText();

  const { stop: stopTts } = useTextToSpeech();

  const {
    activeEvidence,
    setActiveEvidence,
    uploadProgress,
    setUploadProgress,
    uploadError,
    setUploadError,
    isStreaming,
    openAlreadyPaidModal,
    prefilledQuestion,
    setPrefilledQuestion
  } = useChatStore();

  const { checkAndProceedWithUpload } = usePrivacyGuard();

  // Sync prefilled question if triggered from Already Paid flow
  useEffect(() => {
    if (prefilledQuestion) {
      setInputText(prefilledQuestion);
      setPrefilledQuestion(null);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
    }
  }, [prefilledQuestion, setPrefilledQuestion]);

  const handleStartVoice = () => {
    stopTts();
    startListening(
      inputText,
      (compositeText) => {
        setInputText(compositeText);
      },
      () => {
        stopTts();
      }
    );
  };

  // Resize textarea automatically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [inputText]);

  // Evidence type icon
  const getEvidenceIcon = (type?: EvidenceType) => {
    switch (type) {
      case "qr": return <QrCode className="h-4 w-4 text-emerald-400" />;
      case "url": return <Globe className="h-4 w-4 text-emerald-400" />;
      case "screenshot": return <ImageIcon className="h-4 w-4 text-emerald-400" />;
      case "message": return <FileText className="h-4 w-4 text-emerald-400" />;
      default: return <Paperclip className="h-4 w-4 text-emerald-400" />;
    }
  };

  const processFileUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size exceeds 10MB limit. Please upload a smaller image.");
      return;
    }

    setUploadError(null);
    setUploadProgress(10);

    try {
      const res = await apiClient.uploadEvidence(file, (pct) => setUploadProgress(pct));
      setActiveEvidence(res.evidence, res.extracted);
      setUploadProgress(null);
    } catch (err: any) {
      setUploadError(err?.message || "Extraction failed. Unreadable or corrupted image file.");
      setUploadProgress(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    checkAndProceedWithUpload(() => processFileUpload(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUrlDetection = async (url: string) => {
    setUploadError(null);
    setUploadProgress(25);
    try {
      const res = await apiClient.uploadUrl(url);
      setActiveEvidence(res.evidence, res.extracted);
      setUploadProgress(null);
    } catch (err: any) {
      setUploadError(err?.message || "Remote host unreachable or blocked.");
      setUploadProgress(null);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // 1. Check if an image file was pasted
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          checkAndProceedWithUpload(() => processFileUpload(file));
        }
        return;
      }
    }

    // 2. Check if a URL was pasted
    const text = e.clipboardData.getData("text").trim();
    if (/^https?:\/\/[^\s]+$/i.test(text)) {
      e.preventDefault();
      checkAndProceedWithUpload(() => handleUrlDetection(text));
      return;
    }

    // 3. Check if long text was pasted (>= 120 chars) and offer to attach as message evidence
    if (text.length >= 120 && !activeEvidence) {
      e.preventDefault();
      setDetectedPastedText(text);
      return;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.includes("image") || file.name.endsWith(".png") || file.name.endsWith(".jpg") || file.name.endsWith(".jpeg") || file.name.endsWith(".webp"))) {
      checkAndProceedWithUpload(() => processFileUpload(file));
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || disabled || isStreaming) return;
    const question = inputText.trim();
    setInputText("");
    onSendMessage(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Send button rule: If evidence is attached, question is required
      if (canSend) {
        handleSend();
      }
    }
  };

  const removeEvidence = () => {
    setActiveEvidence(null);
  };

  // Critical product rule:
  // If evidence is attached, send button is ONLY enabled once the user enters a question.
  // If no evidence is attached, user must also enter text to send.
  const hasQuestion = inputText.trim().length > 0;
  const canSend = hasQuestion && !isStreaming && !disabled;

  // Starter questions dynamic row based on attached evidence type
  const currentEvType = activeEvidence?.type || "message";
  const starters = activeEvidence ? (STARTER_QUESTIONS[currentEvType] || []) : [];

  return (
    <div className="relative w-full max-w-3xl mx-auto space-y-2">
      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-200 animate-in fade-in space-y-1.5">
          <div className="flex justify-between font-mono text-[11px]">
            <span>Analyzing & extracting evidence layers...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-mint transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Extraction Failure Banner with Retry */}
      {uploadError && (
        <div className="p-3.5 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setUploadError(null);
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-white font-medium"
            >
              <RotateCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => setUploadError(null)}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Voice Recognition Error Banner with Retry */}
      {sttError && (
        <div
          className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 animate-in fade-in"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <span className="leading-snug">{sttError}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {sttErrorType !== "unsupported" && (
              <button
                type="button"
                onClick={() => {
                  clearSttError();
                  handleStartVoice();
                }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-100 font-medium transition-colors"
                title="Retry voice input"
              >
                <RotateCw className="h-3 w-3" />
                <span>Retry</span>
              </button>
            )}
            <button
              type="button"
              onClick={clearSttError}
              className="p-1 text-zinc-400 hover:text-white"
              aria-label="Dismiss voice error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Long Text Paste Modal Prompt */}
      {detectedPastedText && (
        <div className="p-4 rounded-2xl bg-[#0e1e14] border border-emerald-500/30 text-xs space-y-3 animate-in fade-in shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-semibold text-emerald-200 block">Long text detected in clipboard</span>
              <p className="text-zinc-400 text-[11px]">Would you like to attach this as payment evidence or paste it into your question?</p>
            </div>
            <button onClick={() => setDetectedPastedText(null)} className="text-zinc-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="p-2.5 rounded-xl bg-black/40 font-mono text-[11px] text-zinc-300 max-h-20 overflow-y-auto italic">
            "{detectedPastedText.slice(0, 150)}…"
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setInputText((prev) => prev + detectedPastedText);
                setDetectedPastedText(null);
              }}
              className="btn-pill-secondary text-xs px-3 py-1.5"
            >
              Paste as Question Text
            </button>
            <Button
              variant="pill-primary"
              size="sm"
              onClick={() => {
                const res = apiClient.createRawMessageEvidence(detectedPastedText);
                setActiveEvidence(res.evidence, res.extracted);
                setDetectedPastedText(null);
              }}
            >
              Attach as Message Evidence
            </Button>
          </div>
        </div>
      )}

      {/* Starter Suggested Questions (Changes with Evidence Type) */}
      {starters.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-semibold text-emerald-400/80 flex items-center gap-1 pl-1 flex-shrink-0">
            <Sparkles className="h-3 w-3 text-emerald-400" />
            Suggested:
          </span>
          {starters.map((starter, i) => (
            <button
              key={i}
              onClick={() => setInputText(starter)}
              className="flex-shrink-0 text-xs px-3 py-1 rounded-full bg-[#0d1c12]/90 border border-emerald-500/20 text-emerald-200 hover:bg-emerald-900/40 hover:border-emerald-400/40 transition-all text-left whitespace-nowrap"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {/* Main Composer Box */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-3xl bg-[#09140d]/95 border transition-all duration-200 backdrop-blur-xl shadow-2xl p-3",
          isDragging ? "border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-400/40" : "border-emerald-500/20 hover:border-emerald-500/35"
        )}
      >
        {/* Attached Evidence Removable Chip */}
        {activeEvidence && (
          <div className="mb-2 flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 text-xs text-emerald-200 shadow-sm animate-in fade-in">
              {getEvidenceIcon(activeEvidence.type)}
              <span className="font-semibold text-[11px] uppercase tracking-wider text-emerald-400">
                {activeEvidence.type}:
              </span>
              <span className="max-w-[200px] sm:max-w-xs truncate font-mono text-[11px]">
                {activeEvidence.title}
              </span>
              <button
                onClick={removeEvidence}
                className="ml-1 p-0.5 rounded-full hover:bg-emerald-800/60 text-zinc-400 hover:text-white transition-colors"
                title="Remove evidence"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <span className="text-[11px] text-zinc-400 italic hidden sm:inline">
              (Persistent context for this conversation)
            </span>
          </div>
        )}

        {/* Live Interim Transcription Bar while Listening */}
        {sttStatus === "listening" && (
          <div className="mb-2 px-3 py-2 rounded-2xl bg-red-950/50 border border-red-500/40 text-xs flex items-center justify-between gap-2.5 animate-in fade-in">
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <span className="flex items-end gap-0.5 h-3 shrink-0">
                <span className="w-0.5 h-2 bg-red-400 animate-pulse" />
                <span className="w-0.5 h-3.5 bg-red-300 animate-pulse delay-75" />
                <span className="w-0.5 h-1.5 bg-red-500 animate-pulse delay-150" />
              </span>
              <span className="font-semibold text-red-300 text-[11px] shrink-0">Live voice:</span>
              <span className="text-zinc-200 italic truncate text-[11px] font-sans">
                {interimTranscript || "Listening... speak now"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={cancelListening}
                className="px-2.5 py-1 rounded-xl bg-black/60 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[11px] font-medium transition-colors border border-white/10"
                title="Cancel voice input (discard transcript)"
                aria-label="Cancel voice input"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={stopListening}
                className="flex items-center gap-1 px-3 py-1 rounded-xl bg-red-900/80 hover:bg-red-800 text-white text-[11px] font-semibold transition-colors shadow-sm"
                title="Finish and keep transcript in composer"
                aria-label="Finish and keep transcript"
              >
                <Check className="h-3 w-3 stroke-[2.5]" />
                <span>Done</span>
              </button>
            </div>
          </div>
        )}

        {/* Text Area and Microphone Button */}
        <div className="relative flex items-center gap-2">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled || isStreaming}
            rows={1}
            placeholder={
              activeEvidence
                ? "Ask a question about this evidence (e.g., 'Is it safe to pay this?')..."
                : "Ask anything about suspicious payments, or attach evidence below..."
            }
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none max-h-36 py-2 px-2"
          />

          {/* Voice Input Button: States for Idle, Listening, Processing, Success */}
          {sttStatus === "listening" ? (
            <button
              type="button"
              onClick={stopListening}
              aria-label="Stop recording voice input"
              title="Stop listening (Insert transcript)"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-950/90 border border-red-500/60 text-red-200 hover:bg-red-900 text-xs font-semibold shrink-0 transition-all shadow-lg animate-pulse"
            >
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span>Done</span>
              <Check className="h-3 w-3 stroke-[2.5] ml-0.5" />
            </button>
          ) : sttStatus === "processing" ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-medium shrink-0 animate-pulse"
              title="Finalizing speech recognition"
            >
              <RotateCw className="h-3 w-3 animate-spin" />
              <span>Processing</span>
            </div>
          ) : sttStatus === "success" ? (
            <div
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 text-xs font-semibold shrink-0 animate-in fade-in"
              title="Speech transcribed successfully"
            >
              <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[2.5]" />
              <span className="text-[11px]">Transcribed</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartVoice}
              disabled={disabled || isStreaming}
              aria-label="Start voice input"
              title={isSttSupported ? "Voice input: Speak your question" : "Voice input not supported in this browser"}
              className="p-2 rounded-2xl text-zinc-400 hover:text-emerald-300 hover:bg-emerald-950/60 border border-transparent hover:border-emerald-500/30 transition-all shrink-0"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Bottom Toolbar: Attach Button, Already Paid Button, Privacy Reminder, and Send */}
        <div className="mt-2 pt-2 border-t border-emerald-500/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <button
              onClick={() => checkAndProceedWithUpload(() => fileInputRef.current?.click())}
              disabled={disabled || isStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-400/50 text-xs font-medium transition-colors"
              title="Attach screenshot, QR, or paste URL"
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span>Attach Evidence</span>
            </button>

            {/* 🚨 I Already Paid emergency button */}
            <button
              type="button"
              onClick={() => openAlreadyPaidModal()}
              disabled={disabled || isStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-950/40 hover:bg-red-900/60 border border-red-500/25 hover:border-red-500/40 text-red-300 text-xs font-medium transition-colors"
              title="Emergency assistance if payment was already made"
            >
              <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
              <span>Already Paid? Get Help</span>
            </button>

            {/* Persistent compact privacy reminder */}
            <div className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-300 cursor-help transition-colors hidden lg:flex">
              <ShieldAlert className="h-3 w-3 text-amber-400/80 flex-shrink-0" />
              <span>Never share OTPs, CVVs, or full PINs</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tooltip for disabled send button when evidence is attached without question */}
            {activeEvidence && !hasQuestion ? (
              <Tooltip content="Please enter a question to analyze this evidence" side="top">
                <span>
                  <Button
                    variant="pill-primary"
                    size="sm"
                    disabled={true}
                    className="flex items-center gap-1.5"
                  >
                    <span>Send</span>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button
                variant="pill-primary"
                size="sm"
                onClick={handleSend}
                disabled={!canSend}
                className="flex items-center gap-1.5"
              >
                <span>Send</span>
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
