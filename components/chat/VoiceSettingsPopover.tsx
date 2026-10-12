"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSpeechStore } from "@/lib/stores/useSpeechStore";
import { useTextToSpeech } from "@/lib/speech/useTextToSpeech";
import { KOKORO_VOICES } from "@/lib/speech/neuralVoices";
import { Volume2, Sliders, ChevronDown, Sparkles, Cpu, Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function VoiceSettingsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    engine,
    neuralStatus,
    neuralProgress,
    selectedNeuralVoice,
    speechRate,
    selectedVoiceURI,
    autoReadEnabled,
    availableVoices,
    setEngine,
    setSelectedNeuralVoice,
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
    speak(
      "test-preview",
      "Pay-Lume voice intelligence ready. Protecting your transactions with real-time cybersecurity insights."
    );
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
          autoReadEnabled || engine === "neural"
            ? "bg-emerald-900/60 border-emerald-400/50 text-emerald-200 shadow-sm"
            : "bg-emerald-950/60 border-emerald-500/25 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-400/40"
        )}
        title="Voice & Speech Settings"
        aria-label="Voice & Speech Settings"
        aria-expanded={isOpen}
      >
        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Voice</span>
        {engine === "neural" && (
          <span className="px-1.5 py-0.2 text-[9px] font-mono uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            Neural
          </span>
        )}
        {autoReadEnabled && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Auto-read enabled" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-88 max-w-[calc(100vw-2rem)] p-4 rounded-3xl bg-[#09140d]/95 border border-emerald-500/30 shadow-2xl backdrop-blur-2xl z-50 text-xs space-y-4 animate-in fade-in duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-emerald-100">Voice Settings</span>
            </div>
            <button
              onClick={testPhrase}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/25 transition-colors"
              title="Test current voice settings"
            >
              <Sparkles className="h-3 w-3 text-emerald-400" />
              <span>Preview</span>
            </button>
          </div>

          {/* Engine Selector: Neural vs Browser */}
          <div className="space-y-1.5">
            <span className="font-medium text-zinc-300 block text-[11px]">Speech Engine</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEngine("neural")}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-2xl border text-left transition-all",
                  engine === "neural"
                    ? "bg-emerald-900/60 border-emerald-400/60 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                    : "bg-black/40 border-emerald-500/20 text-zinc-400 hover:text-zinc-200 hover:bg-emerald-950/40"
                )}
              >
                <Cpu className={cn("h-4 w-4 shrink-0", engine === "neural" ? "text-emerald-400" : "text-zinc-500")} />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-[11px]">Neural AI</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      Kokoro
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block leading-tight">Human prosody</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setEngine("browser")}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-2xl border text-left transition-all",
                  engine === "browser"
                    ? "bg-emerald-900/60 border-emerald-400/60 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                    : "bg-black/40 border-emerald-500/20 text-zinc-400 hover:text-zinc-200 hover:bg-emerald-950/40"
                )}
              >
                <Globe className={cn("h-4 w-4 shrink-0", engine === "browser" ? "text-emerald-400" : "text-zinc-500")} />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-[11px]">Browser TTS</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                      Native
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block leading-tight">Fast fallback</span>
                </div>
              </button>
            </div>
          </div>

          {/* Neural Voice Selection */}
          {engine === "neural" && (
            <div className="space-y-1.5 p-3 rounded-2xl bg-black/40 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="font-medium text-emerald-200 block text-[11px]">Neural Voice Model</span>
                {neuralStatus === "ready" && (
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <Check className="h-3 w-3" /> Cached Locally
                  </span>
                )}
              </div>

              <div className="relative">
                <select
                  value={selectedNeuralVoice}
                  onChange={(e) => setSelectedNeuralVoice(e.target.value)}
                  className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-[#0b160f] border border-emerald-500/30 text-xs text-zinc-200 focus:outline-none focus:border-emerald-400 transition-colors"
                >
                  {KOKORO_VOICES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#0b160f] text-zinc-200">
                      {v.name} ({v.accent} {v.gender} - Grade {v.grade}) {v.recommended ? "★ Recommended" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Neural Model Download Progress Bar (shown when downloading) */}
              {neuralProgress !== null && neuralProgress > 0 && neuralProgress < 100 && (
                <div className="pt-2 space-y-1 animate-in fade-in">
                  <div className="flex justify-between text-[10px] font-mono text-emerald-300">
                    <span>Downloading Kokoro Neural Model...</span>
                    <span>{neuralProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden border border-emerald-500/20">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-150"
                      style={{ width: `${neuralProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-[10px] text-zinc-400 leading-snug pt-1">
                Runs 100% locally in your browser via WebAssembly. Private, zero cloud audio streaming.
              </p>
            </div>
          )}

          {/* Browser System Voice Selection */}
          {engine === "browser" && availableVoices.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-2xl bg-black/40 border border-emerald-500/20">
              <span className="font-medium text-emerald-200 block text-[11px]">System Voice</span>
              <div className="relative">
                <select
                  value={selectedVoiceURI || ""}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-[#0b160f] border border-emerald-500/30 text-xs text-zinc-200 focus:outline-none focus:border-emerald-400 transition-colors"
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

          {/* Auto-read Toggle */}
          <div className="flex items-start justify-between gap-3 pt-1">
            <div>
              <label htmlFor="auto-read-toggle" className="font-medium text-emerald-200 block cursor-pointer">
                Auto-read AI responses
              </label>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Read new answers aloud automatically when generation completes
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

          {/* Recognition Language */}
          <div className="pt-2 text-[11px] text-zinc-400 flex items-center justify-between border-t border-emerald-500/10">
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
