"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSpeechStore } from "@/lib/stores/useSpeechStore";
import { useTextToSpeech } from "@/lib/speech/useTextToSpeech";
import { Volume2, Sliders, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function VoiceSettingsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    speechRate,
    selectedVoiceURI,
    autoReadEnabled,
    availableVoices,
    setSpeechRate,
    setSelectedVoiceURI,
    setAutoReadEnabled,
    sttLanguage
  } = useSpeechStore();

  const { speak, isTtsSupported: hasTts } = useTextToSpeech();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const testPhrase = () => {
    speak("test-preview", "Pay-Lume voice intelligence ready. Protecting your transactions.");
  };

  if (!hasTts) {
    return null;
  }

  const rates = [0.8, 1.0, 1.25, 1.5];

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
          autoReadEnabled
            ? "bg-emerald-900/60 border-emerald-400/50 text-emerald-200 shadow-sm"
            : "bg-emerald-950/60 border-emerald-500/25 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-400/40"
        )}
        title="Voice & Speech Settings"
        aria-label="Voice & Speech Settings"
        aria-expanded={isOpen}
      >
        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Voice</span>
        {autoReadEnabled && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Auto-read enabled" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 p-4 rounded-3xl bg-[#09140d]/95 border border-emerald-500/30 shadow-2xl backdrop-blur-2xl z-50 text-xs space-y-4 animate-in fade-in duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-emerald-100">Voice Settings</span>
            </div>
            <button
              onClick={testPhrase}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/25 transition-colors"
              title="Test current voice settings"
            >
              <Sparkles className="h-3 w-3" />
              <span>Preview</span>
            </button>
          </div>

          {/* Auto-read Toggle */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <label htmlFor="auto-read-toggle" className="font-medium text-emerald-200 block cursor-pointer">
                Auto-read AI responses
              </label>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Read new answers aloud automatically when generation finishes
              </p>
            </div>
            <button
              id="auto-read-toggle"
              type="button"
              role="switch"
              aria-checked={autoReadEnabled}
              onClick={() => setAutoReadEnabled(!autoReadEnabled)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-0.5",
                autoReadEnabled ? "bg-emerald-500" : "bg-zinc-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                  autoReadEnabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Speech Rate Pills */}
          <div className="space-y-1.5">
            <span className="font-medium text-zinc-300 block text-[11px]">Speech Speed</span>
            <div className="grid grid-cols-4 gap-1.5">
              {rates.map((r) => (
                <button
                  key={r}
                  onClick={() => setSpeechRate(r)}
                  className={cn(
                    "py-1 rounded-xl text-center font-mono font-medium transition-all text-xs",
                    speechRate === r
                      ? "bg-emerald-500 text-black shadow font-semibold"
                      : "bg-emerald-950/60 text-zinc-300 hover:bg-emerald-900/60 border border-emerald-500/20"
                  )}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>

          {/* Voice Selection */}
          {availableVoices.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-medium text-zinc-300 block text-[11px]">Assistant Voice</span>
              <div className="relative">
                <select
                  value={selectedVoiceURI || ""}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-black/60 border border-emerald-500/25 text-xs text-zinc-200 focus:outline-none focus:border-emerald-400 transition-colors"
                >
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI} className="bg-[#0b160f] text-zinc-200">
                      {v.name} ({v.lang}) {v.isDefault ? "★" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Recognition Language */}
          <div className="pt-1 text-[11px] text-zinc-400 flex items-center justify-between border-t border-emerald-500/10">
            <span>Speech input language:</span>
            <span className="font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/20">
              {sttLanguage}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
